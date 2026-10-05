"""Trợ lý AI (Claude): trả lời câu hỏi về sức khoẻ người thân và viết nhận xét báo cáo tuần.

Khoá API nhập ở trang /quan-tri (app_settings 'anthropic_api_key') hoặc biến môi trường
ANTHROPIC_API_KEY. Chưa có khoá thì hỏi đáp báo "chưa bật", báo cáo tuần vẫn gửi bảng số liệu.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import date, datetime
from zoneinfo import ZoneInfo

import anthropic

from . import db, facts

log = logging.getLogger(__name__)

MODEL = "claude-opus-5-5"
# Gia đình hỏi tối đa chừng này câu mỗi ngày (mỗi câu tốn phí API).
DAILY_QUESTION_LIMIT = 60
SAMPLE_QUESTION_LIMIT = 3  # gia đình mẫu ("Xem tài khoản mẫu"): ai cũng mở được, nên chỉ cho thử vài câu
HISTORY_TURNS = 6

SYSTEM = """You are the health assistant inside "Chăm Sóc Người Thân" (Family Care), an app a family uses \
to look after elderly relatives remotely through their Garmin watches, manual blood pressure / glucose \
entries, medication schedules and alerts sent to a Telegram group.

You receive the family's current data as JSON inside <du_lieu>: for each relative, readings right now \
(bay_gio), 15 days of daily Garmin metrics (hang_ngay_14_ngay: resting heart rate, steps, sleep seconds, \
SpO2, Body Battery, stress, HRV), manual readings, open and recent alerts, and today's medicines. \
Field names are Vietnamese; sleep is in seconds; times are local.

How to answer:
- Answer only from this data. If something isn't in the data, say so plainly instead of guessing.
- Be concrete: quote the numbers and dates you rely on, and compare with the person's own recent days.
- Explain what a number means for an older person in everyday words, and say what the family could do \
(call to check in, remind them to drink water, measure blood pressure again, see a doctor).
- You are not a doctor and this is not a diagnosis. When something could be serious (chest pain, very low \
SpO2, very high or very low heart rate or blood pressure, a fall, confusion), say clearly to contact a \
doctor or emergency services (115 in Vietnam). Don't add a disclaimer to every answer otherwise.
- Write plain text for a chat message: short paragraphs or "- " bullet lines, no Markdown headings, \
no tables, no bold markers. Keep it brief unless asked for detail.
- Reply in the language the user writes in (Vietnamese by default). In Vietnamese, refer to the relatives \
the way the family names them (e.g. "Ba Hùng", "Mẹ Lan")."""

WEEKLY_SYSTEM = SYSTEM + """

Now you are writing the family's weekly report. You get, for each relative, averages for this week and \
the week before, the alerts of the week and medication adherence. For each person write a short \
assessment (2–4 sentences: what went well, what changed, what to watch) and 1–3 practical suggestions \
for the family for next week. Then write a 1–2 sentence overview for the whole family. Mention a change \
only when it's meaningful (e.g. resting heart rate +5 bpm, sleep −45 minutes, steps −30%). If a person \
has little or no data this week, say that the watch probably wasn't worn or synced."""

WEEKLY_SCHEMA = {
    "type": "object",
    "properties": {
        "overview": {"type": "string"},
        "people": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "summary": {"type": "string"},
                    "suggestions": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["name", "summary", "suggestions"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["overview", "people"],
    "additionalProperties": False,
}


class AIUnavailable(Exception):
    """Chưa có khoá API, hết lượt trong ngày, hoặc AI từ chối / lỗi; thông điệp hiện cho người dùng."""


def api_key(conn) -> str | None:
    return db.get_setting(conn, "anthropic_api_key") or os.environ.get("ANTHROPIC_API_KEY") or None


def _default(v):
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    return str(v)


def _create(key: str, *, system: str, messages: list[dict], max_tokens: int, effort: str,
            schema: dict | None = None) -> str:
    client = anthropic.Anthropic(api_key=key, timeout=180.0, max_retries=2)
    output_config: dict = {"effort": effort}
    if schema:
        output_config["format"] = {"type": "json_schema", "schema": schema}
    try:
        resp = client.beta.messages.create(
            model=MODEL,
            max_tokens=max_tokens,
            # Bị bộ lọc an toàn từ chối thì máy chủ Anthropic tự chạy lại trên model dự phòng phù hợp.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config=output_config,
            system=system,
            messages=messages,
        )
    except anthropic.AuthenticationError as e:
        raise AIUnavailable("Khoá API Claude không đúng. Quản trị kiểm tra lại ở trang Quản trị.") from e
    except anthropic.PermissionDeniedError as e:
        raise AIUnavailable("Khoá API Claude không có quyền dùng model này.") from e
    except anthropic.RateLimitError as e:
        raise AIUnavailable("AI đang quá tải hoặc hết hạn mức, thử lại sau ít phút.") from e
    except anthropic.APIStatusError as e:
        log.warning("Claude lỗi %s: %s", e.status_code, e.message)
        raise AIUnavailable("AI tạm thời không trả lời được, thử lại sau.") from e
    except anthropic.APIConnectionError as e:
        raise AIUnavailable("Không kết nối được tới AI, thử lại sau.") from e
    if resp.stop_reason == "refusal":
        raise AIUnavailable("AI không trả lời câu này. Hãy hỏi cách khác.")
    text = "".join(b.text for b in resp.content if b.type == "text").strip()
    if not text:
        raise AIUnavailable("AI chưa trả lời được, thử lại sau.")
    return text


def _count_question(conn, family_id: str, day: date, limit: int) -> None:
    row = conn.execute(
        """
        insert into ai_usage (family_id, day, questions) values (%s, %s, 1)
        on conflict (family_id, day) do update set questions = ai_usage.questions + 1
        returning questions
        """,
        (family_id, day),
    ).fetchone()
    if row["questions"] > limit:
        raise AIUnavailable(f"Gia đình đã hỏi {limit} câu hôm nay, mai hỏi tiếp nhé.")


def ask(conn, family: dict, question: str, now_utc: datetime,
        history: list[dict] | None = None) -> str:
    """Trả lời một câu hỏi về cả gia đình. history: các lượt trước [{role, content}] (trên web)."""
    key = api_key(conn)
    if not key:
        raise AIUnavailable("AI chưa được bật: quản trị cần dán khoá API Claude ở trang Quản trị.")
    question = question.strip()[:2000]
    if not question:
        raise AIUnavailable("Hãy nhập câu hỏi.")
    limit = SAMPLE_QUESTION_LIMIT if family.get("expires_at") else DAILY_QUESTION_LIMIT
    _count_question(conn, str(family["id"]), now_utc.astimezone(ZoneInfo(family["timezone"])).date(), limit)
    data = [facts.for_ai(f) for f in facts.family_facts(conn, family, now_utc)]
    messages = [{"role": m["role"], "content": str(m["content"])[:4000]}
                for m in (history or [])[-HISTORY_TURNS * 2:] if m.get("role") in ("user", "assistant")]
    # Lượt đầu phải là người dùng; bỏ câu trả lời mồ côi ở đầu lịch sử nếu có.
    while messages and messages[0]["role"] != "user":
        messages.pop(0)
    context = json.dumps({"gia_dinh": family["name"], "nguoi_than": data}, ensure_ascii=False, default=_default)
    messages.append({"role": "user", "content": f"<du_lieu>\n{context}\n</du_lieu>\n\n{question}"})
    return _create(key, system=SYSTEM, messages=messages, max_tokens=4000, effort="low")


def weekly_comments(conn, family: dict, weekly: dict) -> dict | None:
    """Nhận xét AI cho báo cáo tuần; None nếu chưa có khoá hoặc AI lỗi (báo cáo vẫn gửi bảng số liệu)."""
    key = api_key(conn)
    if not key:
        return None
    payload = json.dumps(weekly, ensure_ascii=False, default=_default)
    try:
        text = _create(key, system=WEEKLY_SYSTEM, max_tokens=8000, effort="medium", schema=WEEKLY_SCHEMA,
                       messages=[{"role": "user", "content": f"<du_lieu>\n{payload}\n</du_lieu>\n\n"
                                  "Viết nhận xét báo cáo tuần bằng tiếng Việt."}])
        return json.loads(text)
    except (AIUnavailable, json.JSONDecodeError):
        log.exception("Không viết được nhận xét tuần cho gia đình %s", family["id"])
        return None
