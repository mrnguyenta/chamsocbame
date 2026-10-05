import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isDemo, sql } from "./db";

const COOKIE = "csbm_session";
const MAX_AGE_S = 30 * 24 * 3600;

export interface Session {
  caregiverId: string;
  familyId: string;
  name: string;
  isAdmin: boolean;
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET phải dài ít nhất 32 ký tự");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Kiểm tra dữ liệu Telegram Login Widget (https://core.telegram.org/widgets/login). */
export function verifyTelegramLogin(data: Record<string, string>, botToken: string, nowS: number): boolean {
  const { hash, ...rest } = data;
  if (!hash) return false;
  const check = Object.keys(rest).sort().map((k) => `${k}=${rest[k]}`).join("\n");
  const key = createHash("sha256").update(botToken).digest();
  const expected = createHmac("sha256", key).update(check).digest("hex");
  const authDate = Number(rest.auth_date);
  return safeEqual(expected, hash) && Number.isFinite(authDate) && nowS - authDate < 24 * 3600;
}

export async function startSession(telegramUserId: number): Promise<boolean> {
  const [c] = await sql()<{ id: string }[]>`
    select id from caregivers where telegram_user_id = ${telegramUserId} order by created_at limit 1`;
  if (!c) return false;
  const payload = Buffer.from(JSON.stringify({ cid: c.id, exp: Math.floor(Date.now() / 1000) + MAX_AGE_S }))
    .toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: MAX_AGE_S, path: "/",
  });
  return true;
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  if (isDemo) return { caregiverId: "demo", familyId: "demo", name: "Khách (demo)", isAdmin: true };
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig || !safeEqual(sign(payload), sig)) return null;
  const { cid, exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { cid: string; exp: number };
  if (exp < Date.now() / 1000) return null;
  const [c] = await sql()<{ id: string; family_id: string; display_name: string; role: string }[]>`
    select id, family_id, display_name, role from caregivers where id = ${cid}`;
  if (!c) return null;
  return { caregiverId: c.id, familyId: c.family_id, name: c.display_name, isAdmin: c.role === "admin" };
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/dang-nhap");
  return s;
}
