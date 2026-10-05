"use server";

import { randomBytes, randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getIdentity, requireSession, selectFamily } from "@/lib/auth";
import { isDemo, sql } from "@/lib/db";
import { CONDITIONS } from "@/lib/metrics";
import { EMAIL, hashPassword, normEmail, passwordProblem } from "@/lib/password";

export interface FormState { ok: boolean; message: string; value?: string }

const DEMO: FormState = { ok: false, message: "Chế độ demo: thay đổi không được lưu." };
const ROLES = ["admin", "alerts", "reports"];
const txt = (f: FormData, k: string, max = 80) => String(f.get(k) ?? "").trim().slice(0, max);

async function admin() {
  const s = await requireSession();
  if (!s.isAdmin) throw new Error("Chỉ quản trị gia đình mới làm được việc này");
  return s;
}

function inviteCode(): string {
  const abc = "abcdefghijkmnpqrstuvwxyz23456789";
  return Array.from(randomBytes(10), (b) => abc[b % abc.length]).join("");
}

/** Người mới: tạo gia đình và trở thành quản trị. */
export async function createFamily(_: FormState, form: FormData): Promise<FormState> {
  if (isDemo) return DEMO;
  const id = await getIdentity();
  if (!id) return { ok: false, message: "Hãy đăng nhập lại." };
  const familyName = txt(form, "family_name") || `Gia đình ${id.name}`;
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
  if (isDemo) return DEMO;
  const id = await getIdentity();
  if (!id) return { ok: false, message: "Hãy đăng nhập lại." };
  const code = txt(form, "code", 40).toLowerCase().replace(/[^a-z0-9]/g, "");
  const myName = txt(form, "my_name") || id.name;
  const phone = txt(form, "phone", 20) || null;
  const [inv] = await sql()`
    select family_id, role from invites where code = ${code} and revoked_at is null and expires_at > now()`;
  if (!inv) return { ok: false, message: "Lời mời không đúng hoặc đã hết hạn. Xin người mời gửi link mới." };
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
  if (isDemo) return { ok: true, message: "Link mẫu (demo)", value: "demo123abc" };
  try {
    const s = await admin();
    const role = String(form.get("role"));
    if (!ROLES.includes(role)) throw new Error("Quyền không hợp lệ");
    const code = inviteCode();
    await sql()`insert into invites (family_id, code, role, created_by) values (${s.familyId}, ${code}, ${role}, ${s.caregiverId})`;
    revalidatePath("/gia-dinh");
    return { ok: true, message: "Đã tạo link mời, dùng được 7 ngày.", value: code };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function revokeInvite(form: FormData): Promise<void> {
  if (isDemo) return;
  const s = await admin();
  await sql()`update invites set revoked_at = now() where id = ${String(form.get("invite_id"))} and family_id = ${s.familyId}`;
  revalidatePath("/gia-dinh");
}

export async function updateMember(form: FormData): Promise<void> {
  if (isDemo) return;
  const s = await admin();
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
  if (isDemo) return DEMO;
  try {
    const s = await admin();
    const name = txt(form, "name");
    if (!name) throw new Error("Nhập cách gọi, ví dụ “Ba Hùng”");
    const year = Number(txt(form, "birth_year", 4)) || null;
    if (year && (year < 1900 || year > new Date().getFullYear())) throw new Error("Năm sinh không hợp lệ");
    const command = txt(form, "command", 20).toLowerCase().replace(/[^a-z0-9_]/g, "") || null;
    const conditions = Object.keys(CONDITIONS).filter((c) => form.get(`c_${c}`) === "on");
    await sql().begin(async (tx) => {
      const [e] = await tx`
        insert into elders (family_id, display_name, birth_year, command, conditions)
        values (${s.familyId}, ${name}, ${year}, ${command}, ${conditions}) returning id`;
      await tx`select chamsoc_ensure_default_rules(${e.id}, ${conditions})`;
    });
    revalidatePath("/gia-dinh");
    revalidatePath("/");
    return { ok: true, message: `Đã thêm ${name}. Ngưỡng cảnh báo đã được tạo theo bệnh nền.` };
  } catch (e) {
    const msg = (e as Error).message;
    return { ok: false, message: msg.includes("elders_family_id_command_key") ? "Lệnh Telegram này đã dùng cho người khác." : msg };
  }
}

/** Mã 6 số để nối nhóm Telegram (/ketnoi), Telegram của ba mẹ hoặc Telegram riêng của mình (/start), hiệu lực 30 phút. */
export async function createLinkCode(_: FormState, form: FormData): Promise<FormState> {
  if (isDemo) return { ok: true, message: "Mã mẫu (demo)", value: "123456" };
  try {
    const raw = String(form.get("kind"));
    const kind = raw === "elder" ? "elder" : raw === "caregiver" ? "caregiver" : "group";
    // Ai cũng nối được Telegram của chính mình; nối nhóm và nối ba mẹ cần quyền quản trị.
    const s = kind === "caregiver" ? await requireSession() : await admin();
    const elderId = kind === "elder" ? String(form.get("elder_id")) : null;
    const caregiverId = kind === "caregiver" ? s.caregiverId : null;
    if (elderId) {
      const [e] = await sql()`select id from elders where id = ${elderId} and family_id = ${s.familyId}`;
      if (!e) throw new Error("Không tìm thấy người thân");
    }
    await sql()`delete from link_codes where expires_at < now() - interval '1 day'`;
    for (let i = 0; i < 10; i++) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const rows = await sql()`
        insert into link_codes (code, family_id, kind, elder_id, caregiver_id)
        values (${code}, ${s.familyId}, ${kind}, ${elderId}, ${caregiverId})
        on conflict (code) do nothing returning code`;
      if (rows.length) return { ok: true, message: "Mã dùng được trong 30 phút.", value: code };
    }
    throw new Error("Không tạo được mã, thử lại");
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/**
 * Quản trị thêm anh chị em bằng email. Email chưa có tài khoản: tạo tài khoản với mật khẩu ban đầu
 * (gửi cho người đó, họ đổi sau). Email đã có tài khoản: chỉ thêm vào gia đình.
 */
export async function addMember(_: FormState, form: FormData): Promise<FormState> {
  if (isDemo) return DEMO;
  try {
    const s = await admin();
    const name = txt(form, "name");
    const email = normEmail(form.get("email"));
    const role = String(form.get("role"));
    const pw = String(form.get("password") ?? "");
    if (!name) throw new Error("Nhập tên người cần thêm.");
    if (!EMAIL.test(email)) throw new Error("Email không hợp lệ.");
    if (!ROLES.includes(role)) throw new Error("Quyền không hợp lệ");
    const [existing] = await sql()`select id from accounts where email = ${email}`;
    let accountId: string = existing?.id;
    let created = false;
    if (!accountId) {
      const err = passwordProblem(pw);
      if (err) throw new Error(`Email này chưa có tài khoản, cần đặt mật khẩu ban đầu. ${err}`);
      const [a] = await sql()`
        insert into accounts (name, email, password_hash) values (${name}, ${email}, ${await hashPassword(pw)}) returning id`;
      accountId = a.id;
      created = true;
    }
    const rows = await sql()`
      insert into caregivers (family_id, display_name, account_id, email, role)
      values (${s.familyId}, ${name}, ${accountId}, ${email}, ${role})
      on conflict (family_id, account_id) do nothing returning id`;
    if (!rows.length) throw new Error("Người này đã ở trong gia đình.");
    revalidatePath("/gia-dinh");
    return {
      ok: true,
      message: created
        ? `Đã thêm ${name}. Gửi cho ${name}: đăng nhập bằng ${email} với mật khẩu bạn vừa đặt.`
        : `Đã thêm ${name} (dùng tài khoản ${email} có sẵn).`,
    };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
