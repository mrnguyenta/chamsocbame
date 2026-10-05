"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { isDemo, sql } from "@/lib/db";
import { CONDITIONS, METRICS, SEVERITY } from "@/lib/metrics";

export interface ActionState { ok: boolean; message: string; key?: string }

const DEMO: ActionState = { ok: false, message: "Chế độ demo: thay đổi không được lưu." };
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

async function admin() {
  const s = await requireSession();
  if (!s.isAdmin) throw new Error("Chỉ quản trị mới được sửa cài đặt");
  return s;
}

async function assertElder(familyId: string, elderId: string) {
  const [e] = await sql()`select id from elders where id = ${elderId} and family_id = ${familyId}`;
  if (!e) throw new Error("Không tìm thấy người thân");
}

async function assertRule(familyId: string, ruleId: string) {
  const [r] = await sql()`
    select r.id from alert_rules r join elders e on e.id = r.elder_id
    where r.id = ${ruleId} and e.family_id = ${familyId}`;
  if (!r) throw new Error("Không tìm thấy ngưỡng");
}

function parseRule(form: FormData) {
  const threshold = Number(String(form.get("threshold")).replace(",", "."));
  const severity = String(form.get("severity"));
  const activeAfter = String(form.get("active_after") ?? "").trim();
  if (!Number.isFinite(threshold)) throw new Error("Ngưỡng phải là số");
  if (!(severity in SEVERITY)) throw new Error("Mức độ không hợp lệ");
  if (activeAfter && !TIME.test(activeAfter)) throw new Error("Giờ kiểm tra dạng HH:MM");
  return { threshold, severity, activeAfter: activeAfter || null, enabled: form.get("enabled") === "on" };
}

export async function saveRule(_: ActionState, form: FormData): Promise<ActionState> {
  if (isDemo) return DEMO;
  try {
    const s = await admin();
    const id = String(form.get("rule_id"));
    await assertRule(s.familyId, id);
    const r = parseRule(form);
    await sql()`update alert_rules set threshold = ${r.threshold}, severity = ${r.severity},
                active_after = ${r.activeAfter}, enabled = ${r.enabled} where id = ${id}`;
    revalidatePath("/cai-dat");
    return { ok: true, message: "Đã lưu" };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function addRule(_: ActionState, form: FormData): Promise<ActionState> {
  if (isDemo) return DEMO;
  try {
    const s = await admin();
    const elderId = String(form.get("elder_id"));
    await assertElder(s.familyId, elderId);
    const metric = String(form.get("metric"));
    const comparator = String(form.get("comparator"));
    if (!(metric in METRICS) || !["gt", "lt"].includes(comparator)) throw new Error("Điều kiện không hợp lệ");
    const r = parseRule(form);
    await sql()`insert into alert_rules (elder_id, metric, comparator, threshold, severity, active_after, enabled)
                values (${elderId}, ${metric}, ${comparator}, ${r.threshold}, ${r.severity}, ${r.activeAfter}, true)`;
    revalidatePath("/cai-dat");
    return { ok: true, message: "Đã thêm ngưỡng" };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function deleteRule(form: FormData): Promise<void> {
  if (isDemo) return;
  const s = await admin();
  const id = String(form.get("rule_id"));
  await assertRule(s.familyId, id);
  await sql()`delete from alert_rules where id = ${id}`;
  revalidatePath("/cai-dat");
}

export async function saveConditions(_: ActionState, form: FormData): Promise<ActionState> {
  if (isDemo) return DEMO;
  try {
    const s = await admin();
    const elderId = String(form.get("elder_id"));
    await assertElder(s.familyId, elderId);
    const picked = Object.keys(CONDITIONS).filter((c) => form.get(`c_${c}`) === "on");
    await sql()`update elders set conditions = ${picked} where id = ${elderId}`;
    revalidatePath("/cai-dat");
    return { ok: true, message: "Đã lưu bệnh nền" };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function saveFamily(_: ActionState, form: FormData): Promise<ActionState> {
  if (isDemo) return DEMO;
  try {
    const s = await admin();
    const v = (k: string) => String(form.get(k) ?? "").trim();
    const [qs, qe, mr, er] = [v("quiet_start"), v("quiet_end"), v("morning_report_at"), v("evening_report_at")];
    if (![qs, qe, mr].every((t) => TIME.test(t)) || (er && !TIME.test(er))) throw new Error("Giờ dạng HH:MM");
    await sql()`update families set quiet_start = ${qs}, quiet_end = ${qe}, morning_report_at = ${mr},
                evening_report_at = ${er || null} where id = ${s.familyId}`;
    revalidatePath("/cai-dat");
    return { ok: true, message: "Đã lưu" };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function addMed(_: ActionState, form: FormData): Promise<ActionState> {
  if (isDemo) return DEMO;
  try {
    const s = await admin();
    const elderId = String(form.get("elder_id"));
    await assertElder(s.familyId, elderId);
    const name = String(form.get("name") ?? "").trim();
    const times = String(form.get("times") ?? "").split(/[,\s]+/).filter(Boolean);
    if (!name) throw new Error("Nhập tên thuốc");
    if (!times.length || !times.every((t) => TIME.test(t))) throw new Error("Giờ uống dạng 07:00, 19:00");
    await sql()`insert into med_schedules (elder_id, name, note, times)
                values (${elderId}, ${name}, ${String(form.get("note") ?? "").trim() || null}, ${times}::time[])`;
    revalidatePath("/cai-dat");
    return { ok: true, message: "Đã thêm thuốc" };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function deleteMed(form: FormData): Promise<void> {
  if (isDemo) return;
  const s = await admin();
  const id = String(form.get("med_id"));
  await sql()`update med_schedules m set active = false from elders e
              where m.id = ${id} and e.id = m.elder_id and e.family_id = ${s.familyId}`;
  revalidatePath("/cai-dat");
}

/** Tạo mã cho ứng dụng đồng hồ. Mã chỉ hiện một lần, chỉ lưu bản băm. */
export async function createWatchKey(_: ActionState, form: FormData): Promise<ActionState> {
  if (isDemo) return DEMO;
  try {
    const s = await admin();
    const elderId = String(form.get("elder_id"));
    await assertElder(s.familyId, elderId);
    const key = randomBytes(24).toString("base64url");
    const hash = createHash("sha256").update(key).digest("hex");
    const label = String(form.get("label") ?? "").trim() || null;
    await sql()`insert into watch_devices (elder_id, key_hash, label) values (${elderId}, ${hash}, ${label})`;
    revalidatePath("/cai-dat");
    return { ok: true, message: "Đã tạo mã. Chép ngay, mã chỉ hiện một lần.", key };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function deleteDevice(form: FormData): Promise<void> {
  if (isDemo) return;
  const s = await admin();
  await sql()`delete from watch_devices w using elders e
              where w.id = ${String(form.get("device_id"))} and e.id = w.elder_id and e.family_id = ${s.familyId}`;
  revalidatePath("/cai-dat");
}
