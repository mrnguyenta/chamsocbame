"use server";

import { redirect } from "next/navigation";
import { getSession, safeNext, startSession } from "@/lib/auth";
import { isDemo, sql } from "@/lib/db";
import { EMAIL, hashPassword, normEmail, passwordProblem, slow, verifyPassword } from "@/lib/password";

export interface AuthState { ok: boolean; message: string }

const NO_DB: AuthState = { ok: false, message: "Website đang ở chế độ demo, chưa đăng nhập được." };

async function afterLogin(next: string | null): Promise<never> {
  redirect(next ?? ((await getSession()) ? "/" : "/bat-dau"));
}

export async function login(_: AuthState, form: FormData): Promise<AuthState> {
  if (isDemo) return NO_DB;
  const email = normEmail(form.get("email"));
  const pw = String(form.get("password") ?? "");
  const [a] = await sql()`select id, password_hash from accounts where email = ${email}`;
  if (!a || !(await verifyPassword(pw, a.password_hash))) {
    await slow();
    return { ok: false, message: "Sai email hoặc mật khẩu." };
  }
  await sql()`update accounts set last_login_at = now() where id = ${a.id}`;
  await startSession(a.id);
  return afterLogin(safeNext(form.get("next")));
}

export async function register(_: AuthState, form: FormData): Promise<AuthState> {
  if (isDemo) return NO_DB;
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  const email = normEmail(form.get("email"));
  const pw = String(form.get("password") ?? "");
  if (!name) return { ok: false, message: "Nhập tên của bạn." };
  if (!EMAIL.test(email)) return { ok: false, message: "Email không hợp lệ." };
  const err = passwordProblem(pw, String(form.get("password2") ?? ""));
  if (err) return { ok: false, message: err };
  const [a] = await sql()`
    insert into accounts (name, email, password_hash, last_login_at) values (${name}, ${email}, ${await hashPassword(pw)}, now())
    on conflict (email) do nothing returning id`;
  if (!a) return { ok: false, message: "Email này đã có tài khoản. Hãy đăng nhập." };
  await startSession(a.id);
  return afterLogin(safeNext(form.get("next")));
}
