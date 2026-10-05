import Link from "next/link";
import ElderCard from "@/components/ElderCard";
import { requireSession } from "@/lib/auth";
import { getOverview } from "@/lib/data";
import { getT } from "@/lib/i18n-server";
import { AddElderForm } from "../gia-dinh/forms";

export const dynamic = "force-dynamic";

/** "Người thân": mỗi người một thẻ lớn; bấm vào là mở trang riêng của người đó. */
export default async function PeoplePage() {
  const session = await requireSession();
  const o = await getOverview(session.familyId);
  const t = await getT();
  return (
    <main className="container">
      <div>
        <h1 style={{ fontSize: 26 }}>{t("Người thân", "Family members")}</h1>
        <div className="muted" style={{ fontSize: 14 }}>
          {t("Bấm vào từng người để xem sức khoẻ, cảnh báo, ngưỡng, lịch thuốc, đồng hồ và thông tin",
            "Tap a person to see their health, alerts, thresholds, medication schedule, watch and info")}
        </div>
      </div>
      <div className="grid-cards">
        {o.elders.map((e) => (
          <ElderCard key={e.id} e={e} openAlerts={o.openAlerts.filter((a) => a.elderId === e.id).length} />
        ))}
      </div>
      {o.elders.length > 0 && session.isAdmin && (
        <div className="muted" style={{ fontSize: 14 }}>
          {t("Muốn sửa hoặc xoá người thân: ", "To edit or delete someone: ")}
          <Link href="/gia-dinh">{t("vào trang Gia đình", "go to the Family page")}</Link>
          {t(", hoặc mở trang của người đó, mục Thông tin.", ", or open their page, Info section.")}
        </div>
      )}
      {o.elders.length === 0 && <div className="card">{t("Chưa có người thân nào.", "No family members yet.")}</div>
}
      {session.isAdmin && <section id="them" className="card"><AddElderForm /></section>}
    </main>
  );
}
