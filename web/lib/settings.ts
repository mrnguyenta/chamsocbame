import "server-only";
import { isDemo, sql } from "./db";

/** Cấu hình hệ thống sửa ở trang /quan-tri (bảng app_settings). */
export type SettingKey = "telegram_bot_token" | "telegram_bot_username" | "watch_app_url" | "contact_email";

export async function readSettings(keys: SettingKey[]): Promise<Partial<Record<SettingKey, string>>> {
  if (isDemo) return {};
  try {
    const rows = await sql()<{ key: SettingKey; value: string }[]>`select key, value from app_settings where key in ${sql()(keys)}`;
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch {
    return {}; // bảng chưa có (chưa chạy migration)
  }
}

/** Ghi nhiều giá trị; null hoặc chuỗi rỗng là xoá. */
export async function writeSettings(values: Partial<Record<SettingKey, string | null>>): Promise<void> {
  await sql().begin(async (tx) => {
    for (const [key, value] of Object.entries(values)) {
      if (value) {
        await tx`insert into app_settings (key, value) values (${key}, ${value})
                 on conflict (key) do update set value = excluded.value, updated_at = now()`;
      } else {
        await tx`delete from app_settings where key = ${key}`;
      }
    }
  });
}

export async function getWatchAppUrl(): Promise<string | null> {
  return (await readSettings(["watch_app_url"])).watch_app_url ?? process.env.NEXT_PUBLIC_WATCH_APP_URL ?? null;
}

export async function getContactEmail(): Promise<string | null> {
  return (await readSettings(["contact_email"])).contact_email ?? process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? null;
}
