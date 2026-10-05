"use server";

import { redirect } from "next/navigation";
import { endSession, getSession, safeNext, startSession } from "@/lib/auth";
import { isDemo, sql } from "@/lib/db";
import { makeT, type T } from "@/lib/i18n";
import { getLang, getT } from "@/lib/i18n-server";
import { EMAIL, hashPassword, normEmail, passwordProblem, slow, verifyPassword } from "@/lib/password";

export interface AuthState { ok: boolean; message: string }

const noDb = (t: T): AuthState => ({ ok: false, message: t("Website đang ở chế độ demo, chưa đăng nhập được.", "The website is in demo mode; signing in isn't available yet.") });

async function afterLogin(next: string | null): Promise<never> {
  redirect(next ?? ((await getSession()) ? "/" : "/bat-dau"));
}

export async function login(_: AuthState, form: FormData): Promise<AuthState> {
  const t = await getT();
  if (isDemo) return noDb(t);
  const email = normEmail(form.get("email"));
  const pw = String(form.get("password") ?? "");
  const [a] = await sql()`select id, password_hash from accounts where email = ${email}`;
  if (!a || !(await verifyPassword(pw, a.password_hash))) {
    await slow();
    return { ok: false, message: t("Sai email hoặc mật khẩu.", "Wrong email or password.") };
  }
  await sql()`update accounts set last_login_at = now() where id = ${a.id}`;
  await startSession(a.id);
  return afterLogin(safeNext(form.get("next")));
}

export async function register(_: AuthState, form: FormData): Promise<AuthState> {
  const t = await getT();
  if (isDemo) return noDb(t);
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  const email = normEmail(form.get("email"));
  const pw = String(form.get("password") ?? "");
  if (!name) return { ok: false, message: t("Nhập tên của bạn.", "Enter your name.") };
  if (!EMAIL.test(email)) return { ok: false, message: t("Email không hợp lệ.", "Invalid email address.") };
  const err = passwordProblem(pw, String(form.get("password2") ?? ""), t);
  if (err) return { ok: false, message: err };
  const [a] = await sql()`
    insert into accounts (name, email, password_hash, last_login_at) values (${name}, ${email}, ${await hashPassword(pw)}, now())
    on conflict (email) do nothing returning id`;
  if (!a) return { ok: false, message: t("Email này đã có tài khoản. Hãy đăng nhập.", "This email already has an account. Please sign in.") };
  await startSession(a.id);
  return afterLogin(safeNext(form.get("next")));
}

/** "Xem tài khoản mẫu": tạo một gia đình mẫu riêng cho người này (tự xoá sau 24 giờ) rồi đăng nhập vào. */
export async function startSample(_: AuthState, form: FormData): Promise<AuthState> {
  if (isDemo) redirect("/");
  const lang = await getLang();
  const t = makeT(lang);
  try {
    // Dọn mẫu quá 24 giờ (backend cũng dọn mỗi 5 phút) rồi tạo mẫu mới.
    await sql()`delete from families where expires_at < now()`;
    await sql()`delete from accounts where is_sample and expires_at < now()`;
    const [r] = await sql()`select chamsoc_create_sample(${lang === "en" ? "Guest" : "Khách"}) as id`;
    if (lang === "en") {
      await sql()`update families set name = 'Sample family' where id in (select family_id from caregivers where account_id = ${r.id})`;
      // Ghi chú thuốc mẫu cũng bằng tiếng Anh (tên người giữ nguyên).
      await sql()`
        update med_schedules m set note = v.en
        from (values ('huyết áp, sau ăn sáng', 'blood pressure, after breakfast'), ('sau ăn', 'after meals'),
                     ('tim mạch, buổi sáng', 'heart, in the morning')) v(vi, en),
             elders e, caregivers c
        where m.note = v.vi and e.id = m.elder_id and c.family_id = e.family_id and c.account_id = ${r.id}`;
    }
    await endSession();
    await startSession(r.id, 24 * 3600);
  } catch (e) {
    const busy = String((e as Error).message).includes("too_many_samples");
    return { ok: false, message: busy
      ? t("Đang có nhiều người xem thử, vui lòng thử lại sau ít phút.", "Many people are trying the demo right now. Please try again in a few minutes.")
      : t("Chưa tạo được tài khoản mẫu, thử lại sau.", "Couldn't create the demo account. Please try again later.") };
  }
  redirect(safeNext(form.get("next")) ?? "/");
}
