import Link from "next/link";
import AutoRefresh from "@/components/AutoRefresh";
import HrChart from "@/components/HrChart";
import { Avatar, Kpi, SeverityChip, StatusChip } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { getOverview } from "@/lib/data";
import { age, fmtAgo, fmtDateTime, fmtDuration, fmtNum } from "@/lib/format";

export const dynamic = "force-dynamic";

const ROLE = { admin: "Quản trị", alerts: "Nhận cảnh báo", reports: "Chỉ nhận báo cáo" } as const;

export default async function OverviewPage() {
  const session = await requireSession();
  const o = await getOverview(session.familyId);
  const urgent = o.openAlerts.filter((a) => a.severity === "high" || a.severity === "urgent");

  return (
    <main className="container">
      <AutoRefresh seconds={60} />
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: 28 }}>{o.familyName}</h1>
          <div className="muted" style={{ fontSize: 15, marginTop: 4 }}>
            {o.elders.length} người thân đang được theo dõi · tự cập nhật mỗi phút
          </div>
        </div>
      </div>

      {urgent.map((a) => (
        <section key={a.id} className="banner danger" aria-label="Cảnh báo đang mở">
          <div style={{ flex: "1 1 360px", minWidth: 0 }}>
            <strong>{a.elderName} · {a.message}</strong>
            <div style={{ fontSize: 14 }}>
              Lúc {fmtDateTime(a.openedAt)} · {a.ackedBy ? `${a.ackedBy} đang xử lý` : "Chưa ai nhận xử lý trên Telegram"}
            </div>
          </div>
          <Link className="btn" href={`/nguoi-than/${a.elderId}`}>Xem chi tiết</Link>
        </section>
      ))}

      <div className="split">
        <section className="main-col" aria-label="Người thân">
          <div className="grid-cards">
            {o.elders.map((e) => (
              <article key={e.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="row" style={{ flexWrap: "nowrap" }}>
                  <Avatar name={e.name} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{e.name}</div>
                    <div className="muted">
                      {[age(e.birthYear), e.watchLabel ?? "chưa gắn đồng hồ",
                        e.watchBattery != null ? `pin ${e.watchBattery}%` : null].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <StatusChip status={e.status} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                  <Kpi label={e.hrNow != null ? "Nhịp tim lúc này" : "Nhịp tim nghỉ"}
                    value={e.hrNow ?? e.today.restingHr ?? "—"} unit="bpm"
                    tone={e.status === "attention" ? "danger" : undefined} />
                  <Kpi label="Giấc ngủ đêm qua" value={fmtDuration(e.today.sleepSeconds)} />
                  <Kpi label="Bước chân hôm nay" value={fmtNum(e.today.steps)} />
                  <Kpi label="Body Battery · SpO2"
                    value={`${e.today.bodyBattery ?? "—"} · ${e.today.spo2Min != null ? e.today.spo2Min + "%" : "—"}`} />
                </div>
                <div>
                  <div className="muted" style={{ marginBottom: 4 }}>Nhịp tim 24 giờ qua</div>
                  <HrChart data={e.hr24h} height={48} compact label={`Nhịp tim 24 giờ của ${e.name}`} />
                </div>
                <div className="row" style={{ justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                  <span className="muted" style={e.status === "offline" ? { color: "var(--warn-fg)", fontWeight: 600 } : undefined}>
                    {e.liveSource ? "Đồng hồ gửi trực tiếp" : "Garmin Connect"} · {fmtAgo(e.lastDataAt)}
                  </span>
                  <Link href={`/nguoi-than/${e.id}`} style={{ fontWeight: 600, minHeight: 44, display: "flex", alignItems: "center" }}>
                    Chi tiết
                  </Link>
                </div>
              </article>
            ))}
          </div>
          {o.elders.length === 0 && (
            <div className="card">Chưa có người thân nào. Thêm bằng <code>python -m chamsoc.setup_family</code>.</div>
          )}
        </section>

        <aside className="side-col">
          <section className="card">
            <h2>Cảnh báo 7 ngày qua</h2>
            {o.recentAlerts.length === 0 && <div className="muted">Không có cảnh báo nào.</div>}
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              {o.recentAlerts.map((a) => (
                <li key={a.id}>
                  <div className="row" style={{ gap: 8 }}>
                    <SeverityChip severity={a.severity} />
                    <strong style={{ fontSize: 14 }}>{a.elderName}</strong>
                  </div>
                  <div style={{ fontSize: 14 }}>{a.message}</div>
                  <div className="muted">
                    {fmtDateTime(a.openedAt)}
                    {a.ackedBy ? ` · ${a.ackedBy} nhận xử lý` : ""}
                    {a.resolvedAt ? " · đã bình thường" : ""}
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <section className="card">
            <h2>Người cùng chăm sóc</h2>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {o.carers.map((c) => (
                <li key={c.id} className="row" style={{ flexWrap: "nowrap" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                    <div className="muted">{ROLE[c.role]}{c.phone ? " · có số gọi khẩn" : ""}</div>
                  </div>
                  <span className={`chip ${c.hasTelegram ? "tone-ok" : "tone-neutral"}`}>
                    {c.hasTelegram ? "Telegram" : "Chưa nối Telegram"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
      <p className="muted">Thông tin chỉ để tham khảo, không thay thế chẩn đoán của bác sĩ.</p>
    </main>
  );
}
