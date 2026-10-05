"use server";

import { revalidatePath } from "next/cache";
import { getIdentity, getSession, selectFamily } from "@/lib/auth";
import { isDemo, sql } from "@/lib/db";
import { CONDITIONS } from "@/lib/metrics";

export interface ClaimState { ok: boolean; message: string }

const txt = (f: FormData, k: string, max = 80) => String(f.get(k) ?? "").trim().slice(0, max);

/**
 * Kết nối đồng hồ trong một bước: nhận mã 6 số, và nếu cần thì tự tạo luôn
 * gia đình (người mới đăng nhập lần đầu) và người thân (chọn "Người khác").
 */
export async function connectWatch(_: ClaimState, form: FormData): Promise<ClaimState> {
  if (isDemo) return { ok: true, message: "Chế độ demo: giả lập đã kết nối đồng hồ." };
  try {
    const id = await getIdentity();
    if (!id) throw new Error("Hãy đăng nhập lại.");
    const session = await getSession();
    if (session && !session.isAdmin) throw new Error("Chỉ người quản trị gia đình mới kết nối được đồng hồ.");

    const code = String(form.get("code") ?? "").replace(/\D/g, "");
    if (code.length !== 6) throw new Error("Mã gồm 6 chữ số, xem trên màn hình đồng hồ");
    const choice = String(form.get("elder_id") ?? "new");
    const newName = txt(form, "name");
    if (choice === "new" && !newName) throw new Error("Nhập cách gọi người đeo đồng hồ, ví dụ “Ba Hùng”");
    const conditions = Object.keys(CONDITIONS).filter((c) => form.get(`c_${c}`) === "on");
    const label = txt(form, "label") || "Đồng hồ Garmin";

    const res = await sql().begin(async (tx) => {
      const [p] = await tx`
        select id, key_hash from watch_pairings
        where code = ${code} and claimed_at is null and expires_at > now() for update`;
      if (!p) throw new Error("Mã không đúng hoặc đã hết hạn. Mở lại ứng dụng trên đồng hồ để lấy mã mới.");

      let familyId = session?.familyId ?? null;
      if (!familyId) {
        const [f] = await tx`insert into families (name) values (${`Gia đình ${id.name}`}) returning id`;
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
        if (!e) throw new Error("Không tìm thấy người thân");
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
    return { ok: true, message: `Đã kết nối đồng hồ với ${res.name}. Đồng hồ sẽ báo “Đã kết nối” trong ít giây.` };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
