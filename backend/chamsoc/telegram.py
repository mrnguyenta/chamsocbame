"""Gửi tin Telegram, định dạng tin nhắn và đọc chỉ số ba mẹ tự nhập."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from html import escape

import httpx

from .models import Snapshot

SEVERITY_LABEL = {
    "info": "Nhắc nhở",
    "warn": "Chú ý",
    "high": "CẢNH BÁO CAO",
    "urgent": "KHẨN CẤP",
}

Button = tuple[str, str]  # (nhãn, callback_data)


class TelegramClient:
    def __init__(self, token: str, http: httpx.Client | None = None) -> None:
        self._base = f"https://api.telegram.org/bot{token}"
        self._http = http or httpx.Client(timeout=15)

    def _call(self, method: str, payload: dict) -> dict:
        r = self._http.post(f"{self._base}/{method}", json=payload)
        r.raise_for_status()
        return r.json()["result"]

    def send(self, chat_id: int, text: str, buttons: list[list[Button]] | None = None) -> dict:
        # Telegram nhận tối đa 4096 ký tự: tin dài (nhiều người thân) tách theo đoạn, nút bấm ở tin cuối.
        parts = _split(text)
        for part in parts[:-1]:
            self._send_one(chat_id, part, None)
        return self._send_one(chat_id, parts[-1], buttons)

    def _send_one(self, chat_id: int, text: str, buttons: list[list[Button]] | None) -> dict:
        payload: dict = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }
        if buttons:
            payload["reply_markup"] = {
                "inline_keyboard": [
                    [{"text": label, "callback_data": data} for label, data in row]
                    for row in buttons
                ]
            }
        return self._call("sendMessage", payload)

    def set_webhook(self, url: str, secret_token: str) -> dict:
        """Đăng ký địa chỉ nhận tin nhắn của bot (gọi lại nhiều lần cũng không sao)."""
        return self._call("setWebhook", {
            "url": url, "secret_token": secret_token,
            "allowed_updates": ["message", "callback_query", "my_chat_member"], "drop_pending_updates": True,
        })

    def set_commands(self, commands: list[tuple[str, str]]) -> dict:
        """Danh sách lệnh hiện ra khi gõ "/" trong Telegram."""
        return self._call("setMyCommands", {"commands": [{"command": c, "description": d} for c, d in commands]})

    def get_chat(self, chat_id: int) -> dict:
        return self._call("getChat", {"chat_id": chat_id})

    def get_me(self) -> dict:
        return self._call("getMe", {})

    def answer_callback(self, callback_id: str, text: str = "") -> None:
        self._call("answerCallbackQuery", {"callback_query_id": callback_id, "text": text})

    def clear_buttons(self, chat_id: int, message_id: int) -> None:
        self._call(
            "editMessageReplyMarkup",
            {"chat_id": chat_id, "message_id": message_id, "reply_markup": {"inline_keyboard": []}},
        )


def _split(text: str, limit: int = 3900) -> list[str]:
    parts: list[str] = []
    cur = ""
    for para in text.split("\n\n"):
        if cur and len(cur) + 2 + len(para) > limit:
            parts.append(cur)
            cur = para
        else:
            cur = f"{cur}\n\n{para}" if cur else para
    parts.append(cur)
    return [p[i:i + limit] for p in parts for i in range(0, max(len(p), 1), limit)]


def _hm(seconds: int | None) -> str:
    if seconds is None:
        return "—"
    h, m = divmod(seconds // 60, 60)
    return f"{h}g{m:02d}"


def _num(v: int | None) -> str:
    return "—" if v is None else f"{v:,}".replace(",", ".")


def alert_text(elder_name: str, severity: str, message: str, opened_at: datetime) -> str:
    return (
        f"<b>{SEVERITY_LABEL[severity]} · {escape(elder_name)}</b>\n"
        f"{escape(message)}\n"
        f"<i>Lúc {opened_at:%H:%M %d/%m}. Chỉ mang tính tham khảo, không thay thế bác sĩ.</i>"
    )


def alert_buttons(alert_id: str) -> list[list[Button]]:
    return [
        [("Tôi xử lý", f"ack:{alert_id}")],
        [("Tắt 2 giờ", f"snooze:{alert_id}")],
    ]


def resolved_text(elder_name: str, message: str) -> str:
    return f"<b>{escape(elder_name)}</b> — đã trở lại bình thường.\n{escape(message)}"


def snapshot_lines(s: Snapshot, status: str) -> str:
    parts = [
        f"Ngủ {_hm(s.sleep_seconds)}",
        f"Nhịp tim nghỉ {_num(s.resting_hr)}",
        f"Bước chân {_num(s.steps)}",
    ]
    if s.body_battery is not None:
        parts.append(f"Body Battery {s.body_battery}")
    if s.spo2_min is not None:
        parts.append(f"SpO2 thấp nhất {s.spo2_min}%")
    if s.systolic and s.diastolic:
        parts.append(f"Huyết áp {s.systolic}/{s.diastolic}")
    return f"<b>{escape(s.elder_name)}</b> — {escape(status)}\n" + " · ".join(parts)


def report_text(title: str, items: list[tuple[Snapshot, str]]) -> str:
    body = "\n\n".join(snapshot_lines(s, status) for s, status in items)
    return f"<b>{escape(title)}</b>\n\n{body}"


def med_reminder_text(med_name: str, note: str | None, due: datetime) -> str:
    extra = f" ({escape(note)})" if note else ""
    return f"Đến giờ uống thuốc {due:%H:%M}: <b>{escape(med_name)}</b>{extra}"


@dataclass
class ParsedReading:
    kind: str
    systolic: int | None = None
    diastolic: int | None = None
    pulse: int | None = None
    value: float | None = None


_BP = re.compile(r"^\s*(?:ha|huyet ap|huyết áp)?\s*(\d{2,3})\s*/\s*(\d{2,3})(?:\s+(\d{2,3}))?\s*$", re.I)
_GLUCOSE = re.compile(r"^\s*(?:duong|đường|dh|đh)(?:\s*huyet|\s*huyết)?\s*(\d{1,2}(?:[.,]\d)?)\s*$", re.I)
_WEIGHT = re.compile(r"^\s*(?:can|cân)(?:\s*nang|\s*nặng)?\s*(\d{2,3}(?:[.,]\d)?)\s*(?:kg)?\s*$", re.I)


def parse_reading(text: str) -> ParsedReading | None:
    """Ba mẹ nhắn "130/85", "130/85 72", "đường 7.2" hoặc "cân 58,5"."""
    if m := _BP.match(text):
        sys_, dia = int(m[1]), int(m[2])
        if 60 <= sys_ <= 260 and 30 <= dia <= 160 and sys_ > dia:
            return ParsedReading("blood_pressure", sys_, dia, int(m[3]) if m[3] else None)
        return None
    if m := _GLUCOSE.match(text):
        v = float(m[1].replace(",", "."))
        return ParsedReading("glucose", value=v) if 1 <= v <= 35 else None
    if m := _WEIGHT.match(text):
        v = float(m[1].replace(",", "."))
        return ParsedReading("weight", value=v) if 25 <= v <= 200 else None
    return None


# ---------- Tin đầy đủ cho /ba, /tongquan ----------

def _ago(t: datetime | None, now: datetime) -> str:
    if t is None:
        return "chưa có dữ liệu"
    m = max(0, int((now - t).total_seconds() // 60))
    if m < 1:
        return "vừa xong"
    if m < 60:
        return f"{m} phút trước"
    if m < 48 * 60:
        return f"{m // 60} giờ trước"
    return f"{m // 1440} ngày trước"


def _dec(v) -> str:
    return f"{float(v):.1f}".replace(".", ",")


def elder_detail_text(f: dict, web: str) -> str:
    """Mọi thứ đang có của một người, nhóm theo chủ đề; dòng nào không có số liệu thì bỏ."""
    s = f["snap"]
    live = f["live"]
    now = f["now_local"]
    lines = [f"<b>{escape(f['name'])}</b> — {escape(f['status'])}"]

    heart = []
    if s.hr_now is not None:
        heart.append(f"đang {s.hr_now} bpm")
    if s.resting_hr is not None:
        heart.append(f"nghỉ {s.resting_hr}")
    if s.hrv_last_night is not None:
        heart.append(f"HRV đêm qua {s.hrv_last_night} ms")
    if heart:
        lines.append("❤️ Nhịp tim: " + " · ".join(heart))

    breath = []
    if live.get("spo2") is not None:
        breath.append(f"SpO2 {live['spo2']}%")
    if s.spo2_min is not None:
        breath.append(f"thấp nhất đêm qua {s.spo2_min}%")
    if live.get("respiration") is not None:
        breath.append(f"nhịp thở {live['respiration']}/phút")
    if breath:
        lines.append("🫁 " + " · ".join(breath))

    energy = []
    if live.get("stress_1h") is not None:
        energy.append(f"căng thẳng 1 giờ qua {live['stress_1h']}")
    elif s.stress_avg is not None:
        energy.append(f"căng thẳng TB {s.stress_avg}")
    if s.body_battery is not None:
        energy.append(f"Body Battery {s.body_battery}/100")
    if energy:
        lines.append("⚡ " + " · ".join(energy))

    move = []
    if s.steps is not None:
        move.append(f"{_num(s.steps)} bước")
    if live.get("distance_m"):
        move.append(f"{_dec(live['distance_m'] / 1000)} km")
    if live.get("floors"):
        move.append(f"{live['floors']} tầng")
    if live.get("active_min"):
        move.append(f"{live['active_min']} phút vận động")
    if live.get("calories"):
        move.append(f"{_num(live['calories'])} kcal")
    if move:
        lines.append("🚶 Hôm nay: " + " · ".join(move))
    if s.last_move_at and s.last_live_at and (now - s.last_move_at).total_seconds() > 3600 and 7 <= now.hour < 21:
        lines.append(f"🪑 Ngồi/nằm yên từ {s.last_move_at.astimezone(now.tzinfo):%H:%M}")

    if s.sleep_seconds:
        sleep = f"😴 Ngủ đêm qua {_hm(s.sleep_seconds)}"
        if s.deep_sleep_seconds:
            sleep += f" (sâu {_hm(s.deep_sleep_seconds)})"
        if s.sleep_score:
            sleep += f" · điểm {s.sleep_score}"
        lines.append(sleep)

    bp = next((r for r in f["readings"] if r["kind"] == "blood_pressure"), None)
    gl = next((r for r in f["readings"] if r["kind"] == "glucose"), None)
    measured = []
    if bp:
        measured.append(f"huyết áp {bp['systolic']}/{bp['diastolic']} ({bp['measured_at'].astimezone(now.tzinfo):%H:%M %d/%m})")
    if gl:
        measured.append(f"đường huyết {_dec(gl['value'])} ({gl['measured_at'].astimezone(now.tzinfo):%H:%M %d/%m})")
    if measured:
        lines.append("🩺 Đo gần nhất: " + " · ".join(measured))

    if f["meds_today"]:
        meds = []
        for m in f["meds_today"]:
            at = m["at"][:5]
            due = now.replace(hour=int(at[:2]), minute=int(at[3:]), second=0, microsecond=0)
            mark = "✅" if m["taken_at"] else ("⏳" if due > now else "❌")
            meds.append(f"{mark} {escape(m['name'])} {at}")
        lines.append("💊 Thuốc hôm nay: " + " · ".join(meds))

    for a in f["open_alerts"][:3]:
        who = f" — {escape(a['acked_by'])} đang xử lý" if a["acked_by"] else " — chưa ai nhận"
        lines.append(f"⚠️ {escape(a['message'])}{who}")

    watch = []
    if f["device"] and f["device"]["label"]:
        watch.append(escape(f["device"]["label"]))
    if s.charging:
        watch.append("đang sạc")
    elif s.watch_battery is not None:
        watch.append(f"pin {s.watch_battery}%")
    last = s.last_live_at or s.last_device_upload_at
    if last or watch:
        watch.append(f"gửi {_ago(last, now)}")
        lines.append("⌚ " + " · ".join(watch))
    lines.append(f'<a href="{web}/nguoi-than/{f["id"]}">Xem chi tiết trên web</a>')
    return "\n".join(lines)


def family_overview_text(title: str, items: list[dict], web: str) -> str:
    body = "\n\n".join(elder_detail_text(f, web) for f in items) or "Chưa có người thân nào."
    return f"<b>{escape(title)}</b>\n\n{body}"
