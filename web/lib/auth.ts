import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isDemo, sql } from "./db";

const COOKIE = "csbm_session";
const FAMILY_COOKIE = "csbm_family";
const MAX_AGE_S = 30 * 24 * 3600;
const TELEGRAM_FIELDS = ["id", "first_name", "last_name", "username", "photo_url", "auth_date"];

/** Người đã đăng nhập bằng Telegram (có thể chưa thuộc gia đình nào). */
export interface Identity {
  tgId: number;
  name: string;
}

export interface Session extends Identity {
  caregiverId: string;
  familyId: string;
  familyName: string;
  isAdmin: boolean;
  families: { id: string; name: string }[];
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET phải dài ít nhất 32 ký tự");
  return s;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Kiểm tra dữ liệu Telegram Login Widget (https://core.telegram.org/widgets/login). */
export function verifyTelegramLogin(data: Record<string, string>, botToken: string, nowS: number): boolean {
  const hash = data.hash;
  if (!hash) return false;
  const check = TELEGRAM_FIELDS.filter((k) => data[k] !== undefined).sort().map((k) => `${k}=${data[k]}`).join("\n");
  const key = createHash("sha256").update(botToken).digest();
  const expected = createHmac("sha256", key).update(check).digest("hex");
  const authDate = Number(data.auth_date);
  return safeEqual(expected, hash) && Number.isFinite(authDate) && nowS - authDate < 24 * 3600;
}

export async function startSession(tgId: number, name: string): Promise<void> {
  const payload = Buffer.from(JSON.stringify({ tg: tgId, n: name, exp: Math.floor(Date.now() / 1000) + MAX_AGE_S }))
    .toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: MAX_AGE_S, path: "/",
  });
}

export async function endSession(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE);
  c.delete(FAMILY_COOKIE);
}

/** Chọn gia đình đang xem (người theo dõi nhiều gia đình). Quyền được kiểm lại mỗi lần đọc phiên. */
export async function selectFamily(familyId: string): Promise<void> {
  (await cookies()).set(FAMILY_COOKIE, familyId, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: MAX_AGE_S, path: "/",
  });
}

export async function getIdentity(): Promise<Identity | null> {
  if (isDemo) return { tgId: 0, name: "Khách (demo)" };
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig || !safeEqual(sign(payload), sig)) return null;
  try {
    const { tg, n, exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { tg: number; n: string; exp: number };
    if (!tg || exp < Date.now() / 1000) return null;
    return { tgId: tg, name: n };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const id = await getIdentity();
  if (!id) return null;
  if (isDemo) {
    return { ...id, caregiverId: "demo", familyId: "demo", familyName: "Gia đình (dữ liệu mẫu)", isAdmin: true,
      families: [{ id: "demo", name: "Gia đình (dữ liệu mẫu)" }] };
  }
  const rows = await sql()<{ id: string; family_id: string; role: string; family_name: string; display_name: string }[]>`
    select c.id, c.family_id, c.role, c.display_name, f.name as family_name
    from caregivers c join families f on f.id = c.family_id
    where c.telegram_user_id = ${id.tgId} order by c.created_at`;
  if (!rows.length) return null;
  const wanted = (await cookies()).get(FAMILY_COOKIE)?.value;
  const c = rows.find((r) => r.family_id === wanted) ?? rows[0];
  return {
    ...id, name: c.display_name, caregiverId: c.id, familyId: c.family_id, familyName: c.family_name,
    isAdmin: c.role === "admin", families: rows.map((r) => ({ id: r.family_id, name: r.family_name })),
  };
}

/** Trang cần gia đình: chưa đăng nhập → đăng nhập; đăng nhập rồi nhưng chưa có gia đình → bắt đầu. */
export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (s) return s;
  redirect((await getIdentity()) ? "/bat-dau" : "/dang-nhap");
}

export async function requireIdentity(next?: string): Promise<Identity> {
  const id = await getIdentity();
  if (!id) redirect(next ? `/dang-nhap?next=${encodeURIComponent(next)}` : "/dang-nhap");
  return id;
}
