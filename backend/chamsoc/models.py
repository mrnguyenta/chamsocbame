"""Kiểu dữ liệu dùng chung, không phụ thuộc cơ sở dữ liệu hay Garmin."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time
from typing import Literal

Severity = Literal["info", "warn", "high", "urgent"]
SEVERITY_RANK: dict[str, int] = {"info": 0, "warn": 1, "high": 2, "urgent": 3}


@dataclass
class Snapshot:
    """Trạng thái mới nhất của một người thân trong ngày `day`."""

    elder_id: str
    elder_name: str
    day: date
    resting_hr: int | None = None
    max_hr: int | None = None
    min_hr: int | None = None
    steps: int | None = None
    sleep_seconds: int | None = None
    deep_sleep_seconds: int | None = None
    sleep_score: int | None = None
    spo2_avg: int | None = None
    spo2_min: int | None = None
    body_battery: int | None = None
    stress_avg: int | None = None
    respiration_avg: float | None = None
    last_device_upload_at: datetime | None = None
    systolic: int | None = None
    diastolic: int | None = None
    glucose: float | None = None
    # Dữ liệu gửi thẳng từ đồng hồ (ứng dụng Connect IQ), gần thời gian thực.
    hr_now: int | None = None           # trung vị nhịp tim 10 phút gần nhất
    active_recently: bool = False       # vừa đi lại nhiều trong 10 phút gần nhất
    last_live_at: datetime | None = None
    watch_battery: int | None = None


@dataclass
class Rule:
    id: str
    elder_id: str
    metric: str
    comparator: Literal["gt", "lt"]
    threshold: float
    severity: Severity = "warn"
    active_after: time | None = None
    notify: Literal["family", "elder"] = "family"
    enabled: bool = True


@dataclass
class AlertCandidate:
    rule: Rule
    value: float
    dedupe_key: str
    message: str


@dataclass
class OpenAlert:
    id: str
    elder_id: str
    elder_name: str
    severity: Severity
    message: str
    opened_at: datetime
    escalation_step: int = 0
    notified_at: datetime | None = None
    acked_at: datetime | None = None
    snoozed_until: datetime | None = None
    rule_notify: str = "family"
