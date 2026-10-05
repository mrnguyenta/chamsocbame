import { NextResponse, type NextRequest } from "next/server";
import { startSession, verifyTelegramLogin } from "@/lib/auth";

// Telegram Login Widget chuyển hướng về đây kèm id, first_name, auth_date, hash…
export async function GET(req: NextRequest) {
  const data = Object.fromEntries(req.nextUrl.searchParams.entries());
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const url = (path: string) => new URL(path, req.url);
  if (!token || !verifyTelegramLogin(data, token, Math.floor(Date.now() / 1000))) {
    return NextResponse.redirect(url("/dang-nhap?loi=invalid"));
  }
  const ok = await startSession(Number(data.id));
  return NextResponse.redirect(url(ok ? "/" : "/dang-nhap?loi=unknown"));
}
