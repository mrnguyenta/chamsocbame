import ElderCard from "@/components/ElderCard";
import { requireSession } from "@/lib/auth";
import { getOverview } from "@/lib/data";
import { AddElderForm } from "../gia-dinh/forms";

export const dynamic = "force-dynamic";

/** "Người thân": mỗi người một thẻ lớn; bấm vào là mở trang riêng của người đó. */
export default async function PeoplePage() {
  const session = await requireSession();
  const o = await getOverview(session.familyId);
  return (
    <main className="container">
      <div>
        <h1 style={{ fontSize: 26 }}>Người thân</h1>
        <div className="muted" style={{ fontSize: 14 }}>
          Bấm vào từng người để xem sức khoẻ, cảnh báo, ngưỡng, lịch thuốc, đồng hồ và thông tin
        </div>
      </div>
      <div className="grid-cards">
        {o.elders.map((e) => (
          <ElderCard key={e.id} e={e} openAlerts={o.openAlerts.filter((a) => a.elderId === e.id).length} />
        ))}
      </div>
      {o.elders.length === 0 && <div className="card">Chưa có người thân nào.</div>}
      {session.isAdmin && <section id="them" className="card"><AddElderForm /></section>}
    </main>
  );
}
