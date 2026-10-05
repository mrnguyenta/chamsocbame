"""Kiểm thử luồng đầy đủ trên PostgreSQL thật.

Chạy khi có biến TEST_DATABASE_URL trỏ tới một cơ sở dữ liệu trống (sẽ bị xoá sạch):
    TEST_DATABASE_URL=postgresql://localhost/chamsoc_test pytest
"""

import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from chamsoc import db, jobs, rules
from chamsoc.calls import NoopCallProvider

URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not URL, reason="cần TEST_DATABASE_URL")
MIGRATION = Path(__file__).resolve().parents[2] / "supabase/migrations/20261005000000_init.sql"
VN = ZoneInfo("Asia/Ho_Chi_Minh")
GROUP, NGUYEN, HANH, BA_TG = -100, 11, 22, 44


class FakeTg:
    def __init__(self):
        self.sent, self.answers, self.cleared = [], [], []

    def send(self, chat_id, text, buttons=None):
        self.sent.append((chat_id, text, buttons))
        return {"message_id": len(self.sent)}

    def answer_callback(self, cid, text=""):
        self.answers.append(text)

    def clear_buttons(self, chat_id, message_id):
        self.cleared.append((chat_id, message_id))

    def texts_to(self, chat_id):
        return [t for c, t, _ in self.sent if c == chat_id]


@pytest.fixture()
def conn():
    with db.connect(URL) as c:
        c.execute("drop schema public cascade; create schema public;")
        c.execute(MIGRATION.read_text())
        yield c


@pytest.fixture()
def family(conn):
    fam = conn.execute(
        """insert into families (name, telegram_chat_id, quiet_start, quiet_end)
           values ('Nhà mình', %s, '00:00', '00:00') returning *""", (GROUP,)).fetchone()
    fid = fam["id"]
    conn.execute("""insert into caregivers (family_id, display_name, telegram_user_id, phone, role,
                    escalation_order) values (%s, 'Nguyên', %s, '+840001', 'admin', 2),
                    (%s, 'Chị Hạnh', %s, '+840002', 'alerts', 1)""", (fid, NGUYEN, fid, HANH))
    ba = conn.execute("""insert into elders (family_id, display_name, command, conditions,
                         telegram_user_id) values (%s, 'Ba Hùng', 'ba', '{tang_huyet_ap}', %s)
                         returning *""", (fid, BA_TG)).fetchone()
    me = conn.execute("""insert into elders (family_id, display_name, command)
                         values (%s, 'Mẹ Lan', 'me') returning *""", (fid,)).fetchone()
    for e in (ba, me):
        db.insert_rules(conn, rules.default_rules(str(e["id"]), list(e["conditions"])))
    return {"family": fam, "ba": ba, "me": me}


def _metrics(conn, elder, day, **kw):
    cols = ", ".join(kw)
    vals = ", ".join(["%s"] * len(kw))
    sets = ", ".join(f"{k} = excluded.{k}" for k in kw)
    conn.execute(f"""insert into daily_metrics (elder_id, day, {cols}) values (%s, %s, {vals})
                     on conflict (elder_id, day) do update set {sets}""",
                 (elder["id"], day, *kw.values()))


def _evaluate(conn, tg, elder, now):
    local = now.astimezone(VN)
    snap = db.snapshot_from_db(conn, elder, local.date(), now - timedelta(hours=24))
    jobs.evaluate_elder(conn, tg, snap, local)


def test_alert_lifecycle_with_escalation_ack_and_resolve(conn, family):
    tg, calls, me = FakeTg(), NoopCallProvider(), family["me"]
    now = datetime.now(timezone.utc)
    _metrics(conn, me, now.astimezone(VN).date(), resting_hr=98)

    _evaluate(conn, tg, me, now)
    _evaluate(conn, tg, me, now)  # lần đồng bộ sau không mở trùng
    assert conn.execute("select count(*) n from alerts").fetchone()["n"] == 1

    jobs.process_alerts(conn, tg, calls, now)
    [(chat, text, buttons)] = tg.sent
    assert chat == GROUP and "Mẹ Lan" in text and "98 bpm" in text
    alert_id = buttons[0][0][1].split(":")[1]

    jobs.process_alerts(conn, tg, calls, now + timedelta(minutes=3))
    assert len(tg.sent) == 1  # chưa đến hạn leo thang

    jobs.process_alerts(conn, tg, calls, now + timedelta(minutes=11))
    assert tg.sent[-1][0] == HANH  # người ở gần nhất

    jobs.process_alerts(conn, tg, calls, now + timedelta(minutes=21))
    logs = conn.execute("select status, provider from call_logs").fetchall()
    assert [r["status"] for r in logs] == ["skipped", "skipped"]

    cb = {"callback_query": {"id": "q", "data": f"ack:{alert_id}", "from": {"id": HANH},
                             "message": {"message_id": 1, "chat": {"id": GROUP}}}}
    jobs.handle_update(conn, tg, calls, cb, now)
    assert tg.answers[-1] == "Cảm ơn, đã giao cho bạn"
    assert "Chị Hạnh đã nhận xử lý" in tg.texts_to(GROUP)[-1]
    jobs.handle_update(conn, tg, calls, cb, now)
    assert tg.answers[-1] == "Đã có người nhận rồi"

    _metrics(conn, me, now.astimezone(VN).date(), resting_hr=72)
    _evaluate(conn, tg, me, now)
    assert "đã trở lại bình thường" in tg.texts_to(GROUP)[-1]
    assert conn.execute("select resolved_at from alerts").fetchone()["resolved_at"] is not None


def test_stranger_cannot_ack(conn, family):
    tg, now = FakeTg(), datetime.now(timezone.utc)
    _metrics(conn, family["me"], now.astimezone(VN).date(), spo2_min=85)
    _evaluate(conn, tg, family["me"], now)
    alert_id = conn.execute("select id from alerts").fetchone()["id"]
    cb = {"callback_query": {"id": "q", "data": f"ack:{alert_id}", "from": {"id": 999},
                             "message": {"message_id": 1, "chat": {"id": GROUP}}}}
    jobs.handle_update(conn, tg, NoopCallProvider(), cb, now)
    assert tg.answers == ["Bạn chưa có trong danh sách người chăm sóc"]
    bad = {"callback_query": {"id": "q", "data": "ack:not-a-uuid", "from": {"id": HANH},
                              "message": {"message_id": 1, "chat": {"id": GROUP}}}}
    jobs.handle_update(conn, tg, NoopCallProvider(), bad, now)
    assert tg.answers[-1] == "Cảnh báo không còn"


def test_parent_sends_blood_pressure_via_telegram(conn, family):
    tg, now = FakeTg(), datetime.now(timezone.utc)
    msg = lambda text: {"message": {"text": text, "chat": {"id": BA_TG}, "from": {"id": BA_TG}}}

    jobs.handle_update(conn, tg, NoopCallProvider(), msg("128/80"), now)
    assert tg.texts_to(BA_TG) == ["Đã ghi nhận. Cảm ơn ba/mẹ!"]
    assert tg.texts_to(GROUP) == []

    jobs.handle_update(conn, tg, NoopCallProvider(), msg("185/105 90"), now)
    group = tg.texts_to(GROUP)
    assert len(group) == 2  # tâm thu > 160 và tâm trương > 100
    assert any("Huyết áp tâm thu 185 mmHg" in t for t in group)

    jobs.handle_update(conn, tg, NoopCallProvider(), msg("chào con"), now)
    assert "130/85" in tg.texts_to(BA_TG)[-1]
    n = conn.execute("select count(*) n from readings").fetchone()["n"]
    assert n == 2


def test_commands_and_scheduled_reports(conn, family):
    tg, now = FakeTg(), datetime.now(timezone.utc)
    _metrics(conn, family["ba"], now.astimezone(VN).date(), resting_hr=62, steps=4820,
             sleep_seconds=24000)
    cmd = lambda t: {"message": {"text": t, "chat": {"id": GROUP}, "from": {"id": NGUYEN}}}

    jobs.handle_update(conn, tg, NoopCallProvider(), cmd("/ba@ChamSocBaMe_bot"), now)
    assert "Ba Hùng" in tg.sent[-1][1] and "Bước chân 4.820" in tg.sent[-1][1]
    jobs.handle_update(conn, tg, NoopCallProvider(), cmd("/tongquan"), now)
    assert "Mẹ Lan" in tg.sent[-1][1] and "Ba Hùng" in tg.sent[-1][1]

    local = now.astimezone(VN)
    conn.execute("update families set morning_report_at = %s, evening_report_at = null",
                 ((local - timedelta(minutes=5)).time().replace(second=0, microsecond=0),))
    before = len(tg.sent)
    jobs.scheduled_reports(conn, tg, now)
    jobs.scheduled_reports(conn, tg, now + timedelta(minutes=5))
    assert len(tg.sent) == before + 1
    assert tg.sent[-1][1].startswith("<b>Báo cáo sáng")


def test_medication_reminder_and_missed_dose(conn, family):
    tg, now = FakeTg(), datetime.now(timezone.utc)
    due_local = (now.astimezone(VN) - timedelta(minutes=5)).replace(second=0, microsecond=0)
    conn.execute("insert into med_schedules (elder_id, name, times) values (%s, 'Amlodipine 5mg', %s::time[])",
                 (family["ba"]["id"], [due_local.strftime("%H:%M")]))

    jobs.medication_reminders(conn, tg, now)
    jobs.medication_reminders(conn, tg, now + timedelta(minutes=5))  # không nhắc lại
    [(chat, text, buttons)] = tg.sent
    assert chat == BA_TG and "Amlodipine 5mg" in text and due_local.strftime("%H:%M") in text

    jobs.medication_reminders(conn, tg, now + timedelta(minutes=70))
    assert "chưa xác nhận uống Amlodipine 5mg" in tg.texts_to(GROUP)[-1]
    jobs.medication_reminders(conn, tg, now + timedelta(minutes=80))
    assert len(tg.texts_to(GROUP)) == 1

    cb = {"callback_query": {"id": "q", "data": buttons[0][0][1], "from": {"id": BA_TG},
                             "message": {"message_id": 1, "chat": {"id": BA_TG}}}}
    jobs.handle_update(conn, tg, NoopCallProvider(), cb, now)
    assert tg.answers == ["Đã ghi nhận"]
    assert conn.execute("select taken_at from med_logs").fetchone()["taken_at"] is not None
