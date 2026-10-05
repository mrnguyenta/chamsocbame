"use server";

import { revalidatePath } from "next/cache";
import { getIdentity } from "@/lib/auth";
import { isDemo, sql } from "@/lib/db";
import { hashPassword, passwordProblem, safeEqual, slow } from "@/lib/password";
import { writeSettings } from "@/lib/settings";

export interface AdminState { ok: boolean; message: string; username?: string }

const API_URL = (process.env.API_URL || "https://chamsocbame-api.vercel.app").replace(/\/$/, "");
const NO_DB: AdminState = { ok: false, message: "Website chưa nối cơ sở dữ liệu." };
const txt = (f: FormData, k: string, max = 300) => String(f.get(k) ?? "").trim().slice(0, max);

async function requireSystemAdmin() {
  const id = await getIdentity();
  if (!id?.isSystemAdmin) throw new Error("Chỉ quản trị hệ thống mới làm được việc này.");
  return id;
}

/** Tài khoản đầu tiên nhận quyền quản trị hệ thống bằng mã ADMIN_SETUP_KEY (đặt trên Vercel). */
export async function claimSystemAdmin(_: AdminState, form: FormData): Promise<AdminState> {
  if (isDemo) return NO_DB;
  const id = await getIdentity();
  if (!id) return { ok: false, message: "Hãy đăng nhập trước." };
  const expected = process.env.ADMIN_SETUP_KEY;
  if (!expected) return { ok: false, message: "Chưa đặt mã ADMIN_SETUP_KEY trên Vercel." };
  if (!safeEqual(txt(form, "setup_key"), expected)) {
    await slow();
    return { ok: false, message: "Mã khởi tạo không đúng." };
  }
  const rows = await sql()`
    update accounts set is_system_admin = true
    where id = ${id.accountId} and not exists (select 1 from accounts where is_system_admin) returning id`;
  if (!rows.length) return { ok: false, message: "Hệ thống đã có quản trị viên. Nhờ họ cấp quyền cho bạn." };
  revalidatePath("/quan-tri");
  return { ok: true, message: "Bạn đã là quản trị hệ thống." };
}

async function telegram(token: string, method: string, body?: object): Promise<{ ok: boolean; result?: any; description?: string } | null> { // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}),
      cache: "no-store", signal: AbortSignal.timeout(10_000),
    });
    return await r.json();
  } catch {
    return null;
  }
}

/** Lưu token bot: kiểm tra với Telegram, lưu vào app_settings, đăng ký webhook cho máy chủ. */
export async function saveBot(_: AdminState, form: FormData): Promise<AdminState> {
  if (isDemo) return NO_DB;
  try {
    await requireSystemAdmin();
    const token = txt(form, "token");
    if (!/^\d{5,}:[A-Za-z0-9_-]{30,}$/.test(token)) {
      return { ok: false, message: "Token không đúng dạng. Token BotFather gửi trông như 123456789:AAH…" };
    }
    const me = await telegram(token, "getMe");
    if (!me?.ok || !me.result?.username) {
      return { ok: false, message: "Telegram không nhận token này. Kiểm tra lại trong @BotFather (/mybots → API Token)." };
    }
    const username = String(me.result.username);
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const hook = secret ? await telegram(token, "setWebhook", {
      url: `${API_URL}/api/telegram/webhook`, secret_token: secret,
      allowed_updates: ["message", "callback_query"], drop_pending_updates: true,
    }) : null;
    await writeSettings({ telegram_bot_token: token, telegram_bot_username: username });
    revalidatePath("/", "layout");
    return {
      ok: true, username,
      message: hook?.ok ? `Đã kết nối bot @${username}. Bot sẵn sàng gửi cảnh báo và nhận tin nhắn.`
        : `Đã lưu bot @${username}, nhưng chưa đăng ký được nhận tin nhắn (${hook?.description ?? "thiếu TELEGRAM_WEBHOOK_SECRET"}).`,
    };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/** Link ứng dụng trên Connect IQ Store và email liên hệ (trang quyền riêng tư). */
export async function saveGeneral(_: AdminState, form: FormData): Promise<AdminState> {
  if (isDemo) return NO_DB;
  try {
    await requireSystemAdmin();
    const store = txt(form, "watch_app_url");
    if (store && !/^https:\/\/apps\.garmin\.com\/\S+$/.test(store)) {
      return { ok: false, message: "Link Store phải bắt đầu bằng https://apps.garmin.com/" };
    }
    const email = txt(form, "contact_email", 120);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "Email không hợp lệ." };
    await writeSettings({ watch_app_url: store || null, contact_email: email || null });
    revalidatePath("/", "layout");
    return { ok: true, message: "Đã lưu." };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/** Đặt lại mật khẩu cho một tài khoản (người dùng quên mật khẩu). */
export async function resetPassword(_: AdminState, form: FormData): Promise<AdminState> {
  if (isDemo) return NO_DB;
  try {
    await requireSystemAdmin();
    const pw = String(form.get("password") ?? "");
    const err = passwordProblem(pw);
    if (err) return { ok: false, message: err };
    const [a] = await sql()`
      update accounts set password_hash = ${await hashPassword(pw)} where id = ${txt(form, "account_id", 40)} returning email`;
    if (!a) return { ok: false, message: "Không tìm thấy tài khoản." };
    return { ok: true, message: `Đã đặt mật khẩu mới cho ${a.email}. Gửi mật khẩu này cho họ.` };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function setSystemAdmin(form: FormData): Promise<void> {
  if (isDemo) return;
  const me = await requireSystemAdmin();
  const id = String(form.get("account_id"));
  if (id === me.accountId) return; // không tự bỏ quyền mình
  await sql()`update accounts set is_system_admin = ${form.get("value") === "1"} where id = ${id}`;
  revalidatePath("/quan-tri");
}
