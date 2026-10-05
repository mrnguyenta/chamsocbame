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

    def answer_callback(self, callback_id: str, text: str = "") -> None:
        self._call("answerCallbackQuery", {"callback_query_id": callback_id, "text": text})

    def clear_buttons(self, chat_id: int, message_id: int) -> None:
        self._call(
            "editMessageReplyMarkup",
            {"chat_id": chat_id, "message_id": message_id, "reply_markup": {"inline_keyboard": []}},
        )


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
