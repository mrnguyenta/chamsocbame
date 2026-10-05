import "server-only";
import { isDemo, sql } from "./db";

export interface BotConfig {
  token: string | null;
  username: string | null;
}

/** Bot Telegram: ưu tiên cấu hình nhập ở trang /quan-tri (bảng app_settings), không có thì lấy biến môi trường. */
export async function getBot(): Promise<BotConfig> {
  let token = process.env.TELEGRAM_BOT_TOKEN || null;
  let username = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || null;
  if (!isDemo) {
    try {
      const rows = await sql()<{ key: string; value: string }[]>`
        select key, value from app_settings where key in ('telegram_bot_token', 'telegram_bot_username')`;
      for (const r of rows) {
        if (r.key === "telegram_bot_token") token = r.value;
        if (r.key === "telegram_bot_username") username = r.value;
      }
    } catch {
      // Bảng chưa có (chưa chạy migration): dùng biến môi trường.
    }
  }
  // Giá trị tạm đặt trên Vercel trước khi có bot.
  if (token === "chua-co-bot") token = null;
  return { token, username };
}
