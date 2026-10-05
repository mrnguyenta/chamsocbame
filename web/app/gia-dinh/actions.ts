"use server";

import { randomBytes, randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getIdentity, requireSession, sampleBlocked, selectFamily } from "@/lib/auth";
import { isDemo, sql } from "@/lib/db";
import type { T } from "@/lib/i18n";
import { getT } from "@/lib/i18n-server";
import { CONDITION_KEYS } from "@/lib/metrics";
import { EMAIL, hashPassword, normEmail, passwordProblem } from "@/lib/password";

export interface FormState { ok: boolean; message: string; value?: string }

const demo = (t: T): FormState => ({ ok: false, message: t("Chế độ demo: thay đổi không được lưu.", "Demo mode: changes are not saved.") });
const ROLES = ["admin", "alerts", "reports"];
const txt = (f: FormData, k: string, max = 80) => String(f.get(k) ?? "").trim().slice(0, max);

async function admin(t: T) {
  const s = await requireSession();
  if (!s.isAdmin) throw new Error(t("Chỉ quản trị gia đình mới làm được việc này", "Only the family admin can do this"));
  return s;
}

function inviteCode(): string {
  const abc = "abcdefghijkmnpqrstuvwxyz23456789";
  return Array.from(randomBytes(10), (b) => abc[b % abc.length]).join("");
}

/** Người mới: tạo gia đình và trở thành quản trị. */
export async function createFamily(_: FormState, form: FormData): Promise<FormState> {
  const t = await getT();
  if (isDemo) return demo(t);
  const id = await getIdentity();
  if (!id) return { ok: false, message: t("Hãy đăng nhập lại.", "Please sign in again.") };
  if (id.isSample) return { ok: false, message: sampleBlocked(t) };
  const familyName = txt(form, "family_name") || t(`Gia đình ${id.name}`, `${id.name}'s family`);
  const myName = txt(form, "my_name") || id.name;
  const phone = txt(form, "phone", 20) || null;
  const famId = await sql().begin(async (tx) => {
    const [f] = await tx`insert into families (name) values (${familyName}) returning id`;
    await tx`insert into caregivers (family_id, display_name, account_id, email, phone, role, escalation_order)
             values (${f.id}, ${myName}, ${id.accountId}, ${id.email}, ${phone}, 'admin', 1)`;
    return f.id as string;
  });
  await selectFamily(famId);
  redirect("/gia-dinh?moi=1");
}

/** Nhận lời mời vào gia đình bằng mã trong link. */
export async function acceptInvite(_: FormState, form: FormData): Promise<FormState> {
  const t = await getT();
  if (isDemo) return demo(t);
  const id = await getIdentity();
  if (!id) return { ok: false, message: t("Hãy đăng nhập lại.", "Please sign in again.") };
  if (id.isSample) return { ok: false, message: sampleBlocked(t) };
  const code = txt(form, "code", 40).toLowerCase().replace(/[^a-z0-9]/g, "");
  const myName = txt(form, "my_name") || id.name;
  const phone = txt(form, "phone", 20) || null;
  const [inv] = await sql()`
    select family_id, role from invites where code = ${code} and revoked_at is null and expires_at > now()`;
  if (!inv) return { ok: false, message: t("Lời mời không đúng hoặc đã hết hạn. Xin người mời gửi link mới.",
    "This invite is invalid or has expired. Ask the person who invited you for a new link.") };
  await sql()`
    insert into caregivers (family_id, display_name, account_id, email, phone, role)
    values (${inv.family_id}, ${myName}, ${id.accountId}, ${id.email}, ${phone}, ${inv.role})
    on conflict (family_id, account_id) do nothing`;
  await selectFamily(inv.family_id);
  redirect("/");
}

export async function switchFamily(form: FormData): Promise<void> {
  const s = await requireSession();
  const fam = String(form.get("family_id"));
  if (s.families.some((f) => f.id === fam)) await selectFamily(fam);
  redirect("/");
}

export async function createInvite(_: FormState, form: FormData): Promise<FormState> {
  const t = await getT();
  if (isDemo) return { ok: true, message: t("Link mẫu (demo)", "Sample link (demo)"), value: "demo123abc" };
  try {
    const s = await admin(t);
    if (s.isSample) throw new Error(sampleBlocked(t));
    const role = String(form.get("role"));
    if (!ROLES.includes(role)) throw new Error(t("Quyền không hợp lệ", "Invalid role"));
    const code = inviteCode();
    await sql()`insert into invites (family_id, code, role, created_by) values (${s.familyId}, ${code}, ${role}, ${s.caregiverId})`;
    revalidatePath("/gia-dinh");
    return { ok: true, message: t("Đã tạo link mời, dùng được 7 ngày.", "Invite link created, valid for 7 days."), value: code };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function revokeInvite(form: FormData): Promise<void> {
  if (isDemo) return;
  const s = await admin(await getT());
  await sql()`update invites set revoked_at = now() where id = ${String(form.get("invite_id"))} and family_id = ${s.familyId}`;
  revalidatePath("/gia-dinh");
}

export async function updateMember(form: FormData): Promise<void> {
  if (isDemo) return;
  const s = await admin(await getT());
  const id = String(form.get("caregiver_id"));
  const action = String(form.get("action"));
  if (id === s.caregiverId) return; // không tự đổi quyền / tự xoá mình
  if (action === "remove") {
    await sql()`delete from caregivers where id = ${id} and family_id = ${s.familyId}`;
  } else if (ROLES.includes(action)) {
    await sql()`update caregivers set role = ${action} where id = ${id} and family_id = ${s.familyId}`;
  }
  revalidatePath("/gia-dinh");
}

/** Thêm ba mẹ / người thân; tự tạo ngưỡng cảnh báo theo bệnh nền. */
export async function addElder(_: FormState, form: FormData): Promise<FormState> {
  const t = await getT();
  if (isDemo) return demo(t);
  try {
    const s = await admin(t);
    const name = txt(form, "name");
    if (!name) throw new Error(t("Nhập cách gọi, ví dụ “Ba Hùng”", "Enter what you call them, e.g. “Dad”"));
    const year = Number(txt(form, "birth_year", 4)) || null;
    if (year && (year < 1900 || year > new Date().getFullYear())) throw new Error(t("Năm sinh không hợp lệ", "Invalid birth year"));
    const command = txt(form, "command", 20).toLowerCase().replace(/[^a-z0-9_]/g, "") || null;
    const conditions = CONDITION_KEYS.filter((c) => form.get(`c_${c}`) === "on");
    await sql().begin(async (tx) => {
      const [e] = await tx`
        insert into elders (family_id, display_name, birth_year, command, conditions)
        values (${s.familyId}, ${name}, ${year}, ${command}, ${conditions}) returning id`;
      await tx`select chamsoc_ensure_default_rules(${e.id}, ${conditions})`;
    });
    revalidatePath("/gia-dinh");
    revalidatePath("/");
    return { ok: true, message: t(`Đã thêm ${name}. Ngưỡng cảnh báo đã được tạo theo bệnh nền.`, `Added ${name}. Alert thresholds were created based on health conditions.`) };
  } catch (e) {
    const msg = (e as Error).message;
    return { ok: false, message: msg.includes("elders_family_id_command_key") ? t("Lệnh Telegram này đã dùng cho người khác.", "This Telegram command is already used for someone else.") : msg };
  }
}

/** Mã 6 số để nối nhóm Telegram (/ketnoi), Telegram của ba mẹ hoặc Telegram riêng của mình (/start), hiệu lực 30 phút. */
export async function createLinkCode(_: FormState, form: FormData): Promise<FormState> {
  const t = await getT();
  if (isDemo) return { ok: true, message: t("Mã mẫu (demo)", "Sample code (demo)"), value: "123456" };
  try {
    const raw = String(form.get("kind"));
    const kind = raw === "elder" ? "elder" : raw === "caregiver" ? "caregiver" : "group";
    // Ai cũng nối được Telegram của chính mình; nối nhóm và nối ba mẹ cần quyền quản trị.
    const s = kind === "caregiver" ? await requireSession() : await admin(t);
    const elderId = kind === "elder" ? String(form.get("elder_id")) : null;
    const caregiverId = kind === "caregiver" ? s.caregiverId : null;
    if (elderId) {
      const [e] = await sql()`select id from elders where id = ${elderId} and family_id = ${s.familyId}`;
      if (!e) throw new Error(t("Không tìm thấy người thân", "Family member not found"));
    }
    await sql()`delete from link_codes where expires_at < now() - interval '1 day'`;
    for (let i = 0; i < 10; i++) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const rows = await sql()`
        insert into link_codes (code, family_id, kind, elder_id, caregiver_id)
        values (${code}, ${s.familyId}, ${kind}, ${elderId}, ${caregiverId})
        on conflict (code) do nothing returning code`;
      if (rows.length) return { ok: true, message: t("Mã dùng được trong 30 phút.", "The code is valid for 30 minutes."), value: code };
    }
    throw new Error(t("Không tạo được mã, thử lại", "Could not create a code, try again"));
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/**
 * Quản trị thêm anh chị em bằng email. Email chưa có tài khoản: tạo tài khoản với mật khẩu ban đầu
 * (gửi cho người đó, họ đổi sau). Email đã có tài khoản: chỉ thêm vào gia đình.
 */
export async function addMember(_: FormState, form: FormData): Promise<FormState> {
  const t = await getT();
  if (isDemo) return demo(t);
  try {
    const s = await admin(t);
    // Tài khoản mẫu không được kéo tài khoản thật (hay tạo tài khoản mới) vào gia đình mẫu.
    if (s.isSample) throw new Error(sampleBlocked(t));
    const name = txt(form, "name");
    const email = normEmail(form.get("email"));
    const role = String(form.get("role"));
    const pw = String(form.get("password") ?? "");
    if (!name) throw new Error(t("Nhập tên người cần thêm.", "Enter the person's name."));
    if (!EMAIL.test(email)) throw new Error(t("Email không hợp lệ.", "Invalid email."));
    if (!ROLES.includes(role)) throw new Error(t("Quyền không hợp lệ", "Invalid role"));
    const [existing] = await sql()`select id from accounts where email = ${email}`;
    let accountId: string = existing?.id;
    let created = false;
    if (!accountId) {
      const err = passwordProblem(pw, undefined, t);
      if (err) throw new Error(t(`Email này chưa có tài khoản, cần đặt mật khẩu ban đầu. ${err}`,
        `This email has no account yet; set an initial password. ${err}`));
      const [a] = await sql()`
        insert into accounts (name, email, password_hash) values (${name}, ${email}, ${await hashPassword(pw)}) returning id`;
      accountId = a.id;
      created = true;
    }
    const rows = await sql()`
      insert into caregivers (family_id, display_name, account_id, email, role)
      values (${s.familyId}, ${name}, ${accountId}, ${email}, ${role})
      on conflict (family_id, account_id) do nothing returning id`;
    if (!rows.length) throw new Error(t("Người này đã ở trong gia đình.", "This person is already in the family."));
    revalidatePath("/gia-dinh");
    return {
      ok: true,
      message: created
        ? t(`Đã thêm ${name}. Gửi cho ${name}: đăng nhập bằng ${email} với mật khẩu bạn vừa đặt.`,
          `Added ${name}. Tell ${name}: sign in with ${email} and the password you just set.`)
        : t(`Đã thêm ${name} (dùng tài khoản ${email} có sẵn).`, `Added ${name} (using the existing account ${email}).`),
    };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/** Sửa thông tin ba mẹ / người thân; bệnh nền mới thì thêm ngưỡng còn thiếu. */
export async function updateElder(_: FormState, form: FormData): Promise<FormState> {
  const t = await getT();
  if (isDemo) return demo(t);
  try {
    const s = await admin(t);
    const elderId = String(form.get("elder_id"));
    const name = txt(form, "name");
    if (!name) throw new Error(t("Nhập cách gọi, ví dụ “Ba Hùng”", "Enter what you call them, e.g. “Dad”"));
    const year = Number(txt(form, "birth_year", 4)) || null;
    if (year && (year < 1900 || year > new Date().getFullYear())) throw new Error(t("Năm sinh không hợp lệ", "Invalid birth year"));
    const command = txt(form, "command", 20).toLowerCase().replace(/[^a-z0-9_]/g, "") || null;
    const conditions = CONDITION_KEYS.filter((c) => form.get(`c_${c}`) === "on");
    const rows = await sql()`
      update elders set display_name = ${name}, birth_year = ${year}, command = ${command}, conditions = ${conditions}
      where id = ${elderId} and family_id = ${s.familyId} returning id`;
    if (!rows.length) throw new Error(t("Không tìm thấy người thân", "Family member not found"));
    await sql()`select chamsoc_ensure_default_rules(${elderId}, ${conditions})`;
    revalidatePath("/", "layout");
    return { ok: true, message: t(`Đã lưu thông tin ${name}.`, `Saved ${name}'s details.`) };
  } catch (e) {
    const msg = (e as Error).message;
    return { ok: false, message: msg.includes("elders_family_id_command_key") ? t("Lệnh Telegram này đã dùng cho người khác.", "This Telegram command is already used for someone else.") : msg };
  }
}

/** Xoá một người thân cùng toàn bộ dữ liệu (chỉ số, cảnh báo, thuốc, đồng hồ đã ghép). */
export async function deleteElder(elderId: string): Promise<FormState> {
  const t = await getT();
  if (isDemo) return demo(t);
  try {
    const s = await admin(t);
    const rows = await sql()`delete from elders where id = ${elderId} and family_id = ${s.familyId} returning display_name`;
    if (!rows.length) throw new Error(t("Không tìm thấy người thân", "Family member not found"));
    revalidatePath("/", "layout");
    return { ok: true, message: t(`Đã xoá ${rows[0].display_name}.`, `Deleted ${rows[0].display_name}.`) };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/** Sửa tên hiển thị và số điện thoại của người chăm sóc (quản trị sửa được mọi người, ai cũng sửa được mình). */
export async function updateMemberInfo(_: FormState, form: FormData): Promise<FormState> {
  const t = await getT();
  if (isDemo) return demo(t);
  try {
    const s = await requireSession();
    const id = String(form.get("caregiver_id"));
    if (id !== s.caregiverId && !s.isAdmin) throw new Error(t("Chỉ quản trị gia đình mới sửa được thông tin người khác.", "Only the family admin can edit other people's details."));
    const name = txt(form, "name");
    if (!name) throw new Error(t("Nhập tên.", "Enter a name."));
    const phone = txt(form, "phone", 20) || null;
    const rows = await sql()`
      update caregivers set display_name = ${name}, phone = ${phone}
      where id = ${id} and family_id = ${s.familyId} returning id`;
    if (!rows.length) throw new Error(t("Không tìm thấy người này.", "Person not found."));
    revalidatePath("/", "layout");
    return { ok: true, message: t("Đã lưu.", "Saved.") };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/** Gỡ một nhóm Telegram khỏi gia đình (bot không gửi vào nhóm đó nữa). */
export async function unlinkGroup(form: FormData): Promise<void> {
  if (isDemo) return;
  const s = await admin(await getT());
  await sql()`delete from family_chats where chat_id = ${String(form.get("chat_id"))}::bigint and family_id = ${s.familyId}`;
  revalidatePath("/gia-dinh");
}
