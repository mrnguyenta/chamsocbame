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
    "hr_now": ("Nhịp tim hiện tại (10 phút)", "bpm"),
    "no_live_minutes": ("Đồng hồ chưa gửi dữ liệu", "phút"),
    "watch_battery": ("Pin đồng hồ", "%"),
    "inactive_minutes": ("Ngồi/nằm im không đi lại", "phút"),
    "not_worn_minutes": ("Không đeo đồng hồ", "phút"),
    "stress_1h": ("Căng thẳng trung bình 1 giờ", ""),
}

# Ngồi im / không đeo đồng hồ chỉ tính ban ngày (giờ địa phương), ban đêm ngủ là bình thường.
DAY_START_HOUR, DAY_END_HOUR = 7, 21
# Đồng hồ phải còn gửi dữ liệu gần đây thì mới kết luận ngồi im / không đeo (khác với mất kết nối).
LIVE_FRESH_MINUTES = 20

# Trạng thái kéo dài, không gắn với ngày.
DAYLESS_METRICS = {"no_sync_hours", "no_live_minutes", "watch_battery", "inactive_minutes",
                   "not_worn_minutes", "stress_1h"}


def _minutes(delta) -> float:
    return float(max(0, int(delta.total_seconds() // 60)))


def _daytime_live(snapshot: Snapshot, now: datetime) -> bool:
    if not (DAY_START_HOUR <= now.hour < DAY_END_HOUR) or snapshot.charging:
        return False
    return snapshot.last_live_at is not None and _minutes(now - snapshot.last_live_at) <= LIVE_FRESH_MINUTES


def metric_value(snapshot: Snapshot, metric: str, now: datetime) -> float | None:
    if metric == "sleep_hours":
        if snapshot.sleep_seconds is None:
            return None
        return round(snapshot.sleep_seconds / 3600, 1)
    if metric == "no_sync_hours":
        if snapshot.last_device_upload_at is None:
            return None
        return round((now - snapshot.last_device_upload_at).total_seconds() / 3600, 1)
    if metric == "no_live_minutes":
        if snapshot.last_live_at is None:
            return None
        return float(int((now - snapshot.last_live_at).total_seconds() // 60))
    if metric == "inactive_minutes":
        # Chỉ khi đang đeo đồng hồ (có nhịp tim gần đây) và đồng hồ vẫn gửi đều.
        if snapshot.last_move_at is None or not _daytime_live(snapshot, now):
            return None
        if snapshot.last_hr_at is None or _minutes(now - snapshot.last_hr_at) > LIVE_FRESH_MINUTES:
            return None
        day_start = now.replace(hour=DAY_START_HOUR, minute=0, second=0, microsecond=0)
        return _minutes(now - max(snapshot.last_move_at, day_start))
    if metric == "not_worn_minutes":
        if not _daytime_live(snapshot, now):
            return None
        day_start = now.replace(hour=DAY_START_HOUR, minute=0, second=0, microsecond=0)
        since = snapshot.last_hr_at or snapshot.first_live_at  # vừa kết nối, chưa có nhịp tim: đếm từ lần gửi đầu
        if since is None:
            return None
        return _minutes(now - max(since, day_start))
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
    if rule.metric in DAYLESS_METRICS:
        return f"{rule.id}"
    return f"{rule.id}:{snapshot.day.isoformat()}"


def checkable_value(rule: Rule, snapshot: Snapshot, now: datetime) -> float | None:
    """Giá trị để so với ngưỡng, hoặc None nếu lúc này chưa kiểm được quy tắc này."""
    if not rule.enabled or rule.elder_id != snapshot.elder_id:
        return None
    if rule.active_after is not None and now.timetz().replace(tzinfo=None) < rule.active_after:
        return None
    # Nhịp tim cao khi đang đi lại là bình thường, không báo.
    if rule.metric == "hr_now" and rule.comparator == "gt" and snapshot.active_recently:
        return None
    value = metric_value(snapshot, rule.metric, now)
    return None if value is None else float(value)


def evaluate(snapshot: Snapshot, rules: list[Rule], now: datetime) -> list[AlertCandidate]:
    """Trả về các cảnh báo đang vi phạm. `now` là giờ địa phương có múi giờ."""
    out: list[AlertCandidate] = []
    for rule in rules:
        value = checkable_value(rule, snapshot, now)
        if value is None:
            continue
        breached = value > rule.threshold if rule.comparator == "gt" else value < rule.threshold
        if breached:
            out.append(
                AlertCandidate(
                    rule=rule,
                    value=value,
                    dedupe_key=dedupe_key(rule, snapshot),
                    message=describe(rule, value),
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
        # Ba quy tắc dưới chỉ chạy khi đồng hồ có cài ứng dụng gửi dữ liệu trực tiếp.
        dict(metric="hr_now", comparator="gt", threshold=120, severity="high"),
        dict(metric="hr_now", comparator="lt", threshold=40, severity="urgent"),
        dict(metric="no_live_minutes", comparator="gt", threshold=30, severity="warn"),
        dict(metric="watch_battery", comparator="lt", threshold=15, severity="info",
             notify="elder"),
        dict(metric="inactive_minutes", comparator="gt", threshold=180, severity="warn"),
        dict(metric="not_worn_minutes", comparator="gt", threshold=90, severity="info"),
        dict(metric="stress_1h", comparator="gt", threshold=80, severity="warn"),
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
