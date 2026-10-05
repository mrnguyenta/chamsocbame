import { NextResponse, type NextRequest } from "next/server";
import { getSession, startSession, verifyTelegramLogin } from "@/lib/auth";

// Telegram Login Widget chuyển hướng về đây kèm id, first_name, auth_date, hash… (và ?next= của mình).
export async function GET(req: NextRequest) {
  const data = Object.fromEntries(req.nextUrl.searchParams.entries());
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const url = (path: string) => new URL(path, req.url);
  if (!token || !verifyTelegramLogin(data, token, Math.floor(Date.now() / 1000))) {
    return NextResponse.redirect(url("/dang-nhap?loi=invalid"));
  }
  const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || data.username || "Bạn";
  await startSession(Number(data.id), name);
  const next = data.next && data.next.startsWith("/") && !data.next.startsWith("//") ? data.next : null;
  if (next) return NextResponse.redirect(url(next));
  return NextResponse.redirect(url((await getSession()) ? "/" : "/bat-dau"));
}
