"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { isDemo, sql } from "@/lib/db";
import type { T } from "@/lib/i18n";
import { getT } from "@/lib/i18n-server";
import { CONDITION_KEYS, METRIC_KEYS, SEVERITY_KEYS } from "@/lib/metrics";

export interface ActionState { ok: boolean; message: string; key?: string }

const demo = (t: T): ActionState => ({ ok: false, message: t("Chế độ demo: thay đổi không được lưu.", "Demo mode: changes are not saved.") });
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

async function admin(t: T) {
  const s = await requireSession();
  if (!s.isAdmin) throw new Error(t("Chỉ quản trị mới được sửa cài đặt", "Only admins can change settings"));
  return s;
}

async function assertElder(t: T, familyId: string, elderId: string) {
  const [e] = await sql()`select id from elders where id = ${elderId} and family_id = ${familyId}`;
  if (!e) throw new Error(t("Không tìm thấy người thân", "Family member not found"));
}

async function assertRule(t: T, familyId: string, ruleId: string) {
  const [r] = await sql()`
    select r.id from alert_rules r join elders e on e.id = r.elder_id
    where r.id = ${ruleId} and e.family_id = ${familyId}`;
  if (!r) throw new Error(t("Không tìm thấy ngưỡng", "Threshold not found"));
}

function parseRule(t: T, form: FormData) {
  const threshold = Number(String(form.get("threshold")).replace(",", "."));
  const severity = String(form.get("severity"));
  const activeAfter = String(form.get("active_after") ?? "").trim();
  if (!Number.isFinite(threshold)) throw new Error(t("Ngưỡng phải là số", "Threshold must be a number"));
  if (!SEVERITY_KEYS.includes(severity)) throw new Error(t("Mức độ không hợp lệ", "Invalid severity"));
  if (activeAfter && !TIME.test(activeAfter)) throw new Error(t("Giờ kiểm tra dạng HH:MM", "Check time must be HH:MM"));
  return { threshold, severity, activeAfter: activeAfter || null, enabled: form.get("enabled") === "on" };
}

export async function saveRule(_: ActionState, form: FormData): Promise<ActionState> {
  const t = await getT();
  if (isDemo) return demo(t);
  try {
    const s = await admin(t);
    const id = String(form.get("rule_id"));
    await assertRule(t, s.familyId, id);
    const r = parseRule(t, form);
    await sql()`update alert_rules set threshold = ${r.threshold}, severity = ${r.severity},
                active_after = ${r.activeAfter}, enabled = ${r.enabled} where id = ${id}`;
    revalidatePath("/", "layout");
    return { ok: true, message: t("Đã lưu", "Saved") };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function addRule(_: ActionState, form: FormData): Promise<ActionState> {
  const t = await getT();
  if (isDemo) return demo(t);
  try {
    const s = await admin(t);
    const elderId = String(form.get("elder_id"));
    await assertElder(t, s.familyId, elderId);
    const metric = String(form.get("metric"));
    const comparator = String(form.get("comparator"));
    if (!METRIC_KEYS.includes(metric) || !["gt", "lt"].includes(comparator)) throw new Error(t("Điều kiện không hợp lệ", "Invalid condition"));
    const r = parseRule(t, form);
    await sql()`insert into alert_rules (elder_id, metric, comparator, threshold, severity, active_after, enabled)
                values (${elderId}, ${metric}, ${comparator}, ${r.threshold}, ${r.severity}, ${r.activeAfter}, true)`;
    revalidatePath("/", "layout");
    return { ok: true, message: t("Đã thêm ngưỡng", "Threshold added") };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function deleteRule(form: FormData): Promise<void> {
  if (isDemo) return;
  const t = await getT();
  const s = await admin(t);
  const id = String(form.get("rule_id"));
  await assertRule(t, s.familyId, id);
  await sql()`delete from alert_rules where id = ${id}`;
  revalidatePath("/", "layout");
}

export async function saveConditions(_: ActionState, form: FormData): Promise<ActionState> {
  const t = await getT();
  if (isDemo) return demo(t);
  try {
    const s = await admin(t);
    const elderId = String(form.get("elder_id"));
    await assertElder(t, s.familyId, elderId);
    const picked = CONDITION_KEYS.filter((c) => form.get(`c_${c}`) === "on");
    await sql()`update elders set conditions = ${picked} where id = ${elderId}`;
    // Thêm ngưỡng huyết áp / đường huyết còn thiếu khi vừa chọn bệnh nền mới.
    await sql()`select chamsoc_ensure_default_rules(${elderId}, ${picked})`;
    revalidatePath("/", "layout");
    return { ok: true, message: t("Đã lưu bệnh nền", "Health conditions saved") };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function saveFamily(_: ActionState, form: FormData): Promise<ActionState> {
  const t = await getT();
  if (isDemo) return demo(t);
  try {
    const s = await admin(t);
    const v = (k: string) => String(form.get(k) ?? "").trim();
    const [qs, qe, mr, er] = [v("quiet_start"), v("quiet_end"), v("morning_report_at"), v("evening_report_at")];
    if (![qs, qe, mr].every((t) => TIME.test(t)) || (er && !TIME.test(er))) throw new Error(t("Giờ dạng HH:MM", "Times must be HH:MM"));
    await sql()`update families set quiet_start = ${qs}, quiet_end = ${qe}, morning_report_at = ${mr},
                evening_report_at = ${er || null} where id = ${s.familyId}`;
    revalidatePath("/", "layout");
    return { ok: true, message: t("Đã lưu", "Saved") };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function addMed(_: ActionState, form: FormData): Promise<ActionState> {
  const t = await getT();
  if (isDemo) return demo(t);
  try {
    const s = await admin(t);
    const elderId = String(form.get("elder_id"));
    await assertElder(t, s.familyId, elderId);
    const name = String(form.get("name") ?? "").trim();
    const times = String(form.get("times") ?? "").split(/[,\s]+/).filter(Boolean);
    if (!name) throw new Error(t("Nhập tên thuốc", "Enter the medication name"));
    if (!times.length || !times.every((t) => TIME.test(t))) throw new Error(t("Giờ uống dạng 07:00, 19:00", "Dose times like 07:00, 19:00"));
    await sql()`insert into med_schedules (elder_id, name, note, times)
                values (${elderId}, ${name}, ${String(form.get("note") ?? "").trim() || null}, ${times}::time[])`;
    revalidatePath("/", "layout");
    return { ok: true, message: t("Đã thêm thuốc", "Medication added") };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function deleteMed(form: FormData): Promise<void> {
  if (isDemo) return;
  const s = await admin(await getT());
  const id = String(form.get("med_id"));
  await sql()`update med_schedules m set active = false from elders e
              where m.id = ${id} and e.id = m.elder_id and e.family_id = ${s.familyId}`;
  revalidatePath("/", "layout");
}

/** Tạo mã cho ứng dụng đồng hồ. Mã chỉ hiện một lần, chỉ lưu bản băm. */
export async function createWatchKey(_: ActionState, form: FormData): Promise<ActionState> {
  const t = await getT();
  if (isDemo) return demo(t);
  try {
    const s = await admin(t);
    const elderId = String(form.get("elder_id"));
    await assertElder(t, s.familyId, elderId);
    const key = randomBytes(24).toString("base64url");
    const hash = createHash("sha256").update(key).digest("hex");
    const label = String(form.get("label") ?? "").trim() || null;
    await sql()`insert into watch_devices (elder_id, key_hash, label) values (${elderId}, ${hash}, ${label})`;
    revalidatePath("/", "layout");
    return { ok: true, message: t("Đã tạo mã. Chép ngay, mã chỉ hiện một lần.", "Key created. Copy it now; it is shown only once."), key };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function deleteDevice(form: FormData): Promise<void> {
  if (isDemo) return;
  const s = await admin(await getT());
  await sql()`delete from watch_devices w using elders e
              where w.id = ${String(form.get("device_id"))} and e.id = w.elder_id and e.family_id = ${s.familyId}`;
  revalidatePath("/", "layout");
}

/** Gỡ liên kết Garmin Connect của một người thân (xoá token đã lưu). */
export async function deleteGarmin(form: FormData): Promise<void> {
  if (isDemo) return;
  const s = await admin(await getT());
  await sql()`delete from garmin_accounts g using elders e
              where g.elder_id = ${String(form.get("elder_id"))} and e.id = g.elder_id and e.family_id = ${s.familyId}`;
  revalidatePath("/", "layout");
}

/** Ghép đồng hồ: con cháu nhập mã 6 số đang hiện trên đồng hồ. */
export async function claimWatch(_: ActionState, form: FormData): Promise<ActionState> {
  const t = await getT();
  if (isDemo) return { ok: true, message: t("Chế độ demo: giả lập đã kết nối đồng hồ.", "Demo mode: simulated watch connection.") };
  try {
    const s = await admin(t);
    const elderId = String(form.get("elder_id"));
    await assertElder(t, s.familyId, elderId);
    const code = String(form.get("code") ?? "").replace(/\D/g, "");
    if (code.length !== 6) throw new Error(t("Mã gồm 6 chữ số, xem trên màn hình đồng hồ", "The code has 6 digits; see the watch screen"));
    const label = String(form.get("label") ?? "").trim() || t("Đồng hồ Garmin", "Garmin watch");
    const name = await sql().begin(async (tx) => {
      const [p] = await tx`
        select id, key_hash from watch_pairings
        where code = ${code} and claimed_at is null and expires_at > now() for update`;
      if (!p) throw new Error(t("Mã không đúng hoặc đã hết hạn. Mở lại ứng dụng trên đồng hồ để lấy mã mới.",
        "Wrong or expired code. Reopen the app on the watch to get a new code."));
      const [d] = await tx`
        insert into watch_devices (elder_id, key_hash, label) values (${elderId}, ${p.key_hash}, ${label})
        returning id`;
      await tx`update watch_pairings set claimed_at = now(), device_id = ${d.id} where id = ${p.id}`;
      const [e] = await tx`select display_name from elders where id = ${elderId}`;
      return e.display_name as string;
    });
    revalidatePath("/", "layout");
    return { ok: true, message: t(`Đã kết nối đồng hồ với ${name}. Đồng hồ sẽ báo "Đã kết nối" trong ít giây.`,
      `Watch connected to ${name}. The watch will show "Connected" in a few seconds.`) };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
