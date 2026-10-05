"""Gom mọi số liệu của một người thân: hôm nay, 14 ngày gần nhất, cảnh báo, thuốc, huyết áp.

Dùng chung cho tin Telegram (/ba, /tongquan), câu hỏi gửi AI và báo cáo tuần,
để ba nơi luôn thấy cùng một bức tranh.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from statistics import mean
from zoneinfo import ZoneInfo

from . import db
from .models import SEVERITY_RANK

HISTORY_DAYS = 15  # đủ hai tuần trọn cho báo cáo tuần (so với tuần trước)
DAILY_FIELDS = ("resting_hr", "steps", "sleep_seconds", "deep_sleep_seconds", "sleep_score",
                "spo2_min", "body_battery", "stress_avg", "hrv_last_night")


def status_of(open_alerts: list[dict]) -> str:
    if any(a["metric"] in ("no_sync_hours", "no_live_minutes") for a in open_alerts):
        return "Mất kết nối"
    if any(SEVERITY_RANK[a["severity"]] >= SEVERITY_RANK["warn"] for a in open_alerts):
        return "Cần chú ý"
    return "Ổn định"


def elder_facts(conn, elder: dict, tz: str, now_utc: datetime) -> dict:
    zone = ZoneInfo(tz)
    local = now_utc.astimezone(zone)
    today = local.date()
    eid = str(elder["id"])
    snap = db.snapshot_from_db(conn, elder, today, now_utc)
    live = conn.execute("select * from live_status where elder_id = %s", (eid,)).fetchone() or {}
    daily = conn.execute(
        f"select day, {', '.join(DAILY_FIELDS)} from daily_metrics "
        "where elder_id = %s and day > %s order by day",
        (eid, today - timedelta(days=HISTORY_DAYS)),
    ).fetchall()
    readings = conn.execute(
        """
        select kind, systolic, diastolic, pulse, value, measured_at from readings
        where elder_id = %s and measured_at > %s order by measured_at desc limit 30
        """,
        (eid, now_utc - timedelta(days=HISTORY_DAYS)),
    ).fetchall()
    open_alerts = conn.execute(
        """
        select a.metric, a.severity, a.message, a.opened_at, c.display_name as acked_by
        from alerts a left join caregivers c on c.id = a.acked_by
        where a.elder_id = %s and a.resolved_at is null order by a.opened_at desc
        """,
        (eid,),
    ).fetchall()
    recent_alerts = conn.execute(
        """
        select metric, severity, message, opened_at, resolved_at from alerts
        where elder_id = %s and opened_at > %s order by opened_at desc limit 30
        """,
        (eid, now_utc - timedelta(days=HISTORY_DAYS)),
    ).fetchall()
    meds_today = conn.execute(
        """
        select s.name, s.note, t::text as at, l.taken_at
        from med_schedules s cross join lateral unnest(s.times) t
        left join med_logs l on l.schedule_id = s.id
             and l.due_at = (%s::date + t) at time zone %s
        where s.elder_id = %s and s.active order by t
        """,
        (today, tz, eid),
    ).fetchall()
    meds_taken = conn.execute(
        """
        select count(*) filter (where l.taken_at is not null) as taken, count(*) as due
        from med_logs l join med_schedules s on s.id = l.schedule_id
        where s.elder_id = %s and l.due_at > %s and l.due_at < %s
        """,
        (eid, now_utc - timedelta(days=7), now_utc - timedelta(minutes=60)),
    ).fetchone()
    device = conn.execute(
        "select label, battery, last_seen_at from watch_devices where elder_id = %s "
        "order by last_seen_at desc nulls last limit 1",
        (eid,),
    ).fetchone()
    return {
        "id": eid,
        "name": elder["display_name"],
        "command": elder.get("command"),
        "birth_year": elder.get("birth_year"),
        "conditions": list(elder.get("conditions") or []),
        "today": today,
        "now_local": local,
        "status": status_of(open_alerts),
        "snap": snap,
        "live": live,
        "daily": daily,
        "readings": readings,
        "open_alerts": open_alerts,
        "recent_alerts": recent_alerts,
        "meds_today": meds_today,
        "meds_7d": meds_taken,
        "device": device,
    }


def family_facts(conn, family: dict, now_utc: datetime) -> list[dict]:
    return [elder_facts(conn, e, family["timezone"], now_utc) for e in db.elders_of_family(conn, family["id"])]


# ---------- Tổng hợp theo tuần ----------

def _avg(rows: list[dict], key: str) -> float | None:
    vals = [r[key] for r in rows if r.get(key) is not None]
    return round(mean(vals), 1) if vals else None


def week_stats(f: dict, start: date, end: date) -> dict:
    """Trung bình các ngày trong [start, end] (gồm cả hai đầu) từ dữ liệu 14 ngày đã gom."""
    rows = [r for r in f["daily"] if start <= r["day"] <= end]
    bp = [r for r in f["readings"] if r["kind"] == "blood_pressure"
          and start <= r["measured_at"].astimezone(f["now_local"].tzinfo).date() <= end]
    glucose = [float(r["value"]) for r in f["readings"] if r["kind"] == "glucose"
               and start <= r["measured_at"].astimezone(f["now_local"].tzinfo).date() <= end]
    alerts = [a for a in f["recent_alerts"]
              if start <= a["opened_at"].astimezone(f["now_local"].tzinfo).date() <= end]
    spo2 = [r["spo2_min"] for r in rows if r.get("spo2_min") is not None]
    sleep, deep = _avg(rows, "sleep_seconds"), _avg(rows, "deep_sleep_seconds")
    return {
        "days_with_data": len(rows),
        "resting_hr": _avg(rows, "resting_hr"),
        "steps": _avg(rows, "steps"),
        "sleep_hours": round(sleep / 3600, 1) if sleep else None,
        "deep_sleep_hours": round(deep / 3600, 1) if deep else None,
        "sleep_score": _avg(rows, "sleep_score"),
        "spo2_lowest": min(spo2) if spo2 else None,
        "body_battery": _avg(rows, "body_battery"),
        "stress": _avg(rows, "stress_avg"),
        "hrv": _avg(rows, "hrv_last_night"),
        "bp_systolic": round(mean(r["systolic"] for r in bp)) if bp else None,
        "bp_diastolic": round(mean(r["diastolic"] for r in bp)) if bp else None,
        "bp_count": len(bp),
        "glucose": round(mean(glucose), 1) if glucose else None,
        "alerts": len(alerts),
        "alerts_high": sum(1 for a in alerts if SEVERITY_RANK.get(a["severity"], 0) >= SEVERITY_RANK["high"]),
    }


# ---------- Dạng gọn để gửi AI ----------

def _iso(v):
    if isinstance(v, (datetime, date)):
        return v.isoformat(timespec="minutes") if isinstance(v, datetime) else v.isoformat()
    return v


def for_ai(f: dict) -> dict:
    """Bản JSON gọn của elder_facts, đủ để AI trả lời mà không lộ mã nội bộ."""
    s = f["snap"]
    live = f["live"]
    return {
        "ten": f["name"],
        "nam_sinh": f["birth_year"],
        "benh_nen": f["conditions"],
        "trang_thai": f["status"],
        "bay_gio": {
            "gio_dia_phuong": _iso(f["now_local"]),
            "nhip_tim_hien_tai": s.hr_now,
            "nhip_tim_nghi": s.resting_hr,
            "cang_thang_1h": live.get("stress_1h"),
            "body_battery": s.body_battery,
            "spo2": live.get("spo2"),
            "nhip_tho": live.get("respiration"),
            "buoc_chan_hom_nay": s.steps,
            "calo": live.get("calories"),
            "quang_duong_m": live.get("distance_m"),
            "phut_van_dong": live.get("active_min"),
            "dong_ho_gui_luc": _iso(s.last_live_at),
            "pin_dong_ho": s.watch_battery,
            "dang_sac": s.charging,
        },
        "hang_ngay_14_ngay": [{k: _iso(v) for k, v in r.items()} for r in f["daily"]],
        "chi_so_nhap_tay": [{k: _iso(v) for k, v in r.items() if v is not None} for r in f["readings"]],
        "canh_bao_dang_mo": [{k: _iso(v) for k, v in a.items()} for a in f["open_alerts"]],
        "canh_bao_14_ngay": [{k: _iso(v) for k, v in a.items()} for a in f["recent_alerts"]],
        "thuoc_hom_nay": [{"ten": m["name"], "ghi_chu": m["note"], "gio": m["at"][:5],
                           "da_uong": m["taken_at"] is not None} for m in f["meds_today"]],
        "uong_thuoc_7_ngay": dict(f["meds_7d"]) if f["meds_7d"] else None,
    }
