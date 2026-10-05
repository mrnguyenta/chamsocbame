"""Các việc chạy định kỳ và xử lý tin nhắn Telegram."""

from __future__ import annotations

import logging
from html import escape
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from garminconnect import GarminConnectAuthenticationError

from . import crypto, db, garmin_sync, rules, telegram
from .calls import CallProvider
from .config import Settings
from .escalation import due_steps, should_notify_now
from .models import SEVERITY_RANK, OpenAlert, Snapshot

log = logging.getLogger(__name__)

MED_WINDOW = timedelta(minutes=30)
MED_MISSED_AFTER = timedelta(minutes=60)
REPORT_GRACE = timedelta(hours=2)


def _local(now_utc: datetime, tz: str) -> datetime:
    return now_utc.astimezone(ZoneInfo(tz))


# ---------- Đánh giá cảnh báo ----------

def evaluate_elder(conn, tg: telegram.TelegramClient, snap: Snapshot, local_now: datetime) -> None:
    elder_rules = db.rules_for(conn, snap.elder_id)
    found = rules.evaluate(snap, elder_rules, local_now)
    for c in found:
        if db.open_alert(conn, c) is None:
            db.update_open_alert_value(conn, c)

    evaluable = {r.id for r in elder_rules
                 if rules.checkable_value(r, snap, local_now) is not None}
    resolved = db.resolve_missing(conn, snap.elder_id, {c.dedupe_key for c in found}, evaluable)
    for r in resolved:
        # Chỉ báo "đã bình thường" cho cảnh báo nghiêm trọng đã gửi trong hôm nay,
        # tránh tin thừa khi qua ngày mới.
        same_day = r["opened_at"].astimezone(local_now.tzinfo).date() == local_now.date()
        if (r["notified_at"] and same_day and r["telegram_chat_id"]
                and SEVERITY_RANK[r["severity"]] >= SEVERITY_RANK["high"]):
            tg.send(r["telegram_chat_id"], telegram.resolved_text(r["display_name"], r["message"]))


# ---------- Đồng bộ Garmin (mỗi 15 phút) ----------

def sync_all(conn, settings: Settings, tg: telegram.TelegramClient, now_utc: datetime) -> int:
    count = 0
    for acc in db.garmin_accounts(conn):
        elder_id, name = str(acc["elder_id"]), acc["display_name"]
        local_now = _local(now_utc, acc["timezone"])
        try:
            token = crypto.decrypt(settings.token_encryption_key, acc["token_ciphertext"])
            client = garmin_sync.login_with_tokens(token)
            snap, raw = garmin_sync.fetch_snapshot(client, elder_id, name, local_now.date())
            new_token = garmin_sync.current_tokens(client)
        except GarminConnectAuthenticationError as e:
            log.warning("Garmin cần đăng nhập lại cho %s: %s", name, e)
            if db.mark_garmin_error(conn, elder_id, "needs_relogin", str(e)) and acc["telegram_chat_id"]:
                tg.send(
                    acc["telegram_chat_id"],
                    f"<b>Mất kết nối Garmin · {escape(name)}</b>\n"
                    "Token hết hạn hoặc Garmin đổi cách đăng nhập. Quản trị chạy lại "
                    "<code>python -m chamsoc.link_garmin</code> để kết nối lại.",
                )
            continue
        except Exception as e:  # lỗi mạng, Garmin chặn tạm thời...
            log.exception("Đồng bộ Garmin lỗi cho %s", name)
            db.mark_garmin_error(conn, elder_id, "error", repr(e))
            continue

        db.save_garmin_tokens(conn, elder_id, crypto.encrypt(settings.token_encryption_key, new_token))
        db.upsert_daily_metrics(conn, snap, raw)
        db.mark_garmin_synced(conn, elder_id, snap.last_device_upload_at)
        for m in garmin_sync.blood_pressure_measurements(raw["blood_pressure"]):
            db.insert_reading(conn, elder_id, "blood_pressure", systolic=m["systolic"],
                              diastolic=m["diastolic"], pulse=m["pulse"], source="garmin",
                              external_id=m["external_id"], measured_at=m["measured_at"])
        db.merge_live(conn, snap, now_utc)
        snap = db.merge_recent_readings(conn, snap, now_utc - db.READINGS_LOOKBACK)
        evaluate_elder(conn, tg, snap, local_now)
        count += 1
    return count


# ---------- Dữ liệu trực tiếp từ đồng hồ (mỗi 5 phút, ứng dụng Connect IQ) ----------

def handle_watch_push(conn, tg: telegram.TelegramClient, calls: CallProvider, device: dict,
                      payload: dict, now_utc: datetime) -> None:
    ts = payload.get("ts")
    measured_at = datetime.fromtimestamp(ts, tz=timezone.utc) if ts else now_utc
    # Đồng hồ lệch giờ hoặc gửi bù dữ liệu cũ: không cho "đo" ở tương lai.
    measured_at = min(measured_at, now_utc)
    db.save_live_push(conn, str(device["id"]), str(device["elder_id"]), payload, measured_at)
    elder = {"id": device["elder_id"], "display_name": device["display_name"]}
    local = _local(now_utc, device["timezone"])
    evaluate_elder(conn, tg, db.snapshot_from_db(conn, elder, local.date(), now_utc), local)
    process_alerts(conn, tg, calls, now_utc)


def evaluate_all(conn, tg: telegram.TelegramClient, now_utc: datetime) -> None:
    """Kiểm lại mọi người thân, để phát hiện cả khi đồng hồ ngừng gửi dữ liệu."""
    for f in db.families(conn):
        local = _local(now_utc, f["timezone"])
        for e in db.elders_of_family(conn, f["id"]):
            evaluate_elder(conn, tg, db.snapshot_from_db(conn, e, local.date(), now_utc), local)


# ---------- Gửi và leo thang cảnh báo (mỗi 5 phút) ----------

def process_alerts(conn, tg: telegram.TelegramClient, calls: CallProvider, now_utc: datetime) -> None:
    for a in db.pending_alerts(conn):
        local_now = _local(now_utc, a["timezone"])
        alert = OpenAlert(
            id=str(a["id"]), elder_id=str(a["elder_id"]), elder_name=a["elder_name"],
            severity=a["severity"], message=a["message"], opened_at=a["opened_at"],
            escalation_step=a["escalation_step"], notified_at=a["notified_at"],
            acked_at=a["acked_at"], snoozed_until=a["snoozed_until"],
            rule_notify=a["rule_notify"],
        )
        steps = due_steps(alert, now_utc)
        if not steps or not should_notify_now(alert.severity, local_now, a["quiet_start"], a["quiet_end"]):
            continue
        next_step = alert.escalation_step
        for idx, step in steps:
            try:
                _run_step(conn, tg, calls, a, alert, step.action)
            except Exception:
                log.exception("Gửi cảnh báo %s bước %s lỗi", alert.id, idx)
                break
            next_step = idx + 1
        if next_step != alert.escalation_step:
            db.set_escalation(conn, alert.id, next_step, notified=True)


def _run_step(conn, tg, calls: CallProvider, a: dict, alert: OpenAlert, action: str) -> None:
    text = telegram.alert_text(alert.elder_name, alert.severity, alert.message,
                               _local(alert.opened_at, a["timezone"]))
    if action == "group":
        if alert.rule_notify == "elder" and a["elder_tg"]:
            tg.send(a["elder_tg"], f"Nhắc nhẹ: {escape(alert.message)}")
        elif a["telegram_chat_id"]:
            tg.send(a["telegram_chat_id"], text, telegram.alert_buttons(alert.id))
        return

    carers = db.caregivers_for_escalation(conn, a["family_id"])
    if action == "nearest_caregiver":
        nearest = next((c for c in carers if c["telegram_user_id"]), None)
        if nearest:
            tg.send(nearest["telegram_user_id"],
                    "Chưa ai nhận xử lý cảnh báo này sau 10 phút:\n\n" + text,
                    telegram.alert_buttons(alert.id))
    elif action == "call":
        for c in [c for c in carers if c["phone"]][:2]:
            msg = f"Cảnh báo sức khoẻ của {alert.elder_name}. {alert.message}"
            result = calls.call(c["phone"], msg)
            db.log_call(conn, alert.id, str(c["id"]), result.provider, result.status, result.detail)


# ---------- Nhắc thuốc ----------

def medication_reminders(conn, tg: telegram.TelegramClient, now_utc: datetime) -> None:
    for m in db.due_medications(conn, now_utc, MED_WINDOW):
        target = m["telegram_user_id"] or m["telegram_chat_id"]
        if not target:
            continue
        log_id = db.log_med_reminder(conn, str(m["schedule_id"]), m["due_at"])
        due_local = _local(m["due_at"], m["timezone"])
        name = m["name"] if m["telegram_user_id"] else f"{m['display_name']}: {m['name']}"
        tg.send(target, telegram.med_reminder_text(name, m["note"], due_local),
                [[("Đã uống", f"med:{log_id}")]])

    for m in db.missed_medications(conn, now_utc - MED_MISSED_AFTER):
        due_local = _local(m["due_at"], m["timezone"])
        msg = f"{m['display_name']} chưa xác nhận uống {m['name']} (giờ uống {due_local:%H:%M})"
        db.record_missed_med(conn, str(m["id"]), msg)
        if m["telegram_chat_id"]:
            tg.send(m["telegram_chat_id"], f"<b>Nhắc gia đình</b>\n{escape(msg)}")


# ---------- Báo cáo sáng / tối ----------

def _status(conn, elder_id: str) -> str:
    open_ = db.open_alerts_of(conn, elder_id)
    if any(a["metric"] == "no_sync_hours" for a in open_):
        return "Mất kết nối"
    if any(SEVERITY_RANK[a["severity"]] >= SEVERITY_RANK["warn"] for a in open_):
        return "Cần chú ý"
    return "Ổn định"


def family_report(conn, family: dict, now_utc: datetime, title: str) -> str:
    local_now = _local(now_utc, family["timezone"])
    items = []
    for e in db.elders_of_family(conn, family["id"]):
        snap = db.snapshot_from_db(conn, e, local_now.date(), now_utc)
        items.append((snap, _status(conn, str(e["id"]))))
    return telegram.report_text(f"{title} {local_now:%d/%m}", items)


def scheduled_reports(conn, tg: telegram.TelegramClient, now_utc: datetime) -> None:
    for f in db.families(conn):
        if not f["telegram_chat_id"]:
            continue
        local_now = _local(now_utc, f["timezone"])
        for kind, at, title in (("morning", f["morning_report_at"], "Báo cáo sáng"),
                                ("evening", f["evening_report_at"], "Tổng kết tối")):
            if at is None or not _within(local_now, at, REPORT_GRACE):
                continue
            if db.mark_report_sent(conn, str(f["id"]), kind, local_now.date()):
                tg.send(f["telegram_chat_id"], family_report(conn, f, now_utc, title))


def _within(local_now: datetime, at: time, grace: timedelta) -> bool:
    start = local_now.replace(hour=at.hour, minute=at.minute, second=0, microsecond=0)
    return start <= local_now < start + grace


def tick(conn, tg: telegram.TelegramClient, calls: CallProvider, now_utc: datetime) -> None:
    """Chạy mỗi 5 phút: kiểm ngưỡng, gửi/leo thang cảnh báo, nhắc thuốc, báo cáo định kỳ."""
    for step in (lambda: evaluate_all(conn, tg, now_utc),
                 lambda: process_alerts(conn, tg, calls, now_utc),
                 lambda: medication_reminders(conn, tg, now_utc),
                 lambda: scheduled_reports(conn, tg, now_utc)):
        try:
            step()
        except Exception:
            log.exception("Lỗi trong tick")


# ---------- Tin nhắn Telegram ----------

def handle_update(conn, tg: telegram.TelegramClient, calls: CallProvider, update: dict,
                  now_utc: datetime) -> None:
    if cq := update.get("callback_query"):
        _handle_callback(conn, tg, cq)
        return
    msg = update.get("message") or {}
    text = (msg.get("text") or "").strip()
    chat_id = (msg.get("chat") or {}).get("id")
    user_id = (msg.get("from") or {}).get("id")
    if not text or chat_id is None:
        return

    if text.startswith("/"):
        parts = text.split()
        cmd = parts[0][1:].split("@")[0].lower()
        arg = parts[1] if len(parts) > 1 else ""
        chat_type = (msg.get("chat") or {}).get("type", "private")
        if cmd in ("start", "ketnoi", "toi") and arg:
            _link_with_code(conn, tg, arg, chat_id, chat_type, user_id)
            return
        if cmd in ("id", "start"):
            tg.send(chat_id, f"chat_id: <code>{chat_id}</code>\nuser_id: <code>{user_id}</code>\n\n"
                             "Để nối với gia đình, lấy mã 6 số trên website (trang Gia đình) rồi gõ "
                             "<code>/ketnoi 123456</code> trong nhóm, hoặc ba mẹ nhắn <code>/toi 123456</code>.")
            return
        family = db.family_by_chat(conn, chat_id)
        if family is None:
            return
        if cmd == "tongquan":
            tg.send(chat_id, family_report(conn, family, now_utc, "Tình hình lúc"))
            return
        for e in db.elders_of_family(conn, family["id"]):
            if e["command"] and e["command"].lower() == cmd:
                local = _local(now_utc, family["timezone"])
                snap = db.snapshot_from_db(conn, e, local.date(), now_utc)
                tg.send(chat_id, telegram.snapshot_lines(snap, _status(conn, str(e["id"]))))
                return
        return

    # Ba mẹ tự nhắn chỉ số cho bot, ví dụ "130/85" hay "đường 7.2".
    elder = db.elder_by_telegram(conn, user_id) if user_id else None
    if elder is None:
        return
    reading = telegram.parse_reading(text)
    if reading is None:
        tg.send(chat_id, "Ba/mẹ nhắn chỉ số theo mẫu: <code>130/85</code>, "
                         "<code>đường 7.2</code> hoặc <code>cân 58</code> nhé.")
        return
    db.insert_reading(conn, str(elder["id"]), reading.kind, systolic=reading.systolic,
                      diastolic=reading.diastolic, pulse=reading.pulse, value=reading.value)
    tg.send(chat_id, "Đã ghi nhận. Cảm ơn ba/mẹ!")
    local = _local(now_utc, elder["timezone"])
    snap = db.snapshot_from_db(conn, elder, local.date(), now_utc)
    if reading.kind == "blood_pressure":  # lần đo vừa nhập là mới nhất
        snap.systolic, snap.diastolic = reading.systolic, reading.diastolic
    evaluate_elder(conn, tg, snap, local)
    process_alerts(conn, tg, calls, now_utc)


def _link_with_code(conn, tg: telegram.TelegramClient, code: str, chat_id: int, chat_type: str,
                    user_id: int | None) -> None:
    """Nối nhóm Telegram với gia đình, hoặc tài khoản Telegram của ba mẹ với hồ sơ của họ."""
    is_group = chat_type in ("group", "supergroup")
    link = db.consume_link_code(conn, code.strip(), "group" if is_group else "elder")
    if link is None:
        tg.send(chat_id, "Mã không đúng hoặc đã hết hạn. Lấy mã mới trên website, trang Gia đình."
                + ("" if is_group else " (Mã nối nhóm phải gõ trong nhóm gia đình.)"))
        return
    if is_group:
        db.set_family_chat(conn, str(link["family_id"]), chat_id)
        tg.send(chat_id, f"Đã nối nhóm này với <b>{escape(link['family_name'])}</b>. "
                         "Báo cáo và cảnh báo sẽ gửi vào đây. Gõ /tongquan để xem tình hình.")
    elif user_id:
        db.set_elder_telegram(conn, str(link["elder_id"]), user_id)
        tg.send(chat_id, f"Chào <b>{escape(link['elder_name'])}</b>! Từ giờ bot sẽ nhắc uống thuốc ở đây. "
                         "Đo huyết áp xong cứ nhắn số, ví dụ <code>130/85</code>, hoặc <code>đường 7.2</code>.")


def _handle_callback(conn, tg: telegram.TelegramClient, cq: dict) -> None:
    data = cq.get("data") or ""
    user_id = cq["from"]["id"]
    message = cq.get("message") or {}
    chat_id = (message.get("chat") or {}).get("id")
    action, _, ref = data.partition(":")

    if action == "med":
        row = db.mark_med_taken(conn, ref)
        tg.answer_callback(cq["id"], "Đã ghi nhận" if row else "Không tìm thấy")
        if row and chat_id:
            tg.clear_buttons(chat_id, message["message_id"])
            tg.send(chat_id, f"Đã uống: {escape(row['name'])}")
        return

    alert = db.alert_with_family(conn, ref)
    if alert is None:
        tg.answer_callback(cq["id"], "Cảnh báo không còn")
        return
    carer = db.caregiver_by_telegram(conn, str(alert["family_id"]), user_id)
    if carer is None:
        tg.answer_callback(cq["id"], "Bạn chưa có trong danh sách người chăm sóc")
        return
    if action == "ack":
        if db.ack_alert(conn, ref, str(carer["id"])):
            tg.answer_callback(cq["id"], "Cảm ơn, đã giao cho bạn")
            if chat_id:
                tg.clear_buttons(chat_id, message["message_id"])
            if alert["telegram_chat_id"]:
                tg.send(alert["telegram_chat_id"],
                        f"{escape(carer['display_name'])} đã nhận xử lý cảnh báo của "
                        f"{escape(alert['elder_name'])}.")
        else:
            tg.answer_callback(cq["id"], "Đã có người nhận rồi")
    elif action == "snooze":
        db.snooze_alert(conn, ref)
        tg.answer_callback(cq["id"], "Tạm tắt 2 giờ")
