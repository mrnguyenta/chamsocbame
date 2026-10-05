"""Bộ quy tắc cảnh báo: hàm thuần, dễ kiểm thử."""

from __future__ import annotations

from datetime import datetime

from .models import AlertCandidate, Rule, Snapshot

# Tên hiển thị, đơn vị và cách đọc giá trị từ Snapshot cho từng chỉ số.
METRICS: dict[str, tuple[str, str]] = {
    "resting_hr": ("Nhịp tim nghỉ", "bpm"),
    "spo2_min": ("SpO2 thấp nhất", "%"),
    "sleep_hours": ("Giấc ngủ", "giờ"),
    "steps": ("Bước chân", "bước"),
    "body_battery": ("Body Battery", ""),
    "stress_avg": ("Stress trung bình", ""),
    "no_sync_hours": ("Chưa có dữ liệu mới", "giờ"),
    "systolic": ("Huyết áp tâm thu", "mmHg"),
    "diastolic": ("Huyết áp tâm trương", "mmHg"),
    "glucose": ("Đường huyết", "mmol/L"),
}


def metric_value(snapshot: Snapshot, metric: str, now: datetime) -> float | None:
    if metric == "sleep_hours":
        if snapshot.sleep_seconds is None:
            return None
        return round(snapshot.sleep_seconds / 3600, 1)
    if metric == "no_sync_hours":
        if snapshot.last_device_upload_at is None:
            return None
        return round((now - snapshot.last_device_upload_at).total_seconds() / 3600, 1)
    return getattr(snapshot, metric)


def _fmt(value: float) -> str:
    if float(value).is_integer():
        return f"{int(value):,}".replace(",", ".")
    return f"{value:.1f}".replace(".", ",")


def describe(rule: Rule, value: float) -> str:
    label, unit = METRICS[rule.metric]
    sign = ">" if rule.comparator == "gt" else "<"
    unit_s = f" {unit}" if unit else ""
    return f"{label} {_fmt(value)}{unit_s} (ngưỡng {sign} {_fmt(rule.threshold)}{unit_s})"


def dedupe_key(rule: Rule, snapshot: Snapshot) -> str:
    # Mất kết nối là trạng thái kéo dài qua nhiều ngày, không gắn với ngày.
    if rule.metric == "no_sync_hours":
        return f"{rule.id}"
    return f"{rule.id}:{snapshot.day.isoformat()}"


def evaluate(snapshot: Snapshot, rules: list[Rule], now: datetime) -> list[AlertCandidate]:
    """Trả về các cảnh báo đang vi phạm. `now` là giờ địa phương có múi giờ."""
    out: list[AlertCandidate] = []
    for rule in rules:
        if not rule.enabled or rule.elder_id != snapshot.elder_id:
            continue
        if rule.active_after is not None and now.timetz().replace(tzinfo=None) < rule.active_after:
            continue
        value = metric_value(snapshot, rule.metric, now)
        if value is None:
            continue
        breached = value > rule.threshold if rule.comparator == "gt" else value < rule.threshold
        if breached:
            out.append(
                AlertCandidate(
                    rule=rule,
                    value=float(value),
                    dedupe_key=dedupe_key(rule, snapshot),
                    message=describe(rule, float(value)),
                )
            )
    return out


def default_rules(elder_id: str, conditions: list[str]) -> list[dict]:
    """Bộ ngưỡng gợi ý ban đầu cho người cao tuổi. Gia đình chỉnh lại trên web."""
    rules = [
        dict(metric="resting_hr", comparator="gt", threshold=90, severity="high"),
        dict(metric="resting_hr", comparator="lt", threshold=45, severity="high"),
        dict(metric="spo2_min", comparator="lt", threshold=90, severity="high"),
        dict(metric="no_sync_hours", comparator="gt", threshold=12, severity="warn"),
        dict(metric="sleep_hours", comparator="lt", threshold=5, severity="warn",
             active_after="10:00"),
        dict(metric="steps", comparator="lt", threshold=1000, severity="info",
             active_after="18:00", notify="elder"),
        dict(metric="body_battery", comparator="lt", threshold=15, severity="warn",
             enabled=False),
        dict(metric="stress_avg", comparator="gt", threshold=60, severity="warn",
             enabled=False),
    ]
    if "tang_huyet_ap" in conditions or "tim_mach" in conditions:
        rules += [
            dict(metric="systolic", comparator="gt", threshold=160, severity="high"),
            dict(metric="systolic", comparator="lt", threshold=90, severity="high"),
            dict(metric="diastolic", comparator="gt", threshold=100, severity="high"),
        ]
    if "tieu_duong" in conditions:
        rules += [
            dict(metric="glucose", comparator="gt", threshold=13.9, severity="high"),
            dict(metric="glucose", comparator="lt", threshold=3.9, severity="urgent"),
        ]
    for r in rules:
        r["elder_id"] = elder_id
        r.setdefault("enabled", True)
        r.setdefault("notify", "family")
        r.setdefault("active_after", None)
    return rules
