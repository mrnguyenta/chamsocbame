"""Giờ yên lặng và leo thang cảnh báo khi không ai nhận xử lý."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time
from typing import Literal

from .models import SEVERITY_RANK, OpenAlert

Action = Literal["group", "nearest_caregiver", "call"]


@dataclass(frozen=True)
class EscalationStep:
    after_minutes: int
    action: Action


# Bước 0 gửi ngay khi mở cảnh báo; các bước sau chỉ áp dụng cho mức Cao/Khẩn cấp.
DEFAULT_STEPS: tuple[EscalationStep, ...] = (
    EscalationStep(0, "group"),
    EscalationStep(10, "nearest_caregiver"),
    EscalationStep(20, "call"),
)


def in_quiet_hours(local_now: datetime, start: time, end: time) -> bool:
    t = local_now.timetz().replace(tzinfo=None)
    if start <= end:
        return start <= t < end
    return t >= start or t < end  # khoảng qua nửa đêm, ví dụ 22:00–06:00


def should_notify_now(severity: str, local_now: datetime, start: time, end: time) -> bool:
    """Trong giờ yên lặng chỉ gửi cảnh báo Khẩn cấp; còn lại để dành đến sáng."""
    if severity == "urgent":
        return True
    return not in_quiet_hours(local_now, start, end)


def due_steps(
    alert: OpenAlert, now: datetime, steps: tuple[EscalationStep, ...] = DEFAULT_STEPS
) -> list[tuple[int, EscalationStep]]:
    """Các bước leo thang (chỉ số, bước) đến hạn mà chưa thực hiện.

    Thời gian tính từ lúc gửi tin đầu tiên, nên cảnh báo bị giữ lại trong giờ
    yên lặng sẽ không leo thang dồn dập ngay khi hết giờ yên lặng.
    """
    if alert.acked_at is not None:
        return []
    if alert.snoozed_until is not None and now < alert.snoozed_until:
        return []
    if alert.notified_at is None:
        return [(0, steps[0])] if alert.escalation_step == 0 else []
    if SEVERITY_RANK[alert.severity] < SEVERITY_RANK["high"]:
        return []
    age_min = (now - alert.notified_at).total_seconds() / 60
    return [
        (idx, step)
        for idx, step in enumerate(steps)
        if idx >= max(alert.escalation_step, 1) and age_min >= step.after_minutes
    ]
