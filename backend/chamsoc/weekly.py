"""Báo cáo tuần: gửi sáng Chủ nhật vào nhóm Telegram, kèm link xem đầy đủ trên web.

Mỗi người thân một bảng tuần này / tuần trước (nhịp tim nghỉ, bước chân, giấc ngủ, SpO2, căng thẳng,
Body Battery, huyết áp, cảnh báo, uống thuốc) và nhận xét của AI nếu đã có khoá API.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from html import escape
from zoneinfo import ZoneInfo

from psycopg.types.json import Jsonb

from . import ai, facts, telegram
from .config import web_base

log = logging.getLogger(__name__)

SEND_DAY = 6            # Chủ nhật (Monday = 0)
SEND_FROM, SEND_UNTIL = 7, 11   # gửi trong khoảng 7:00–11:00 sáng giờ địa phương
MAX_FAMILIES_PER_TICK = 3       # mỗi lần chạy (5 phút) làm vài gia đình, tránh quá thời gian


def last_full_week(today: date) -> tuple[date, date]:
    """Tuần trọn gần nhất, Chủ nhật → thứ Bảy, kết thúc trước hôm nay."""
    back = (today.weekday() - 5) % 7 or 7  # số ngày lùi về thứ Bảy gần nhất trước hôm nay
    end = today - timedelta(days=back)
    return end - timedelta(days=6), end


def _meds(conn, elder_id: str, tz: str, start: date, end: date) -> dict:
    row = conn.execute(
        """
        select count(*) filter (where l.taken_at is not null) as taken, count(*) as due
        from med_logs l join med_schedules s on s.id = l.schedule_id
        where s.elder_id = %s and (l.due_at at time zone %s)::date between %s and %s
        """,
        (elder_id, tz, start, end),
    ).fetchone()
    return {"taken": row["taken"], "due": row["due"],
            "percent": round(100 * row["taken"] / row["due"]) if row["due"] else None}


def build(conn, family: dict, now_utc: datetime) -> dict:
    tz = family["timezone"]
    today = now_utc.astimezone(ZoneInfo(tz)).date()
    start, end = last_full_week(today)
    prev_start, prev_end = start - timedelta(days=7), start - timedelta(days=1)
    people = []
    for f in facts.family_facts(conn, family, now_utc):
        week_alerts = [a for a in f["recent_alerts"] if start <= a["opened_at"].astimezone(ZoneInfo(tz)).date() <= end]
        people.append({
            "id": f["id"],
            "name": f["name"],
            "birth_year": f["birth_year"],
            "conditions": f["conditions"],
            "status_now": f["status"],
            "this_week": facts.week_stats(f, start, end) | {"meds": _meds(conn, f["id"], tz, start, end)},
            "last_week": facts.week_stats(f, prev_start, prev_end) | {"meds": _meds(conn, f["id"], tz, prev_start, prev_end)},
            "alerts_this_week": list(dict.fromkeys(a["message"] for a in week_alerts))[:8],
            "open_alerts": [a["message"] for a in f["open_alerts"]],
        })
    return {"family": family["name"], "week_start": start.isoformat(), "week_end": end.isoformat(), "people": people}


def create(conn, family: dict, now_utc: datetime) -> tuple[str, dict, dict | None]:
    """Tạo (hoặc làm lại) báo cáo tuần trọn gần nhất; trả về (id, số liệu, nhận xét AI)."""
    data = build(conn, family, now_utc)
    comments = ai.weekly_comments(conn, family, data) if data["people"] else None
    row = conn.execute(
        """
        insert into weekly_reports (family_id, week_start, week_end, data, ai)
        values (%s, %s, %s, %s, %s)
        on conflict (family_id, week_end) do update
          set data = excluded.data, ai = excluded.ai, created_at = now()
        returning id
        """,
        (family["id"], data["week_start"], data["week_end"], Jsonb(data), Jsonb(comments) if comments else None),
    ).fetchone()
    return str(row["id"]), data, comments


# ---------- Tin Telegram ----------

def _n(v, unit: str = "", dec: bool = False) -> str:
    if v is None:
        return "–"
    if dec:
        return f"{v:.1f}".replace(".", ",") + unit
    return f"{round(v):,}".replace(",", ".") + unit


def _sleep(h) -> str:
    if h is None:
        return "–"
    m = round(h * 60)
    return f"{m // 60}g{m % 60:02d}"


def _bp(w: dict) -> str:
    return f"{w['bp_systolic']}/{w['bp_diastolic']}" if w.get("bp_systolic") else "–"


def _pct(m: dict) -> str:
    return f"{m['percent']}%" if m and m.get("percent") is not None else "–"


def table(p: dict) -> str:
    a, b = p["this_week"], p["last_week"]
    rows = [
        ("Nhịp tim nghỉ", _n(a["resting_hr"]), _n(b["resting_hr"])),
        ("Bước/ngày", _n(a["steps"]), _n(b["steps"])),
        ("Ngủ/đêm", _sleep(a["sleep_hours"]), _sleep(b["sleep_hours"])),
        ("SpO2 thấp nhất", _n(a["spo2_lowest"], "%"), _n(b["spo2_lowest"], "%")),
        ("Căng thẳng TB", _n(a["stress"]), _n(b["stress"])),
        ("Body Battery", _n(a["body_battery"]), _n(b["body_battery"])),
        ("Huyết áp TB", _bp(a), _bp(b)),
        ("Đường huyết", _n(a["glucose"], dec=True), _n(b["glucose"], dec=True)),
        ("Cảnh báo", str(a["alerts"]), str(b["alerts"])),
        ("Uống thuốc", _pct(a["meds"]), _pct(b["meds"])),
    ]
    # Bỏ dòng cả hai tuần đều trống (ví dụ người không đo đường huyết).
    rows = [r for r in rows if r[1] != "–" or r[2] != "–"]
    lines = [f"{'':<15}{'Tuần này':<10}Tuần trước"] + [f"{k:<15}{x:<10}{y}" for k, x, y in rows]
    return "\n".join(lines)


def telegram_text(report_id: str, data: dict, comments: dict | None, web: str) -> str:
    start = date.fromisoformat(data["week_start"])
    end = date.fromisoformat(data["week_end"])
    out = [f"📊 <b>Báo cáo tuần {start:%d/%m} – {end:%d/%m}</b>"]
    notes = {p["name"]: p for p in (comments or {}).get("people", [])}
    if comments and comments.get("overview"):
        out.append(f"<i>{escape(comments['overview'])}</i>")
    for p in data["people"]:
        block = [f"<b>{escape(p['name'])}</b> — {escape(p['status_now'])}"]
        if p["this_week"]["days_with_data"] == 0 and p["last_week"]["days_with_data"] == 0:
            block.append("Chưa có số liệu đồng hồ hai tuần qua.")
        else:
            block.append(f"<pre>{escape(table(p))}</pre>")
        if note := notes.get(p["name"]):
            block.append(escape(note["summary"]))
            block += [f"• {escape(s)}" for s in note.get("suggestions", [])]
        out.append("\n".join(block))
    if comments is None:
        out.append("<i>Bật AI ở trang Quản trị để có thêm nhận xét và gợi ý cho từng người.</i>")
    out.append(f'👉 <a href="{web}/bao-cao/{report_id}">Xem báo cáo đầy đủ trên web</a>')
    return "\n\n".join(out)


def send(conn, tg: telegram.TelegramClient, family: dict, now_utc: datetime) -> str:
    report_id, data, comments = create(conn, family, now_utc)
    text = telegram_text(report_id, data, comments, web_base())
    for chat_id in family.get("chat_ids") or []:
        try:
            tg.send(chat_id, text)
        except Exception:
            log.exception("Gửi báo cáo tuần vào nhóm %s lỗi", chat_id)
    return report_id


def due_families(conn, now_utc: datetime) -> list[dict]:
    """Gia đình đến giờ nhận báo cáo tuần (sáng Chủ nhật, chưa gửi tuần này); đánh dấu luôn để không gửi lặp."""
    out = []
    rows = conn.execute(
        """
        select f.*, (select coalesce(array_agg(fc.chat_id order by fc.linked_at), '{}')
                     from family_chats fc where fc.family_id = f.id) as chat_ids
        from families f
        where f.expires_at is null and exists (select 1 from elders e where e.family_id = f.id)
        """
    ).fetchall()
    for f in rows:
        local = now_utc.astimezone(ZoneInfo(f["timezone"]))
        if local.weekday() != SEND_DAY or not SEND_FROM <= local.hour < SEND_UNTIL:
            continue
        marked = conn.execute(
            """
            update families set last_weekly_report_on = %s
            where id = %s and (last_weekly_report_on is null or last_weekly_report_on < %s) returning id
            """,
            (local.date(), f["id"], local.date()),
        ).fetchone()
        if marked:
            out.append(f)
        if len(out) >= MAX_FAMILIES_PER_TICK:
            break
    return out

