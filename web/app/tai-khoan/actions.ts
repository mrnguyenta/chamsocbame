"use server";

import { revalidatePath } from "next/cache";
import { getIdentity, SAMPLE_BLOCKED } from "@/lib/auth";
import { isDemo, sql } from "@/lib/db";
import { hashPassword, passwordProblem, slow, verifyPassword } from "@/lib/password";

export interface AccountState { ok: boolean; message: string }

export async function changeOwnPassword(_: AccountState, form: FormData): Promise<AccountState> {
  if (isDemo) return { ok: false, message: "Chế độ demo." };
  const id = await getIdentity();
  if (!id) return { ok: false, message: "Hãy đăng nhập lại." };
  if (id.isSample) return { ok: false, message: SAMPLE_BLOCKED };
  const [a] = await sql()`select password_hash from accounts where id = ${id.accountId}`;
  if (!a || !(await verifyPassword(String(form.get("current") ?? ""), a.password_hash))) {
    await slow();
    return { ok: false, message: "Mật khẩu hiện tại không đúng." };
  }
  const pw = String(form.get("password") ?? "");
  const err = passwordProblem(pw, String(form.get("password2") ?? ""));
  if (err) return { ok: false, message: err };
  await sql()`update accounts set password_hash = ${await hashPassword(pw)} where id = ${id.accountId}`;
  return { ok: true, message: "Đã đổi mật khẩu." };
}

export async function renameAccount(_: AccountState, form: FormData): Promise<AccountState> {
  if (isDemo) return { ok: false, message: "Chế độ demo." };
  const id = await getIdentity();
  if (!id) return { ok: false, message: "Hãy đăng nhập lại." };
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  if (!name) return { ok: false, message: "Nhập tên." };
  await sql()`update accounts set name = ${name} where id = ${id.accountId}`;
  revalidatePath("/", "layout");
  return { ok: true, message: "Đã lưu tên." };
}
