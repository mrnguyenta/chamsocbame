"""Truy vấn PostgreSQL (Supabase). Mỗi hàm nhận một kết nối psycopg."""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta
import psycopg
from psycopg.rows import dict_row

from .models import AlertCandidate, Rule, Snapshot


def connect(url: str) -> psycopg.Connection:
    # prepare_threshold=None: bắt buộc khi dùng pooler của Supabase (chế độ transaction).
    return psycopg.connect(url, row_factory=dict_row, autocommit=True, prepare_threshold=None)


# ---------- Garmin ----------

def garmin_accounts(conn) -> list[dict]:
    return conn.execute(
        """
        select g.elder_id, g.token_ciphertext, g.status, e.display_name, e.family_id,
               f.timezone, f.telegram_chat_id
        from garmin_accounts g
        join elders e on e.id = g.elder_id
        join families f on f.id = e.family_id
        where g.status <> 'needs_relogin'
        """
    ).fetchall()


def save_garmin_tokens(conn, elder_id: str, ciphertext: str) -> None:
    conn.execute(
        """
        insert into garmin_accounts (elder_id, token_ciphertext, status, updated_at)
        values (%s, %s, 'ok', now())
        on conflict (elder_id) do update
          set token_ciphertext = excluded.token_ciphertext, status = 'ok',
              last_error = null, updated_at = now()
        """,
        (elder_id, ciphertext),
    )


def mark_garmin_synced(conn, elder_id: str, upload_at: datetime | None) -> None:
    conn.execute(
        """
        update garmin_accounts
           set status = 'ok', last_error = null, last_sync_at = now(),
               last_device_upload_at = coalesce(%s, last_device_upload_at)
         where elder_id = %s
        """,
        (upload_at, elder_id),
    )


def mark_garmin_error(conn, elder_id: str, status: str, error: str) -> bool:
    """Trả về True nếu trạng thái vừa đổi (để chỉ báo cho quản trị một lần)."""
    row = conn.execute(
        """
        update garmin_accounts g
           set status = %s, last_error = %s, updated_at = now()
          from (select status as old_status from garmin_accounts where elder_id = %s) o
         where g.elder_id = %s
        returning o.old_status
        """,
        (status, error[:500], elder_id, elder_id),
    ).fetchone()
    return bool(row) and row["old_status"] != status


# ---------- Chỉ số ----------

def upsert_daily_metrics(conn, s: Snapshot, raw: dict) -> None:
    conn.execute(
        """
        insert into daily_metrics (elder_id, day, resting_hr, max_hr, min_hr, steps,
            sleep_seconds, deep_sleep_seconds, sleep_score, spo2_avg, spo2_min,
            body_battery, stress_avg, respiration_avg, raw, updated_at)
        values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
        on conflict (elder_id, day) do update set
            resting_hr = excluded.resting_hr, max_hr = excluded.max_hr,
            min_hr = excluded.min_hr, steps = excluded.steps,
            sleep_seconds = excluded.sleep_seconds,
            deep_sleep_seconds = excluded.deep_sleep_seconds,
            sleep_score = excluded.sleep_score, spo2_avg = excluded.spo2_avg,
            spo2_min = excluded.spo2_min, body_battery = excluded.body_battery,
            stress_avg = excluded.stress_avg, respiration_avg = excluded.respiration_avg,
            raw = excluded.raw, updated_at = now()
        """,
        (s.elder_id, s.day, s.resting_hr, s.max_hr, s.min_hr, s.steps, s.sleep_seconds,
         s.deep_sleep_seconds, s.sleep_score, s.spo2_avg, s.spo2_min, s.body_battery,
         s.stress_avg, s.respiration_avg, json.dumps(raw, default=str)),
    )


def insert_reading(conn, elder_id: str, kind: str, *, systolic=None, diastolic=None,
                   pulse=None, value=None, source="telegram", external_id=None,
                   measured_at: datetime | None = None) -> None:
    conn.execute(
        """
        insert into readings (elder_id, kind, systolic, diastolic, pulse, value, source,
                              external_id, measured_at)
        values (%s, %s, %s, %s, %s, %s, %s, %s, coalesce(%s, now()))
        on conflict (elder_id, source, external_id) do nothing
        """,
        (elder_id, kind, systolic, diastolic, pulse, value, source, external_id, measured_at),
    )


def merge_recent_readings(conn, s: Snapshot, since: datetime) -> Snapshot:
    """Bổ sung huyết áp / đường huyết nhập tay gần nhất vào Snapshot."""
    rows = conn.execute(
        """
        select distinct on (kind) kind, systolic, diastolic, value
        from readings
        where elder_id = %s and measured_at >= %s and kind in ('blood_pressure', 'glucose')
        order by kind, measured_at desc
        """,
        (s.elder_id, since),
    ).fetchall()
    for r in rows:
        if r["kind"] == "blood_pressure" and s.systolic is None:
            s.systolic, s.diastolic = r["systolic"], r["diastolic"]
        elif r["kind"] == "glucose":
            s.glucose = float(r["value"])
    return s


READINGS_LOOKBACK = timedelta(hours=24)
LIVE_WINDOW = timedelta(minutes=10)
MIN_HR_SAMPLES = 3  # cần vài số đo để không báo vì một lần đo lẻ
ACTIVE_STEPS = 300  # số bước trong 10 phút để coi là đang đi lại


def snapshot_from_db(conn, elder: dict, day: date, now_utc: datetime) -> Snapshot:
    m = conn.execute(
        "select * from daily_metrics where elder_id = %s and day = %s", (elder["id"], day)
    ).fetchone() or {}
    g = conn.execute(
        "select last_device_upload_at from garmin_accounts where elder_id = %s", (elder["id"],)
    ).fetchone() or {}
    fields = ("resting_hr", "max_hr", "min_hr", "steps", "sleep_seconds", "deep_sleep_seconds",
              "sleep_score", "spo2_avg", "spo2_min", "body_battery", "stress_avg")
    s = Snapshot(elder_id=str(elder["id"]), elder_name=elder["display_name"], day=day,
                 last_device_upload_at=g.get("last_device_upload_at"),
                 **{k: m.get(k) for k in fields})
    merge_live(conn, s, now_utc)
    return merge_recent_readings(conn, s, now_utc - READINGS_LOOKBACK)


# ---------- Dữ liệu trực tiếp từ đồng hồ ----------

def watch_device_by_key(conn, key_hash: str) -> dict | None:
    return conn.execute(
        """
        select w.id, w.elder_id, e.display_name, e.family_id, f.timezone
        from watch_devices w join elders e on e.id = w.elder_id join families f on f.id = e.family_id
        where w.key_hash = %s
        """,
        (key_hash,),
    ).fetchone()


def start_pairing(conn, code: str, key_hash: str, device: str | None) -> bool:
    """Tạo lần ghép mới; trả về False nếu mã đang bị một lần ghép khác giữ."""
    conn.execute("delete from watch_pairings where claimed_at is null and expires_at < now()")
    row = conn.execute(
        """
        insert into watch_pairings (code, key_hash, device) values (%s, %s, %s)
        on conflict (code) where claimed_at is null do nothing
        returning id
        """,
        (code, key_hash, device),
    ).fetchone()
    return row is not None


def pairing_status(conn, key_hash: str) -> dict | None:
    return conn.execute(
        """
        select p.claimed_at, p.expires_at < now() as expired, e.display_name
        from watch_pairings p
        left join watch_devices w on w.id = p.device_id
        left join elders e on e.id = w.elder_id
        where p.key_hash = %s
        """,
        (key_hash,),
    ).fetchone()


def create_watch_device(conn, elder_id: str, key_hash: str, label: str | None) -> str:
    row = conn.execute(
        "insert into watch_devices (elder_id, key_hash, label) values (%s, %s, %s) returning id",
        (elder_id, key_hash, label),
    ).fetchone()
    return str(row["id"])


def _bpm(v: int | None) -> int | None:
    return v if v is not None and 20 <= v <= 250 else None


def save_live_push(conn, device_id: str, elder_id: str, p: dict, measured_at: datetime) -> None:
    conn.execute(
        """
        insert into live_status (elder_id, measured_at, received_at, hr, resting_hr, steps, stress,
                                 body_battery, spo2, respiration, battery, charging)
        values (%s, %s, now(), %s, %s, %s, %s, %s, %s, %s, %s, %s)
        on conflict (elder_id) do update set
          measured_at = excluded.measured_at, received_at = now(), hr = excluded.hr,
          resting_hr = excluded.resting_hr, steps = excluded.steps, stress = excluded.stress,
          body_battery = excluded.body_battery, spo2 = excluded.spo2,
          respiration = excluded.respiration, battery = excluded.battery,
          charging = excluded.charging
        where live_status.measured_at <= excluded.measured_at
        """,
        (elder_id, measured_at, _bpm(p.get("hr")), _bpm(p.get("resting_hr")), p.get("steps"),
         p.get("stress"), p.get("body_battery"), p.get("spo2"), p.get("respiration"),
         p.get("battery"), p.get("charging")),
    )
    samples = [(elder_id, datetime.fromtimestamp(ts, tz=measured_at.tzinfo), bpm)
               for ts, bpm in p.get("hr_samples") or [] if 20 <= bpm <= 250]
    if p.get("hr") and 20 <= p["hr"] <= 250:
        samples.append((elder_id, measured_at, p["hr"]))
    with conn.cursor() as cur:
        cur.executemany(
            "insert into hr_samples (elder_id, ts, bpm) values (%s, %s, %s) on conflict do nothing",
            samples,
        )
    if p.get("steps") is not None:
        conn.execute(
            "insert into step_samples (elder_id, ts, steps) values (%s, %s, %s) on conflict do nothing",
            (elder_id, measured_at, p["steps"]),
        )
    conn.execute(
        "update watch_devices set last_seen_at = now(), battery = %s, charging = %s where id = %s",
        (p.get("battery"), p.get("charging"), device_id),
    )


def merge_live(conn, s: Snapshot, now_utc: datetime) -> Snapshot:
    live = conn.execute("select * from live_status where elder_id = %s", (s.elder_id,)).fetchone()
    if live is None:
        return s
    s.last_live_at = live["measured_at"]
    s.watch_battery = None if live["charging"] else live["battery"]
    bpm = conn.execute(
        """
        select percentile_disc(0.5) within group (order by bpm) as median, count(*) as n
        from hr_samples where elder_id = %s and ts > %s
        """,
        (s.elder_id, now_utc - LIVE_WINDOW),
    ).fetchone()
    if bpm["n"] >= MIN_HR_SAMPLES:
        s.hr_now = bpm["median"]
    steps = conn.execute(
        """
        select max(steps) - min(steps) as delta from step_samples
        where elder_id = %s and ts > %s
        """,
        (s.elder_id, now_utc - LIVE_WINDOW - timedelta(minutes=5)),
    ).fetchone()
    s.active_recently = (steps["delta"] or 0) >= ACTIVE_STEPS
    # Số liệu trong ngày: lấy cái mới hơn giữa đồng hồ (trực tiếp) và Garmin Connect.
    if live["steps"] is not None:
        s.steps = max(s.steps or 0, live["steps"])
    if live["body_battery"] is not None:
        s.body_battery = live["body_battery"]
    if s.resting_hr is None:
        s.resting_hr = live["resting_hr"]
    return s


def hr_series(conn, elder_id: str, since: datetime) -> list[dict]:
    return conn.execute(
        "select ts, bpm from hr_samples where elder_id = %s and ts >= %s order by ts",
        (elder_id, since),
    ).fetchall()


# ---------- Người ----------

def elders_of_family(conn, family_id: str) -> list[dict]:
    return conn.execute(
        "select * from elders where family_id = %s order by created_at", (family_id,)
    ).fetchall()


def families(conn) -> list[dict]:
    return conn.execute("select * from families").fetchall()


def mark_report_sent(conn, family_id: str, kind: str, day: date) -> bool:
    """Đánh dấu đã gửi báo cáo; trả về False nếu hôm nay đã gửi rồi."""
    col = {"morning": "last_morning_report_on", "evening": "last_evening_report_on"}[kind]
    row = conn.execute(
        f"update families set {col} = %s where id = %s "
        f"and ({col} is null or {col} < %s) returning id",
        (day, family_id, day),
    ).fetchone()
    return row is not None


def family_by_chat(conn, chat_id: int) -> dict | None:
    return conn.execute("select * from families where telegram_chat_id = %s", (chat_id,)).fetchone()


def elder_by_telegram(conn, telegram_user_id: int) -> dict | None:
    return conn.execute(
        """
        select e.*, f.telegram_chat_id as family_chat_id, f.timezone
        from elders e join families f on f.id = e.family_id
        where e.telegram_user_id = %s
        """,
        (telegram_user_id,),
    ).fetchone()


def caregiver_by_telegram(conn, family_id: str, telegram_user_id: int) -> dict | None:
    return conn.execute(
        "select * from caregivers where family_id = %s and telegram_user_id = %s",
        (family_id, telegram_user_id),
    ).fetchone()


def caregivers_for_escalation(conn, family_id: str) -> list[dict]:
    return conn.execute(
        """
        select * from caregivers
        where family_id = %s and role in ('admin', 'alerts')
        order by escalation_order nulls last, created_at
        """,
        (family_id,),
    ).fetchall()


def family_admins(conn, family_id: str) -> list[dict]:
    return conn.execute(
        "select * from caregivers where family_id = %s and role = 'admin'", (family_id,)
    ).fetchall()


def consume_link_code(conn, code: str, kind: str) -> dict | None:
    """Dùng mã nối Telegram (một lần). Trả về None nếu sai, hết hạn hoặc sai loại."""
    return conn.execute(
        """
        update link_codes l set used_at = now()
        from families f
        where l.code = %s and l.kind = %s and l.used_at is null and l.expires_at > now()
          and f.id = l.family_id
        returning l.family_id, l.elder_id, f.name as family_name,
                  (select display_name from elders where id = l.elder_id) as elder_name
        """,
        (code, kind),
    ).fetchone()


def set_family_chat(conn, family_id: str, chat_id: int) -> None:
    # Một nhóm chỉ thuộc một gia đình: gỡ khỏi gia đình cũ nếu có.
    conn.execute("update families set telegram_chat_id = null where telegram_chat_id = %s and id <> %s",
                 (chat_id, family_id))
    conn.execute("update families set telegram_chat_id = %s where id = %s", (chat_id, family_id))


def set_elder_telegram(conn, elder_id: str, telegram_user_id: int) -> None:
    conn.execute("update elders set telegram_user_id = %s where id = %s", (telegram_user_id, elder_id))


# ---------- Cảnh báo ----------

def rules_for(conn, elder_id: str) -> list[Rule]:
    rows = conn.execute(
        "select * from alert_rules where elder_id = %s and enabled", (elder_id,)
    ).fetchall()
    return [
        Rule(id=str(r["id"]), elder_id=str(r["elder_id"]), metric=r["metric"],
             comparator=r["comparator"], threshold=float(r["threshold"]),
             severity=r["severity"], active_after=r["active_after"], notify=r["notify"],
             enabled=r["enabled"])
        for r in rows
    ]


def insert_rules(conn, rules: list[dict]) -> None:
    for r in rules:
        conn.execute(
            """
            insert into alert_rules (elder_id, metric, comparator, threshold, severity,
                                     active_after, notify, enabled)
            values (%(elder_id)s, %(metric)s, %(comparator)s, %(threshold)s, %(severity)s,
                    %(active_after)s, %(notify)s, %(enabled)s)
            """,
            r,
        )


def open_alert(conn, c: AlertCandidate) -> str | None:
    """Mở cảnh báo mới; trả về None nếu điều kiện này đang có cảnh báo mở."""
    row = conn.execute(
        """
        insert into alerts (elder_id, rule_id, dedupe_key, metric, value, severity, message)
        values (%s, %s, %s, %s, %s, %s, %s)
        on conflict (dedupe_key) where resolved_at is null do nothing
        returning id
        """,
        (c.rule.elder_id, c.rule.id, c.dedupe_key, c.rule.metric, c.value,
         c.rule.severity, c.message),
    ).fetchone()
    return str(row["id"]) if row else None


def update_open_alert_value(conn, c: AlertCandidate) -> None:
    conn.execute(
        "update alerts set value = %s, message = %s where dedupe_key = %s and resolved_at is null",
        (c.value, c.message, c.dedupe_key),
    )


def resolve_missing(conn, elder_id: str, still_breached: set[str],
                    evaluable_rule_ids: set[str]) -> list[dict]:
    """Đóng cảnh báo mở mà điều kiện không còn vi phạm (chỉ khi đã có dữ liệu để kiểm)."""
    rows = conn.execute(
        """
        select a.id, a.dedupe_key, a.rule_id, a.message, a.severity, a.opened_at,
               a.notified_at, e.display_name, f.telegram_chat_id
        from alerts a join elders e on e.id = a.elder_id join families f on f.id = e.family_id
        where a.elder_id = %s and a.resolved_at is null
        """,
        (elder_id,),
    ).fetchall()
    resolved = []
    for r in rows:
        if r["dedupe_key"] in still_breached:
            continue
        if r["rule_id"] is not None and str(r["rule_id"]) not in evaluable_rule_ids:
            continue
        conn.execute("update alerts set resolved_at = now() where id = %s", (r["id"],))
        resolved.append(r)
    return resolved


def open_alerts_of(conn, elder_id: str) -> list[dict]:
    return conn.execute(
        "select metric, severity, message from alerts where elder_id = %s and resolved_at is null",
        (elder_id,),
    ).fetchall()


def pending_alerts(conn) -> list[dict]:
    return conn.execute(
        """
        select a.*, e.display_name as elder_name, e.family_id, e.telegram_user_id as elder_tg,
               f.telegram_chat_id, f.timezone, f.quiet_start, f.quiet_end,
               coalesce(r.notify, 'family') as rule_notify
        from alerts a
        join elders e on e.id = a.elder_id
        join families f on f.id = e.family_id
        left join alert_rules r on r.id = a.rule_id
        where a.resolved_at is null and a.acked_at is null
        order by a.opened_at
        """
    ).fetchall()


def alert_with_family(conn, alert_id: str) -> dict | None:
    try:
        return conn.execute(
            """
            select a.*, e.family_id, e.display_name as elder_name, f.telegram_chat_id
            from alerts a join elders e on e.id = a.elder_id join families f on f.id = e.family_id
            where a.id = %s
            """,
            (alert_id,),
        ).fetchone()
    except psycopg.errors.InvalidTextRepresentation:  # callback_data không phải uuid
        return None


def set_escalation(conn, alert_id: str, step: int, notified: bool) -> None:
    conn.execute(
        """
        update alerts set escalation_step = %s,
               notified_at = case when %s then coalesce(notified_at, now()) else notified_at end
        where id = %s
        """,
        (step, notified, alert_id),
    )


def ack_alert(conn, alert_id: str, caregiver_id: str) -> bool:
    row = conn.execute(
        """
        update alerts set acked_by = %s, acked_at = now()
        where id = %s and acked_at is null returning id
        """,
        (caregiver_id, alert_id),
    ).fetchone()
    return row is not None


def snooze_alert(conn, alert_id: str, hours: int = 2) -> None:
    conn.execute(
        "update alerts set snoozed_until = now() + make_interval(hours => %s) where id = %s",
        (hours, alert_id),
    )


def log_call(conn, alert_id: str, caregiver_id: str | None, provider: str, status: str,
             detail: str) -> None:
    conn.execute(
        """
        insert into call_logs (alert_id, caregiver_id, provider, status, detail)
        values (%s, %s, %s, %s, %s)
        """,
        (alert_id, caregiver_id, provider, status, detail),
    )


# ---------- Thuốc ----------

def due_medications(conn, now_utc: datetime, window: timedelta) -> list[dict]:
    """Liều thuốc đến giờ trong khoảng `window` vừa qua mà chưa nhắc."""
    return conn.execute(
        """
        with due as (
          select s.id as schedule_id, s.name, s.note, e.id as elder_id, e.display_name,
                 e.telegram_user_id, f.telegram_chat_id, f.timezone,
                 (d + t) at time zone f.timezone as due_at
          from med_schedules s
          join elders e on e.id = s.elder_id
          join families f on f.id = e.family_id
          cross join lateral unnest(s.times) as t
          -- hôm qua và hôm nay, để liều lúc 23:59 không bị bỏ sót khi qua ngày
          cross join lateral (values ((now() at time zone f.timezone)::date - 1),
                                     ((now() at time zone f.timezone)::date)) as days(d)
          where s.active
        )
        select d.* from due d
        where d.due_at <= %s and d.due_at > %s
          and not exists (select 1 from med_logs l
                          where l.schedule_id = d.schedule_id and l.due_at = d.due_at
                            and l.reminded_at is not null)
        """,
        (now_utc, now_utc - window),
    ).fetchall()


def log_med_reminder(conn, schedule_id: str, due_at: datetime) -> str:
    row = conn.execute(
        """
        insert into med_logs (schedule_id, due_at, reminded_at) values (%s, %s, now())
        on conflict (schedule_id, due_at) do update set reminded_at = now()
        returning id
        """,
        (schedule_id, due_at),
    ).fetchone()
    return str(row["id"])


def mark_med_taken(conn, log_id: str) -> dict | None:
    return conn.execute(
        """
        update med_logs l set taken_at = coalesce(l.taken_at, now())
        from med_schedules s join elders e on e.id = s.elder_id
        where l.id = %s and s.id = l.schedule_id
        returning s.name, e.display_name
        """,
        (log_id,),
    ).fetchone()


def missed_medications(conn, older_than: datetime) -> list[dict]:
    """Liều đã nhắc nhưng chưa bấm "Đã uống" sau một khoảng thời gian, chưa báo gia đình."""
    return conn.execute(
        """
        select l.id, l.due_at, s.name, e.display_name, f.telegram_chat_id, f.timezone
        from med_logs l
        join med_schedules s on s.id = l.schedule_id
        join elders e on e.id = s.elder_id
        join families f on f.id = e.family_id
        where l.taken_at is null and l.reminded_at is not null and l.due_at <= %s
          and not exists (select 1 from alerts a where a.dedupe_key = 'med:' || l.id::text)
        """,
        (older_than,),
    ).fetchall()


def record_missed_med(conn, log_id: str, message: str) -> None:
    """Lưu vào lịch sử cảnh báo (đã đóng sẵn) để không báo lặp lại."""
    conn.execute(
        """
        insert into alerts (elder_id, dedupe_key, metric, severity, message, notified_at,
                            resolved_at)
        select s.elder_id, 'med:' || l.id::text, 'medication', 'info', %s, now(), now()
        from med_logs l join med_schedules s on s.id = l.schedule_id where l.id = %s
        """,
        (message, log_id),
    )
