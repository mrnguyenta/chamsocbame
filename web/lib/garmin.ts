import "server-only";
import { getSession } from "./auth";
import { isDemo, sql } from "./db";

export const API_URL = (process.env.API_URL || "https://chamsocbame-api.vercel.app").replace(/\/$/, "");

/** Quản trị gia đình đang đăng nhập và người thân thuộc gia đình đó; null nếu không đủ quyền. */
export async function adminOfElder(elderId: string): Promise<{ familyId: string } | null> {
  if (isDemo) return null;
  const s = await getSession();
  if (!s?.isAdmin) return null;
  const [e] = await sql()`select id from elders where id = ${elderId} and family_id = ${s.familyId}`;
  return e ? { familyId: s.familyId } : null;
}

/** Lượt liên kết thuộc gia đình của quản trị đang đăng nhập. */
export async function linkRequestOfAdmin(requestId: string) {
  if (isDemo) return null;
  const s = await getSession();
  if (!s?.isAdmin) return null;
  const [r] = await sql()`
    select g.id, g.status, g.message from garmin_link_requests g join elders e on e.id = g.elder_id
    where g.id = ${requestId} and e.family_id = ${s.familyId}`;
  return r ?? null;
}
