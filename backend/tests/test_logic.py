from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest

from chamsoc import crypto, rules, telegram
from chamsoc.escalation import due_steps, in_quiet_hours, should_notify_now
from chamsoc.garmin_sync import build_snapshot
from chamsoc.models import OpenAlert, Rule, Snapshot

VN = ZoneInfo("Asia/Ho_Chi_Minh")


def snap(**kw) -> Snapshot:
    return Snapshot(elder_id="e1", elder_name="Mẹ Lan", day=date(2026, 10, 5), **kw)


def rule(metric, comparator, threshold, **kw) -> Rule:
    return Rule(id=f"r-{metric}-{comparator}", elder_id="e1", metric=metric,
                comparator=comparator, threshold=threshold, **kw)


# ---------- rules ----------

def test_high_resting_hr_breaches():
    now = datetime(2026, 10, 5, 7, 0, tzinfo=VN)
    found = rules.evaluate(snap(resting_hr=98), [rule("resting_hr", "gt", 90, severity="high")], now)
    assert len(found) == 1
    assert found[0].message == "Nhịp tim nghỉ 98 bpm (ngưỡng > 90 bpm)"
    assert found[0].dedupe_key == "r-resting_hr-gt:2026-10-05"


def test_missing_value_and_disabled_rules_are_ignored():
    now = datetime(2026, 10, 5, 7, 0, tzinfo=VN)
    rs = [rule("resting_hr", "gt", 90), rule("spo2_min", "lt", 90, enabled=False)]
    assert rules.evaluate(snap(spo2_min=85), rs, now) == []


def test_active_after_delays_step_check():
    r = rule("steps", "lt", 1000, active_after=time(18, 0))
    s = snap(steps=400)
    assert rules.evaluate(s, [r], datetime(2026, 10, 5, 12, 0, tzinfo=VN)) == []
    assert len(rules.evaluate(s, [r], datetime(2026, 10, 5, 18, 5, tzinfo=VN))) == 1


def test_no_sync_hours_uses_last_upload_and_has_dayless_key():
    now = datetime(2026, 10, 5, 9, 0, tzinfo=VN)
    s = snap(last_device_upload_at=now - timedelta(hours=26))
    [c] = rules.evaluate(s, [rule("no_sync_hours", "gt", 12)], now)
    assert c.value == 26.0
    assert c.dedupe_key == "r-no_sync_hours-gt"


def test_sleep_hours_formats_decimal_comma():
    now = datetime(2026, 10, 5, 11, 0, tzinfo=VN)
    [c] = rules.evaluate(snap(sleep_seconds=4 * 3600 + 55 * 60), [rule("sleep_hours", "lt", 5)], now)
    assert c.message == "Giấc ngủ 4,9 giờ (ngưỡng < 5 giờ)"


def test_default_rules_follow_conditions():
    base = rules.default_rules("e1", [])
    bp = rules.default_rules("e1", ["tang_huyet_ap"])
    dm = rules.default_rules("e1", ["tieu_duong"])
    assert not any(r["metric"] == "systolic" for r in base)
    assert any(r["metric"] == "systolic" for r in bp)
    assert any(r["metric"] == "glucose" and r["severity"] == "urgent" for r in dm)
    assert all(r["elder_id"] == "e1" for r in base)


# ---------- escalation ----------

def test_quiet_hours_across_midnight():
    q = (time(22, 0), time(6, 0))
    assert in_quiet_hours(datetime(2026, 10, 5, 23, 0, tzinfo=VN), *q)
    assert in_quiet_hours(datetime(2026, 10, 5, 5, 59, tzinfo=VN), *q)
    assert not in_quiet_hours(datetime(2026, 10, 5, 6, 0, tzinfo=VN), *q)
    assert should_notify_now("urgent", datetime(2026, 10, 5, 2, 0, tzinfo=VN), *q)
    assert not should_notify_now("high", datetime(2026, 10, 5, 2, 0, tzinfo=VN), *q)


def _alert(**kw) -> OpenAlert:
    base = dict(id="a1", elder_id="e1", elder_name="Mẹ Lan", severity="high", message="m",
                opened_at=datetime(2026, 10, 5, 6, 0, tzinfo=timezone.utc))
    base.update(kw)
    return OpenAlert(**base)


def test_first_notification_then_escalation_by_time_since_notified():
    t0 = datetime(2026, 10, 5, 6, 0, tzinfo=timezone.utc)
    assert [i for i, _ in due_steps(_alert(), t0)] == [0]
    notified = _alert(escalation_step=1, notified_at=t0)
    assert due_steps(notified, t0 + timedelta(minutes=5)) == []
    assert [s.action for _, s in due_steps(notified, t0 + timedelta(minutes=10))] == ["nearest_caregiver"]
    assert [s.action for _, s in due_steps(notified, t0 + timedelta(minutes=25))] == ["nearest_caregiver", "call"]
    done = _alert(escalation_step=3, notified_at=t0)
    assert due_steps(done, t0 + timedelta(hours=1)) == []


def test_low_severity_does_not_escalate_and_ack_or_snooze_stops():
    t0 = datetime(2026, 10, 5, 6, 0, tzinfo=timezone.utc)
    later = t0 + timedelta(hours=1)
    assert due_steps(_alert(severity="warn", escalation_step=1, notified_at=t0), later) == []
    assert due_steps(_alert(escalation_step=1, notified_at=t0, acked_at=t0), later) == []
    assert due_steps(_alert(escalation_step=1, notified_at=t0,
                            snoozed_until=later + timedelta(minutes=1)), later) == []


# ---------- telegram ----------

@pytest.mark.parametrize("text,expected", [
    ("130/85", ("blood_pressure", 130, 85, None, None)),
    ("HA 145 / 92 78", ("blood_pressure", 145, 92, 78, None)),
    ("huyết áp 120/80", ("blood_pressure", 120, 80, None, None)),
    ("đường 7.2", ("glucose", None, None, None, 7.2)),
    ("Đường huyết 5,6", ("glucose", None, None, None, 5.6)),
    ("cân 58,5 kg", ("weight", None, None, None, 58.5)),
])
def test_parse_reading(text, expected):
    r = telegram.parse_reading(text)
    assert (r.kind, r.systolic, r.diastolic, r.pulse, r.value) == expected


@pytest.mark.parametrize("text", ["xin chào", "85/130", "300/80", "đường 80", "cân 5"])
def test_parse_reading_rejects_nonsense(text):
    assert telegram.parse_reading(text) is None


def test_messages_escape_html():
    t = telegram.alert_text("Ba <Hùng>", "high", "a & b", datetime(2026, 10, 5, 6, 15))
    assert "Ba &lt;Hùng&gt;" in t and "a &amp; b" in t and "CẢNH BÁO CAO" in t
    line = telegram.snapshot_lines(snap(resting_hr=62, steps=4820, sleep_seconds=24000), "Ổn định")
    assert "Ngủ 6g40" in line and "Bước chân 4.820" in line


class FakeHttp:
    def __init__(self):
        self.calls = []

    def post(self, url, json):
        self.calls.append((url, json))

        class R:
            def raise_for_status(self):
                pass

            def json(self):
                return {"result": {"message_id": 1}}

        return R()


def test_client_builds_inline_keyboard():
    http = FakeHttp()
    telegram.TelegramClient("TOKEN", http).send(42, "hi", telegram.alert_buttons("a1"))
    url, payload = http.calls[0]
    assert url.endswith("/botTOKEN/sendMessage")
    assert payload["reply_markup"]["inline_keyboard"][0][0] == {"text": "Tôi xử lý", "callback_data": "ack:a1"}


# ---------- garmin ----------

def test_build_snapshot_from_garmin_payloads():
    s = build_snapshot(
        "e1", "Ba", date(2026, 10, 5),
        summary={"restingHeartRate": 62, "totalSteps": 4820, "bodyBatteryMostRecentValue": 45,
                 "averageStressLevel": -1},
        sleep={"dailySleepDTO": {"sleepTimeSeconds": 24000, "deepSleepSeconds": 4200,
                                 "sleepScores": {"overall": {"value": 72}}}},
        spo2={"averageSpO2": 96, "lowestSpO2": 92},
        device={"lastUsedDeviceUploadTime": 1791100000000},
        blood_pressure={"measurementSummaries": [{"measurements": [
            {"systolic": 145, "diastolic": 90, "measurementTimestampGMT": "2026-10-04T23:35:00.0"},
            {"systolic": 132, "diastolic": 84, "measurementTimestampGMT": "2026-10-05T00:40:00.0"},
        ]}]},
        hrv={"hrvSummary": {"lastNightAvg": 38, "status": "BALANCED"}},
    )
    assert (s.resting_hr, s.steps, s.sleep_score, s.spo2_min, s.body_battery) == (62, 4820, 72, 92, 45)
    assert s.stress_avg is None
    assert (s.systolic, s.diastolic) == (132, 84)
    assert s.hrv_last_night == 38
    assert s.last_device_upload_at == datetime.fromtimestamp(1791100000, tz=timezone.utc)


def test_build_snapshot_tolerates_missing_data():
    s = build_snapshot("e1", "Ba", date(2026, 10, 5), None, None, None, None, None)
    assert s.resting_hr is None and s.last_device_upload_at is None


def test_crypto_roundtrip():
    key = crypto.generate_key()
    assert crypto.decrypt(key, crypto.encrypt(key, '{"t": 1}')) == '{"t": 1}'


# ---------- dữ liệu trực tiếp từ đồng hồ ----------

def test_hr_now_skipped_while_walking_and_live_keys_are_dayless():
    now = datetime(2026, 10, 5, 9, 0, tzinfo=VN)
    hi = rule("hr_now", "gt", 120, severity="high")
    assert len(rules.evaluate(snap(hr_now=130), [hi], now)) == 1
    assert rules.evaluate(snap(hr_now=130, active_recently=True), [hi], now) == []
    lo = rule("hr_now", "lt", 40, severity="urgent")
    assert len(rules.evaluate(snap(hr_now=35, active_recently=True), [lo], now)) == 1

    stale = rule("no_live_minutes", "gt", 30)
    [c] = rules.evaluate(snap(last_live_at=now - timedelta(minutes=47)), [stale], now)
    assert c.value == 47 and c.dedupe_key == stale.id
    assert rules.evaluate(snap(), [stale], now) == []  # chưa cài ứng dụng đồng hồ


# ---------- ngồi im lâu / không đeo đồng hồ / căng thẳng ----------

def test_inactive_for_hours_in_daytime_breaches():
    now = datetime(2026, 10, 5, 14, 0, tzinfo=VN)
    s = snap(last_live_at=now - timedelta(minutes=3), last_hr_at=now - timedelta(minutes=2),
             last_move_at=now - timedelta(hours=4))
    found = rules.evaluate(s, [rule("inactive_minutes", "gt", 180)], now)
    assert len(found) == 1 and found[0].value == 240
    assert found[0].message == "Ngồi/nằm im không đi lại 240 phút (ngưỡng > 180 phút)"


def test_inactive_counts_from_7am_and_not_at_night_or_charging_or_unworn():
    r = [rule("inactive_minutes", "gt", 180)]
    morning = datetime(2026, 10, 5, 9, 0, tzinfo=VN)
    base = dict(last_live_at=morning - timedelta(minutes=3), last_hr_at=morning - timedelta(minutes=1),
                last_move_at=morning - timedelta(hours=12))  # ngủ từ tối qua
    assert rules.evaluate(snap(**base), r, morning) == []            # mới 120 phút kể từ 7 giờ
    night = datetime(2026, 10, 5, 23, 0, tzinfo=VN)
    assert rules.evaluate(snap(last_live_at=night, last_hr_at=night, last_move_at=night - timedelta(hours=6)),
                          r, night) == []
    noon = datetime(2026, 10, 5, 13, 0, tzinfo=VN)
    long_ago = dict(last_live_at=noon, last_move_at=noon - timedelta(hours=5))
    assert rules.evaluate(snap(**long_ago, last_hr_at=noon, charging=True), r, noon) == []
    assert rules.evaluate(snap(**long_ago, last_hr_at=noon - timedelta(hours=1)), r, noon) == []  # không đeo


def test_not_worn_but_watch_still_sending():
    now = datetime(2026, 10, 5, 15, 0, tzinfo=VN)
    r = [rule("not_worn_minutes", "gt", 90)]
    s = snap(last_live_at=now - timedelta(minutes=4), last_hr_at=now - timedelta(minutes=120))
    assert [c.value for c in rules.evaluate(s, r, now)] == [120]
    # Mất kết nối (đồng hồ không gửi) thì là cảnh báo khác, không báo "không đeo".
    s2 = snap(last_live_at=now - timedelta(hours=2), last_hr_at=now - timedelta(hours=2))
    assert rules.evaluate(s2, r, now) == []
    assert rules.evaluate(snap(last_live_at=now, last_hr_at=None, charging=True), r, now) == []
    # Vừa kết nối, chưa có mẫu nhịp tim nào: đếm từ lần gửi đầu tiên, không phải từ 7 giờ sáng.
    assert rules.evaluate(snap(last_live_at=now, first_live_at=now - timedelta(minutes=5)), r, now) == []


def test_stress_hour_average():
    now = datetime(2026, 10, 5, 10, 0, tzinfo=VN)
    found = rules.evaluate(snap(stress_1h=86), [rule("stress_1h", "gt", 80)], now)
    assert found and found[0].dedupe_key == "r-stress_1h-gt"
