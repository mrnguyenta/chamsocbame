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
MIGRATIONS = sorted((Path(__file__).resolve().parents[2] / "supabase/migrations").glob("*.sql"))
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
        for m in MIGRATIONS:
            c.execute(m.read_text())
        yield c


@pytest.fixture()
def family(conn):
    fam = conn.execute(
        """insert into families (name, quiet_start, quiet_end)
           values ('Nhà mình', '00:00', '00:00') returning *""").fetchone()
    fid = fam["id"]
    db.link_family_chat(conn, str(fid), GROUP, "Nhà mình")
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
    snap = db.snapshot_from_db(conn, elder, local.date(), now)
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


def _device(conn, elder):
    from chamsoc.watch_key import new_key
    key, key_hash = new_key()
    db.create_watch_device(conn, str(elder["id"]), key_hash, "Venu 4")
    return key


def test_watch_push_endpoint_raises_live_alert(conn, family, monkeypatch):
    import importlib
    from fastapi.testclient import TestClient

    for k, v in {"DATABASE_URL": URL, "TELEGRAM_BOT_TOKEN": "t", "TELEGRAM_WEBHOOK_SECRET": "h",
                 "CRON_SECRET": "c", "TOKEN_ENCRYPTION_KEY": "k"}.items():
        monkeypatch.setenv(k, v)
    tg = FakeTg()
    api = importlib.import_module("api.index")
    monkeypatch.setattr(api, "TelegramClient", lambda token: tg)
    client = TestClient(api.app)
    key = _device(conn, family["me"])
    now = int(datetime.now(timezone.utc).timestamp())

    assert client.post("/api/watch/push", json={"ts": now},
                       headers={"Authorization": "Bearer sai"}).status_code == 401

    body = {"ts": now, "hr": 128, "hr_samples": [[now - 240, 126], [now - 120, 131], [now - 60, 129]],
            "steps": 1200, "body_battery": 30, "battery": 80, "charging": False, "stress": -1}
    r = client.post("/api/watch/push", json=body, headers={"Authorization": f"Bearer {key}"})
    assert r.status_code == 200
    live = conn.execute("select * from live_status").fetchone()
    assert (live["hr"], live["stress"], live["steps"]) == (128, None, 1200)
    group = tg.texts_to(GROUP)
    assert len(group) == 1 and "Nhịp tim hiện tại (10 phút) 128 bpm" in group[0]


def test_walking_does_not_trigger_high_hr_and_silence_is_detected(conn, family):
    tg, calls = FakeTg(), NoopCallProvider()
    _device(conn, family["ba"])
    dev = conn.execute("""select w.id, w.elder_id, e.display_name, f.timezone from watch_devices w
                          join elders e on e.id = w.elder_id join families f on f.id = e.family_id""").fetchone()
    now = datetime.now(timezone.utc)
    t = int(now.timestamp())
    jobs.handle_watch_push(conn, tg, calls, dev, {"ts": t - 300, "steps": 2000, "hr_samples": []},
                           now - timedelta(minutes=5))
    jobs.handle_watch_push(conn, tg, calls, dev,
                           {"ts": t, "hr": 125, "steps": 2700,
                            "hr_samples": [[t - 200, 122], [t - 100, 126]], "battery": 60}, now)
    assert tg.texts_to(GROUP) == []  # đang đi bộ: 700 bước trong 5 phút

    jobs.evaluate_all(conn, tg, now + timedelta(minutes=45))
    jobs.process_alerts(conn, tg, calls, now + timedelta(minutes=45))
    assert any("Đồng hồ chưa gửi dữ liệu 45 phút" in t for t in tg.texts_to(GROUP))


def test_pairing_with_six_digit_code(conn, family, monkeypatch):
    import importlib
    from fastapi.testclient import TestClient

    for k, v in {"DATABASE_URL": URL, "TELEGRAM_BOT_TOKEN": "t", "TELEGRAM_WEBHOOK_SECRET": "h",
                 "CRON_SECRET": "c", "TOKEN_ENCRYPTION_KEY": "k"}.items():
        monkeypatch.setenv(k, v)
    api = importlib.import_module("api.index")
    monkeypatch.setattr(api, "TelegramClient", lambda token: FakeTg())
    client = TestClient(api.app)

    r = client.post("/api/watch/pair/start", json={"device": "006-B4384-00"})
    assert r.status_code == 200
    code, key = r.json()["code"], r.json()["key"]
    assert len(code) == 6 and code.isdigit()
    assert r.json()["link"].endswith(f"/d/{code}")
    auth = {"Authorization": f"Bearer {key}"}
    assert client.get("/api/watch/pair/status", headers=auth).json() == {"status": "pending"}
    assert client.post("/api/watch/push", json={"ts": 1}, headers=auth).status_code == 401

    # Website nhận mã (cùng câu lệnh với web/app/cai-dat/actions.ts claimWatch)
    p = conn.execute("select id, key_hash from watch_pairings where code = %s and claimed_at is null "
                     "and expires_at > now()", (code,)).fetchone()
    d = conn.execute("insert into watch_devices (elder_id, key_hash, label) values (%s, %s, 'Venu 4') "
                     "returning id", (family["ba"]["id"], p["key_hash"])).fetchone()
    conn.execute("update watch_pairings set claimed_at = now(), device_id = %s where id = %s", (d["id"], p["id"]))

    assert client.get("/api/watch/pair/status", headers=auth).json() == {"status": "paired", "elder": "Ba Hùng"}
    assert client.post("/api/watch/push", json={"ts": 1, "steps": 10}, headers=auth).status_code == 200

    # Mã hết hạn -> 410 để đồng hồ xin mã mới; khoá lạ -> 404
    r2 = client.post("/api/watch/pair/start", json={}).json()
    conn.execute("update watch_pairings set expires_at = now() - interval '1 minute' where code = %s", (r2["code"],))
    assert client.get("/api/watch/pair/status", headers={"Authorization": f"Bearer {r2['key']}"}).status_code == 410
    assert client.get("/api/watch/pair/status", headers={"Authorization": "Bearer la"}).status_code == 404


def test_link_group_and_parent_telegram_with_codes(conn, family):
    tg, now = FakeTg(), datetime.now(timezone.utc)
    fid, me = family["family"]["id"], family["me"]
    conn.execute("insert into link_codes (code, family_id, kind) values ('111111', %s, 'group')", (fid,))
    conn.execute("insert into link_codes (code, family_id, kind, elder_id) values ('222222', %s, 'elder', %s)",
                 (fid, me["id"]))
    msg = lambda text, chat, typ, user: {"message": {"text": text, "from": {"id": user}, "chat": {
        "id": chat, "type": typ, **({"title": "Anh chị em"} if typ != "private" else {})}}}

    # Mã nhóm gõ trong tin riêng thì không nhận
    jobs.handle_update(conn, tg, NoopCallProvider(), msg("/ketnoi 111111", 77, "private", 77), now)
    assert "Mã không đúng" in tg.sent[-1][1]
    jobs.handle_update(conn, tg, NoopCallProvider(), msg("/start@ChamSocBot 111111", -555, "supergroup", NGUYEN), now)
    chats = conn.execute("select chat_id, title from family_chats where family_id = %s order by linked_at",
                         (fid,)).fetchall()
    assert [(c["chat_id"], c["title"]) for c in chats] == [(GROUP, "Nhà mình"), (-555, "Anh chị em")]
    assert "Đã nối nhóm" in tg.sent[-1][1]
    jobs.handle_update(conn, tg, NoopCallProvider(), msg("/ketnoi 111111", -555, "group", NGUYEN), now)
    assert "Mã không đúng" in tg.sent[-1][1]  # mã chỉ dùng một lần

    jobs.handle_update(conn, tg, NoopCallProvider(), msg("/start 222222", 66, "private", 66), now)
    assert conn.execute("select telegram_user_id from elders where id = %s", (me["id"],)).fetchone()["telegram_user_id"] == 66
    assert "Mẹ Lan" in tg.sent[-1][1]

    # Người chăm sóc (đăng nhập bằng email) nối Telegram riêng bằng mã 6 số
    cg = conn.execute("insert into caregivers (family_id, display_name, role) values (%s, 'Anh Nhất', 'alerts') "
                      "returning id", (fid,)).fetchone()["id"]
    conn.execute("insert into link_codes (code, family_id, kind, caregiver_id) values ('333333', %s, 'caregiver', %s)",
                 (fid, cg))
    update = msg("/start 333333", 88, "private", 88)
    update["message"]["from"]["first_name"] = "Nhất"
    jobs.handle_update(conn, tg, NoopCallProvider(), update, now)
    row = conn.execute("select telegram_user_id, telegram_name from caregivers where id = %s", (cg,)).fetchone()
    assert (row["telegram_user_id"], row["telegram_name"]) == (88, "Nhất")
    assert "Anh Nhất" in tg.sent[-1][1]


def test_sql_default_rules_match_python(conn, family):
    e = conn.execute("insert into elders (family_id, display_name) values (%s, 'Ông') returning id",
                     (family["family"]["id"],)).fetchone()["id"]
    n = conn.execute("select chamsoc_ensure_default_rules(%s, %s) as n", (e, ["tieu_duong"])).fetchone()["n"]
    py = rules.default_rules(str(e), ["tieu_duong"])
    assert n == len(py)
    assert conn.execute("select chamsoc_ensure_default_rules(%s, %s) as n", (e, ["tieu_duong"])).fetchone()["n"] == 0
    # Thêm bệnh tăng huyết áp: chỉ thêm 3 ngưỡng huyết áp còn thiếu
    assert conn.execute("select chamsoc_ensure_default_rules(%s, %s) as n",
                        (e, ["tieu_duong", "tang_huyet_ap"])).fetchone()["n"] == 3


def test_bot_token_from_admin_page_overrides_env(conn, monkeypatch):
    import api.index as api
    from chamsoc.config import Settings

    s = Settings(database_url=URL, telegram_bot_token="env-token", telegram_webhook_secret="h",
                 cron_secret="c", token_encryption_key="k")
    assert api._tg(conn, s)._base.endswith("/botenv-token")
    conn.execute("insert into app_settings (key, value) values ('telegram_bot_token', '123:abc')")
    assert api._tg(conn, s)._base.endswith("/bot123:abc")


def test_family_with_two_groups_gets_reports_in_both(conn, family, monkeypatch):
    tg, now = FakeTg(), datetime.now(timezone.utc)
    fid = str(family["family"]["id"])
    db.link_family_chat(conn, fid, -777, "Cả họ")
    fam = db.family_by_chat(conn, -777)
    assert str(fam["id"]) == fid and fam["chat_ids"] == [GROUP, -777]

    jobs._to_groups(tg, fam["chat_ids"], "Báo cáo")
    assert [m[0] for m in tg.sent[-2:]] == [GROUP, -777]

    # Đổi tên nhóm -> cập nhật tên hiển thị trên website
    jobs.handle_update(conn, tg, NoopCallProvider(), {"message": {
        "new_chat_title": "Cả họ Lê", "chat": {"id": -777, "type": "group", "title": "Cả họ Lê"}, "from": {"id": 1}}}, now)
    assert conn.execute("select title from family_chats where chat_id = -777").fetchone()["title"] == "Cả họ Lê"

    # Nhóm thường nâng lên siêu nhóm -> đổi chat_id
    jobs.handle_update(conn, tg, NoopCallProvider(), {"message": {
        "migrate_to_chat_id": -100777, "chat": {"id": -777, "type": "group"}, "from": {"id": 1}}}, now)
    assert db.family_by_chat(conn, -100777) is not None and db.family_by_chat(conn, -777) is None

    # Bot bị xoá khỏi nhóm -> gỡ nhóm
    jobs.handle_update(conn, tg, NoopCallProvider(), {"my_chat_member": {
        "chat": {"id": -100777, "type": "supergroup"}, "new_chat_member": {"status": "kicked"}}}, now)
    assert db.family_by_chat(conn, -100777) is None


def test_missing_group_titles_are_filled_from_telegram(conn, family):
    conn.execute("insert into family_chats (chat_id, family_id) values (-888, %s)", (family["family"]["id"],))

    class Tg(FakeTg):
        def get_chat(self, chat_id):
            return {"id": chat_id, "title": "Nhóm cũ"}

    jobs.fill_chat_titles(conn, Tg())
    assert conn.execute("select title from family_chats where chat_id = -888").fetchone()["title"] == "Nhóm cũ"


def test_garmin_link_waits_for_mfa_code_from_website(conn, family):
    from garminconnect import GarminConnectAuthenticationError
    from chamsoc import crypto, garmin_link

    key = crypto.generate_key()
    elder = str(family["ba"]["id"])
    req = conn.execute("insert into garmin_link_requests (elder_id) values (%s) returning id", (elder,)).fetchone()["id"]

    class Inner:
        def dumps(self):
            return '{"token": "t"}'

    class FakeGarmin:
        def __init__(self, email, password, return_on_mfa):
            assert return_on_mfa and email == "ba@example.com"
            self.client = Inner()

        def login(self):
            return "needs_mfa", None

        def resume_login(self, _state, code):
            if code != "123456":
                raise GarminConnectAuthenticationError("bad code")
            return None, None

        def get_full_name(self):
            return "Ba Hùng"

    codes = iter([None, "000000", None, "123456"])
    t = [0.0]

    def fake_sleep(s):
        t[0] += s
        c = next(codes, None)
        if c:
            conn.execute("update garmin_link_requests set mfa_code = %s where id = %s", (c, req))

    status = garmin_link.link(conn, key, str(req), elder, "ba@example.com", "pw", wait_s=60,
                              make_client=FakeGarmin, sleep=fake_sleep, clock=lambda: t[0])
    assert status == "done"
    row = conn.execute("select status, message, mfa_code from garmin_link_requests where id = %s", (req,)).fetchone()
    assert row["status"] == "done" and "Ba Hùng" in row["message"] and row["mfa_code"] is None
    saved = conn.execute("select token_ciphertext, status from garmin_accounts where elder_id = %s", (elder,)).fetchone()
    assert crypto.decrypt(key, saved["token_ciphertext"]) == '{"token": "t"}'

    # Không ai nhập mã: hết giờ
    req2 = conn.execute("insert into garmin_link_requests (elder_id) values (%s) returning id", (elder,)).fetchone()["id"]
    t2 = [0.0]
    status = garmin_link.link(conn, key, str(req2), elder, "ba@example.com", "pw", wait_s=10, make_client=FakeGarmin,
                              sleep=lambda s: t2.__setitem__(0, t2[0] + s), clock=lambda: t2[0])
    assert status == "expired"
