"""Đọc dữ liệu một ngày từ Garmin Connect và chuyển thành Snapshot.

Dùng thư viện không chính thức python-garminconnect. Garmin có thể đổi cách
đăng nhập bất kỳ lúc nào; khi đó cập nhật thư viện là việc đầu tiên cần làm.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Any

from garminconnect import Garmin

from .models import Snapshot

log = logging.getLogger(__name__)


def login_with_tokens(token_json: str) -> Garmin:
    client = Garmin()
    client.login(token_json)
    return client


def current_tokens(client: Garmin) -> str:
    """Token có thể được làm mới trong lúc gọi API; lưu lại sau mỗi lần đồng bộ."""
    return client.client.dumps()


def _safe(fn, *args) -> Any:
    try:
        return fn(*args)
    except Exception as e:  # một chỉ số lỗi không được làm hỏng cả lần đồng bộ
        log.warning("Garmin %s lỗi: %s", getattr(fn, "__name__", fn), e)
        return None


def _ms_to_dt(ms: Any) -> datetime | None:
    if not isinstance(ms, (int, float)) or ms <= 0:
        return None
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc)


def _iso_to_dt(s: Any) -> datetime | None:
    if not isinstance(s, str) or not s:
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def blood_pressure_measurements(raw: dict | None) -> list[dict]:
    """Các lần đo huyết áp (ví dụ từ máy Garmin Index BPM), cũ trước mới sau."""
    out = []
    for day_summary in (raw or {}).get("measurementSummaries") or []:
        for m in day_summary.get("measurements") or []:
            if not m.get("systolic") or not m.get("diastolic"):
                continue
            out.append({
                "systolic": m["systolic"],
                "diastolic": m["diastolic"],
                "pulse": m.get("pulse"),
                "measured_at": _iso_to_dt(m.get("measurementTimestampGMT")),
                "external_id": str(m.get("measurementTimestampGMT")
                                   or f"{m['systolic']}/{m['diastolic']}"),
            })
    out.sort(key=lambda m: m["measured_at"] or datetime.min.replace(tzinfo=timezone.utc))
    return out


def build_snapshot(
    elder_id: str,
    elder_name: str,
    day: date,
    summary: dict | None,
    sleep: dict | None,
    spo2: dict | None,
    device: dict | None,
    blood_pressure: dict | None,
) -> Snapshot:
    """Tách riêng khỏi lời gọi mạng để kiểm thử bằng dữ liệu mẫu."""
    summary = summary or {}
    dto = (sleep or {}).get("dailySleepDTO") or {}
    spo2 = spo2 or {}
    device = device or {}

    upload = _ms_to_dt(device.get("lastUsedDeviceUploadTime")) or _iso_to_dt(
        summary.get("lastSyncTimestampGMT")
    )

    bp = blood_pressure_measurements(blood_pressure)
    systolic, diastolic = (bp[-1]["systolic"], bp[-1]["diastolic"]) if bp else (None, None)

    score = ((dto.get("sleepScores") or {}).get("overall") or {}).get("value")
    stress = summary.get("averageStressLevel")  # Garmin trả -1/-2 khi không đủ dữ liệu
    return Snapshot(
        elder_id=elder_id,
        elder_name=elder_name,
        day=day,
        resting_hr=summary.get("restingHeartRate"),
        max_hr=summary.get("maxHeartRate"),
        min_hr=summary.get("minHeartRate"),
        steps=summary.get("totalSteps"),
        sleep_seconds=dto.get("sleepTimeSeconds"),
        deep_sleep_seconds=dto.get("deepSleepSeconds"),
        sleep_score=score,
        spo2_avg=spo2.get("averageSpO2"),
        spo2_min=spo2.get("lowestSpO2"),
        body_battery=summary.get("bodyBatteryMostRecentValue"),
        stress_avg=stress if isinstance(stress, int) and stress >= 0 else None,
        respiration_avg=summary.get("avgWakingRespirationValue"),
        last_device_upload_at=upload,
        systolic=systolic,
        diastolic=diastolic,
    )


def fetch_snapshot(client: Garmin, elder_id: str, elder_name: str, day: date) -> tuple[Snapshot, dict]:
    d = day.isoformat()
    raw = {
        "summary": _safe(client.get_user_summary, d),
        "sleep": _safe(client.get_sleep_data, d),
        "spo2": _safe(client.get_spo2_data, d),
        "device": _safe(client.get_device_last_used),
        "blood_pressure": _safe(client.get_blood_pressure, d),
    }
    snap = build_snapshot(elder_id, elder_name, day, **raw)
    return snap, raw
