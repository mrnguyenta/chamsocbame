"use server";

import { revalidatePath } from "next/cache";
import { getIdentity, sampleBlocked } from "@/lib/auth";
import { isDemo, sql } from "@/lib/db";
import { getT } from "@/lib/i18n-server";
import { hashPassword, passwordProblem, slow, verifyPassword } from "@/lib/password";

export interface AccountState { ok: boolean; message: string }

export async function changeOwnPassword(_: AccountState, form: FormData): Promise<AccountState> {
  const t = await getT();
  if (isDemo) return { ok: false, message: t("Chế độ demo.", "Demo mode.") };
  const id = await getIdentity();
  if (!id) return { ok: false, message: t("Hãy đăng nhập lại.", "Please sign in again.") };
  if (id.isSample) return { ok: false, message: sampleBlocked(t) };
  const [a] = await sql()`select password_hash from accounts where id = ${id.accountId}`;
  if (!a || !(await verifyPassword(String(form.get("current") ?? ""), a.password_hash))) {
    await slow();
    return { ok: false, message: t("Mật khẩu hiện tại không đúng.", "Your current password is incorrect.") };
  }
  const pw = String(form.get("password") ?? "");
  const err = passwordProblem(pw, String(form.get("password2") ?? ""), t);
  if (err) return { ok: false, message: err };
  await sql()`update accounts set password_hash = ${await hashPassword(pw)} where id = ${id.accountId}`;
  return { ok: true, message: t("Đã đổi mật khẩu.", "Password changed.") };
}

export async function renameAccount(_: AccountState, form: FormData): Promise<AccountState> {
  const t = await getT();
  if (isDemo) return { ok: false, message: t("Chế độ demo.", "Demo mode.") };
  const id = await getIdentity();
  if (!id) return { ok: false, message: t("Hãy đăng nhập lại.", "Please sign in again.") };
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  if (!name) return { ok: false, message: t("Nhập tên.", "Enter a name.") };
  await sql()`update accounts set name = ${name} where id = ${id.accountId}`;
  revalidatePath("/", "layout");
  return { ok: true, message: t("Đã lưu tên.", "Name saved.") };
}
