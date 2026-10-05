"""Các việc chạy định kỳ và xử lý tin nhắn Telegram."""

from __future__ import annotations

import logging
from html import escape
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from garminconnect import GarminConnectAuthenticationError

from . import ai, crypto, db, facts, garmin_sync, rules, telegram, weekly
from .calls import CallProvider
from .config import Settings, web_base
from .escalation import due_steps, should_notify_now
from .models import SEVERITY_RANK, OpenAlert, Snapshot

log = logging.getLogger(__name__)


def _to_groups(tg: telegram.TelegramClient, chat_ids, text: str, buttons=None) -> None:
    """Gửi vào mọi nhóm Telegram của gia đình; một nhóm lỗi (bot bị xoá...) không chặn nhóm khác."""
    for chat_id in chat_ids or []:
        try:
            tg.send(chat_id, text, buttons)
        except Exception:
            log.exception("Gửi vào nhóm %s lỗi", chat_id)

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
        if (r["notified_at"] and same_day and r["chat_ids"]
                and SEVERITY_RANK[r["severity"]] >= SEVERITY_RANK["high"]):
            _to_groups(tg, r["chat_ids"], telegram.resolved_text(r["display_name"], r["message"]))


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
            if db.mark_garmin_error(conn, elder_id, "needs_relogin", str(e)) and acc["chat_ids"]:
                _to_groups(
                    tg, acc["chat_ids"],
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
        elif a["chat_ids"]:
            _to_groups(tg, a["chat_ids"], text, telegram.alert_buttons(alert.id))
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
        # Ba mẹ có Telegram thì nhắc riêng; không thì nhắc vào các nhóm gia đình.
        targets = [m["telegram_user_id"]] if m["telegram_user_id"] else list(m["chat_ids"] or [])
        if not targets:
            continue
        log_id = db.log_med_reminder(conn, str(m["schedule_id"]), m["due_at"])
        due_local = _local(m["due_at"], m["timezone"])
        name = m["name"] if m["telegram_user_id"] else f"{m['display_name']}: {m['name']}"
        _to_groups(tg, targets, telegram.med_reminder_text(name, m["note"], due_local),
                   [[("Đã uống", f"med:{log_id}")]])

    for m in db.missed_medications(conn, now_utc - MED_MISSED_AFTER):
        due_local = _local(m["due_at"], m["timezone"])
        msg = f"{m['display_name']} chưa xác nhận uống {m['name']} (giờ uống {due_local:%H:%M})"
        db.record_missed_med(conn, str(m["id"]), msg)
        _to_groups(tg, m["chat_ids"], f"<b>Nhắc gia đình</b>\n{escape(msg)}")


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
    items = facts.family_facts(conn, family, now_utc)
    return telegram.family_overview_text(f"{title} {local_now:%H:%M %d/%m}", items, web_base())


def scheduled_reports(conn, tg: telegram.TelegramClient, now_utc: datetime) -> None:
    for f in db.families(conn):
        if not f["chat_ids"]:
            continue
        local_now = _local(now_utc, f["timezone"])
        for kind, at, title in (("morning", f["morning_report_at"], "Báo cáo sáng"),
                                ("evening", f["evening_report_at"], "Tổng kết tối")):
            if at is None or not _within(local_now, at, REPORT_GRACE):
                continue
            if db.mark_report_sent(conn, str(f["id"]), kind, local_now.date()):
                _to_groups(tg, f["chat_ids"], family_report(conn, f, now_utc, title))


def weekly_reports(conn, tg: telegram.TelegramClient, now_utc: datetime) -> None:
    """Sáng Chủ nhật: báo cáo tuần (bảng + nhận xét AI) vào nhóm Telegram, kèm link xem trên web."""
    for f in weekly.due_families(conn, now_utc):
        try:
            weekly.send(conn, tg, f, now_utc)
        except Exception:
            log.exception("Báo cáo tuần gia đình %s lỗi", f["id"])


def _within(local_now: datetime, at: time, grace: timedelta) -> bool:
    start = local_now.replace(hour=at.hour, minute=at.minute, second=0, microsecond=0)
    return start <= local_now < start + grace


def tick(conn, tg: telegram.TelegramClient, calls: CallProvider, now_utc: datetime) -> None:
    """Chạy mỗi 5 phút: kiểm ngưỡng, gửi/leo thang cảnh báo, nhắc thuốc, báo cáo định kỳ."""
    for step in (lambda: fill_chat_titles(conn, tg),
                 lambda: evaluate_all(conn, tg, now_utc),
                 lambda: process_alerts(conn, tg, calls, now_utc),
                 lambda: medication_reminders(conn, tg, now_utc),
                 lambda: scheduled_reports(conn, tg, now_utc),
                 lambda: weekly_reports(conn, tg, now_utc)):
        try:
            step()
        except Exception:
            log.exception("Lỗi trong tick")


def fill_chat_titles(conn, tg: telegram.TelegramClient) -> None:
    """Nhóm nối từ trước khi lưu tên (hoặc chưa ai nhắn gì): hỏi Telegram tên nhóm để hiện trên website."""
    for chat_id in db.chats_without_title(conn):
        try:
            db.update_chat_title(conn, chat_id, tg.get_chat(chat_id).get("title"))
        except Exception:
            log.warning("Không lấy được tên nhóm %s", chat_id)


# ---------- Tin nhắn Telegram ----------

def handle_update(conn, tg: telegram.TelegramClient, calls: CallProvider, update: dict,
                  now_utc: datetime) -> None:
    if cq := update.get("callback_query"):
        _handle_callback(conn, tg, cq)
        return
    if member := update.get("my_chat_member"):
        # Bot bị xoá khỏi nhóm: gỡ nhóm khỏi gia đình để không gửi vào chỗ không còn nhận được.
        if (member.get("new_chat_member") or {}).get("status") in ("left", "kicked"):
            db.unlink_chat(conn, (member.get("chat") or {}).get("id"))
        return
    msg = update.get("message") or {}
    chat = msg.get("chat") or {}
    chat_id = chat.get("id")
    user_id = (msg.get("from") or {}).get("id")
    if chat_id is not None and msg.get("migrate_to_chat_id"):
        db.move_chat(conn, chat_id, msg["migrate_to_chat_id"])
        return
    if chat_id is not None and chat.get("type") in ("group", "supergroup"):
        db.update_chat_title(conn, chat_id, msg.get("new_chat_title") or chat.get("title"))
    text = (msg.get("text") or "").strip()
    if not text or chat_id is None:
        return

    if text.startswith("/"):
        parts = text.split()
        cmd = parts[0][1:].split("@")[0].lower()
        arg = parts[1] if len(parts) > 1 else ""
        chat_type = (msg.get("chat") or {}).get("type", "private")
        if cmd in ("start", "ketnoi", "toi") and arg:
            sender = msg.get("from") or {}
            name = " ".join(filter(None, [sender.get("first_name"), sender.get("last_name")])) or sender.get("username")
            _link_with_code(conn, tg, arg, chat_id, chat_type, user_id, name, chat.get("title"))
            return
        if cmd in ("id", "start"):
            tg.send(chat_id, f"chat_id: <code>{chat_id}</code>\nuser_id: <code>{user_id}</code>\n\n"
                             "Để nối với gia đình, lấy mã 6 số trên website (trang Gia đình) rồi gõ "
                             "<code>/ketnoi 123456</code> trong nhóm, hoặc ba mẹ nhắn <code>/toi 123456</code>.\n\n"
                             "Sau khi nối:\n<code>/tongquan</code> — tình hình cả nhà\n"
                             "<code>/hoi câu hỏi</code> — hỏi AI, ví dụ <code>/hoi Mẹ tuần này ngủ thế nào?</code>\n"
                             "<code>/baocaotuan</code> — báo cáo tuần ngay (tự gửi mỗi sáng Chủ nhật)")
            return
        if cmd in ("hoi", "ai", "baocaotuan"):
            family = db.family_by_chat(conn, chat_id) or (db.family_by_telegram_user(conn, user_id) if user_id else None)
            if family is None:
                tg.send(chat_id, "Chat này chưa nối với gia đình nào. Lấy mã trên website (trang Gia đình) rồi gõ "
                                 "<code>/ketnoi 123456</code>.")
                return
            if cmd == "baocaotuan":
                tg.send(chat_id, "📊 Đang làm báo cáo tuần…")
                report_id, data, comments = weekly.create(conn, family, now_utc)
                tg.send(chat_id, weekly.telegram_text(report_id, data, comments, web_base()))
                return
            question = text.split(maxsplit=1)[1] if len(text.split(maxsplit=1)) > 1 else ""
            if not question:
                tg.send(chat_id, "Hỏi AI về sức khoẻ cả nhà, ví dụ:\n<code>/hoi Mẹ Lan tuần này ngủ thế nào?</code>\n"
                                 "<code>/hoi Ba Hùng hôm nay đi bộ có đủ không?</code>")
                return
            tg.send(chat_id, "🤖 Đang xem số liệu…")
            try:
                answer = ai.ask(conn, family, question, now_utc)
            except ai.AIUnavailable as e:
                answer = str(e)
            tg.send(chat_id, f"🤖 {escape(answer)}")
            return
        family = db.family_by_chat(conn, chat_id)
        if family is None:
            return
        if cmd == "tongquan":
            tg.send(chat_id, family_report(conn, family, now_utc, "Tình hình lúc"))
            return
        for e in db.elders_of_family(conn, family["id"]):
            if e["command"] and e["command"].lower() == cmd:
                f = facts.elder_facts(conn, e, family["timezone"], now_utc)
                tg.send(chat_id, telegram.elder_detail_text(f, web_base()))
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
                    user_id: int | None, user_name: str | None = None, chat_title: str | None = None) -> None:
    """Nối nhóm Telegram với gia đình, hoặc Telegram riêng của ba mẹ / người chăm sóc với hồ sơ của họ."""
    is_group = chat_type in ("group", "supergroup")
    link = db.consume_link_code(conn, code.strip(), ("group",) if is_group else ("elder", "caregiver"))
    if link is None:
        tg.send(chat_id, "Mã không đúng hoặc đã hết hạn. Lấy mã mới trên website, trang Gia đình."
                + ("" if is_group else " (Mã nối nhóm phải gõ trong nhóm gia đình.)"))
        return
    if is_group:
        db.link_family_chat(conn, str(link["family_id"]), chat_id, chat_title)
        tg.send(chat_id, f"Đã nối nhóm này với <b>{escape(link['family_name'])}</b>. "
                         "Báo cáo và cảnh báo sẽ gửi vào đây. Gõ /tongquan để xem tình hình.")
    elif user_id and link["kind"] == "caregiver":
        db.set_caregiver_telegram(conn, str(link["caregiver_id"]), user_id, user_name)
        tg.send(chat_id, f"Chào <b>{escape(link['caregiver_name'])}</b>! Đã nối Telegram của bạn với "
                         f"<b>{escape(link['family_name'])}</b>. Cảnh báo cần bạn xử lý sẽ gửi riêng ở đây.")
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
            _to_groups(tg, alert["chat_ids"],
                       f"{escape(carer['display_name'])} đã nhận xử lý cảnh báo của "
                       f"{escape(alert['elder_name'])}.")
        else:
            tg.answer_callback(cq["id"], "Đã có người nhận rồi")
    elif action == "snooze":
        db.snooze_alert(conn, ref)
        tg.answer_callback(cq["id"], "Tạm tắt 2 giờ")
