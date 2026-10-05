"use server";

import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { isDemo, sql } from "@/lib/db";

export interface AdminState { ok: boolean; message: string; username?: string; webhook?: boolean }

const API_URL = (process.env.API_URL || "https://chamsocbame-api.vercel.app").replace(/\/$/, "");

function sameKey(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function telegram(token: string, method: string, body?: object): Promise<{ ok: boolean; result?: any; description?: string } | null> { // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}), cache: "no-store", signal: AbortSignal.timeout(10_000),
    });
    return await r.json();
  } catch {
    return null;
  }
}

/** Lưu token bot Telegram: kiểm tra với Telegram, lưu vào app_settings, đăng ký webhook cho máy chủ. */
export async function saveBot(_: AdminState, form: FormData): Promise<AdminState> {
  if (isDemo) return { ok: false, message: "Website chưa nối cơ sở dữ liệu nên chưa lưu được." };
  const expected = process.env.ADMIN_SETUP_KEY;
  if (!expected) return { ok: false, message: "Chưa đặt mã quản trị (biến ADMIN_SETUP_KEY trên Vercel)." };
  if (!sameKey(String(form.get("setup_key") ?? "").trim(), expected)) {
    await new Promise((r) => setTimeout(r, 800));
    return { ok: false, message: "Mã quản trị không đúng." };
  }

  const token = String(form.get("token") ?? "").trim();
  if (!/^\d{5,}:[A-Za-z0-9_-]{30,}$/.test(token)) {
    return { ok: false, message: "Token không đúng dạng. Token BotFather gửi trông như 123456789:AAH…" };
  }
  const me = await telegram(token, "getMe");
  if (!me?.ok || !me.result?.username) {
    return { ok: false, message: "Telegram không nhận token này. Kiểm tra lại trong @BotFather (lệnh /mybots → API Token)." };
  }
  const username = String(me.result.username);

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const hook = secret ? await telegram(token, "setWebhook", {
    url: `${API_URL}/api/telegram/webhook`, secret_token: secret,
    allowed_updates: ["message", "callback_query"], drop_pending_updates: true,
  }) : null;

  await sql()`
    insert into app_settings (key, value) values ('telegram_bot_token', ${token}), ('telegram_bot_username', ${username})
    on conflict (key) do update set value = excluded.value, updated_at = now()`;
  revalidatePath("/", "layout");
  return {
    ok: true, username, webhook: !!hook?.ok,
    message: hook?.ok ? `Đã kết nối bot @${username}. Bot đã sẵn sàng nhận tin nhắn.`
      : `Đã lưu bot @${username}, nhưng chưa đăng ký được nhận tin nhắn (${hook?.description ?? "thiếu TELEGRAM_WEBHOOK_SECRET"}).`,
  };
}
