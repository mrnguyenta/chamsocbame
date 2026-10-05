import "server-only";
import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isDemo, sql } from "./db";
import { safeEqual } from "./password";

const COOKIE = "csbm_session";
const FAMILY_COOKIE = "csbm_family";
const MAX_AGE_S = 30 * 24 * 3600;

/** Người đã đăng nhập bằng email (có thể chưa thuộc gia đình nào). */
export interface Identity {
  accountId: string;
  name: string;
  email: string;
  isSystemAdmin: boolean;
  /** Tài khoản mẫu (nút "Xem tài khoản mẫu"): tự xoá sau 24 giờ, không đụng tới người thật. */
  isSample: boolean;
}

/** Lời báo khi tài khoản mẫu bấm vào việc chỉ tài khoản thật làm được. */
export const SAMPLE_BLOCKED = "Tài khoản mẫu không làm được việc này. Hãy đăng ký tài khoản thật (miễn phí).";

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

const cookieOpts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, maxAge: MAX_AGE_S, path: "/" };

export async function startSession(accountId: string, maxAgeS = MAX_AGE_S): Promise<void> {
  const payload = Buffer.from(JSON.stringify({ a: accountId, exp: Math.floor(Date.now() / 1000) + maxAgeS })).toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, { ...cookieOpts, maxAge: maxAgeS });
}

export async function endSession(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE);
  c.delete(FAMILY_COOKIE);
}

/** Chọn gia đình đang xem (người theo dõi nhiều gia đình). Quyền được kiểm lại mỗi lần đọc phiên. */
export async function selectFamily(familyId: string): Promise<void> {
  (await cookies()).set(FAMILY_COOKIE, familyId, cookieOpts);
}

/** Tài khoản đang đăng nhập; đọc lại từ cơ sở dữ liệu mỗi lần để tài khoản bị xoá mất quyền ngay. */
export async function getIdentity(): Promise<Identity | null> {
  if (isDemo) return { accountId: "demo", name: "Khách (demo)", email: "demo@example.com", isSystemAdmin: true, isSample: false };
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig || !safeEqual(sign(payload), sig)) return null;
  try {
    const { a, exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { a?: string; exp: number };
    if (!a || exp < Date.now() / 1000) return null;
    const [r] = await sql()`select id, name, email, is_system_admin, is_sample from accounts where id = ${a}`;
    return r ? { accountId: r.id, name: r.name, email: r.email, isSystemAdmin: r.is_system_admin, isSample: r.is_sample } : null;
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
    where c.account_id = ${id.accountId} order by c.created_at`;
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

/** Đường dẫn quay lại sau đăng nhập: chỉ nhận đường dẫn trong website. */
export function safeNext(next: unknown): string | null {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : null;
}
