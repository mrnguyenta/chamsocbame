import "server-only";
import { readSettings } from "./settings";

export interface BotConfig {
  token: string | null;
  username: string | null;
}

/** Bot Telegram: ưu tiên cấu hình nhập ở trang /quan-tri (bảng app_settings), không có thì lấy biến môi trường. */
export async function getBot(): Promise<BotConfig> {
  const s = await readSettings(["telegram_bot_token", "telegram_bot_username"]);
  let token = s.telegram_bot_token ?? process.env.TELEGRAM_BOT_TOKEN ?? null;
  const username = s.telegram_bot_username ?? process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? null;
  // Giá trị tạm đặt trên Vercel trước khi có bot.
  if (token === "chua-co-bot") token = null;
  return { token, username };
}
