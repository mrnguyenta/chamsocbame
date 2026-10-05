"use server";

import { revalidatePath } from "next/cache";
import { getIdentity, getSession, selectFamily } from "@/lib/auth";
import { isDemo, sql } from "@/lib/db";
import { getT } from "@/lib/i18n-server";
import { CONDITION_KEYS } from "@/lib/metrics";

export interface ClaimState { ok: boolean; message: string }

const txt = (f: FormData, k: string, max = 80) => String(f.get(k) ?? "").trim().slice(0, max);

/**
 * Kết nối đồng hồ trong một bước: nhận mã 6 số, và nếu cần thì tự tạo luôn
 * gia đình (người mới đăng nhập lần đầu) và người thân (chọn "Người khác").
 */
export async function connectWatch(_: ClaimState, form: FormData): Promise<ClaimState> {
  const t = await getT();
  if (isDemo) return { ok: true, message: t("Chế độ demo: giả lập đã kết nối đồng hồ.", "Demo mode: simulated a connected watch.") };
  try {
    const id = await getIdentity();
    if (!id) throw new Error(t("Hãy đăng nhập lại.", "Please sign in again."));
    const session = await getSession();
    if (session && !session.isAdmin) throw new Error(t("Chỉ người quản trị gia đình mới kết nối được đồng hồ.", "Only the family admin can connect a watch."));

    const code = String(form.get("code") ?? "").replace(/\D/g, "");
    if (code.length !== 6) throw new Error(t("Mã gồm 6 chữ số, xem trên màn hình đồng hồ", "The code has 6 digits; see the watch screen"));
    const choice = String(form.get("elder_id") ?? "new");
    const newName = txt(form, "name");
    if (choice === "new" && !newName) throw new Error(t("Nhập cách gọi người đeo đồng hồ, ví dụ “Ba Hùng”", "Enter what you call the wearer, e.g. “Dad”"));
    const conditions = CONDITION_KEYS.filter((c) => form.get(`c_${c}`) === "on");
    const label = txt(form, "label") || t("Đồng hồ Garmin", "Garmin watch");

    const res = await sql().begin(async (tx) => {
      const [p] = await tx`
        select id, key_hash from watch_pairings
        where code = ${code} and claimed_at is null and expires_at > now() for update`;
      if (!p) throw new Error(t("Mã không đúng hoặc đã hết hạn. Mở lại ứng dụng trên đồng hồ để lấy mã mới.",
        "The code is wrong or has expired. Reopen the app on the watch to get a new code."));

      let familyId = session?.familyId ?? null;
      if (!familyId) {
        const [f] = await tx`insert into families (name) values (${t(`Gia đình ${id.name}`, `${id.name}'s family`)}) returning id`;
        await tx`insert into caregivers (family_id, display_name, account_id, email, role, escalation_order)
                 values (${f.id}, ${id.name}, ${id.accountId}, ${id.email}, 'admin', 1)`;
        familyId = f.id as string;
      }

      let elderId: string;
      let name: string;
      if (choice === "new") {
        const [e] = await tx`
          insert into elders (family_id, display_name, conditions) values (${familyId}, ${newName}, ${conditions})
          returning id, display_name`;
        await tx`select chamsoc_ensure_default_rules(${e.id}, ${conditions})`;
        elderId = e.id;
        name = e.display_name;
      } else {
        const [e] = await tx`select id, display_name from elders where id = ${choice} and family_id = ${familyId}`;
        if (!e) throw new Error(t("Không tìm thấy người thân", "Person not found"));
        elderId = e.id;
        name = e.display_name;
      }

      const [d] = await tx`
        insert into watch_devices (elder_id, key_hash, label) values (${elderId}, ${p.key_hash}, ${label}) returning id`;
      await tx`update watch_pairings set claimed_at = now(), device_id = ${d.id} where id = ${p.id}`;
      return { name, familyId, newFamily: !session };
    });

    if (res.newFamily) await selectFamily(res.familyId);
    revalidatePath("/", "layout");
    return { ok: true, message: t(`Đã kết nối đồng hồ với ${res.name}. Đồng hồ sẽ báo “Đã kết nối” trong ít giây.`,
      `Watch connected to ${res.name}. The watch will show “Connected” in a few seconds.`) };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
