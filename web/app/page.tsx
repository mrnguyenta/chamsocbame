import Link from "next/link";
import AutoRefresh from "@/components/AutoRefresh";
import ElderCard from "@/components/ElderCard";
import { IconAlert, IconBell, IconPlus, IconUsers, IconWatch } from "@/components/icons";
import { SeverityChip } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { getOverview } from "@/lib/data";
import { isDemo } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

function greeting(): string {
  const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Ho_Chi_Minh" }));
  if (h < 11) return "Chào buổi sáng";
  if (h < 14) return "Chào buổi trưa";
  if (h < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

export default async function OverviewPage() {
  const session = await requireSession();
  const o = await getOverview(session.familyId);
  const urgent = o.openAlerts.filter((a) => a.severity === "high" || a.severity === "urgent");
  const firstName = isDemo ? "" : `, ${session.name.split(" ").pop()}`;

  const actions = [
    { href: "/ket-noi-dong-ho", label: "Kết nối đồng hồ", tile: "tile-teal", icon: <IconWatch size={22} /> },
    { href: "/nguoi-than#them", label: "Thêm người thân", tile: "tile-violet", icon: <IconPlus size={22} /> },
    { href: "/canh-bao", label: "Cảnh báo", tile: "tile-coral", icon: <IconAlert size={22} /> },
    { href: "/gia-dinh", label: "Anh chị em", tile: "tile-blue", icon: <IconUsers size={22} /> },
  ];
  const openBy = (id: string) => o.openAlerts.filter((a) => a.elderId === id).length;

  return (
    <main className="container">
      <AutoRefresh seconds={60} />
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <div>
          <h1 style={{ fontSize: 26 }}>{greeting()}{firstName}</h1>
          <div className="muted" style={{ fontSize: 14 }}>{o.familyName} · {o.elders.length} người thân đang được theo dõi</div>
        </div>
        <Link href="/canh-bao" aria-label={`Cảnh báo (${o.openAlerts.length} đang mở)`} className="icon-tile lg"
          style={{ background: "var(--surface-solid)", boxShadow: "var(--shadow-sm)", color: "var(--text)", position: "relative" }}>
          <IconBell size={22} />
          {o.openAlerts.length > 0 && (
            <span style={{ position: "absolute", top: 10, right: 12, width: 10, height: 10, borderRadius: "50%",
              background: "var(--coral)", border: "2px solid var(--surface-solid)" }} />
          )}
        </Link>
      </div>

      {urgent.map((a) => (
        <section key={a.id} className="banner danger" aria-label="Cảnh báo đang mở">
          <span className="icon-tile" style={{ background: "var(--coral)", color: "#fff" }}><IconAlert size={20} /></span>
          <div style={{ flex: "1 1 300px", minWidth: 0 }}>
            <strong>{a.elderName} · {a.message}</strong>
            <div style={{ fontSize: 13 }}>
              {fmtDateTime(a.openedAt)} · {a.ackedBy ? `${a.ackedBy} đang xử lý` : "Chưa ai nhận xử lý trên Telegram"}
            </div>
          </div>
          <Link className="btn small" href={`/nguoi-than/${a.elderId}`}>Xem</Link>
        </section>
      ))}

      <div className="split">
        <section className="main-col" aria-label="Người thân">
          <div className="grid-cards">
            {o.elders.map((e) => <ElderCard key={e.id} e={e} openAlerts={openBy(e.id)} />)}
          </div>
          {o.elders.length === 0 && (
            <div className="card">Chưa có người thân nào. <Link href="/nguoi-than#them">Thêm ba mẹ</Link> hoặc <Link href="/ket-noi-dong-ho">kết nối đồng hồ</Link>.</div>
          )}
        </section>

        <aside className="side-col">
          <section className="card">
            <h2>Thao tác nhanh</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
              {actions.map((a) => (
                <Link key={a.href} href={a.href} style={{ display: "flex", flexDirection: "column", alignItems: "center",
                  gap: 6, textDecoration: "none", color: "var(--text-2)", fontSize: 12, fontWeight: 600, textAlign: "center" }}>
                  <span className={`icon-tile lg ${a.tile}`}>{a.icon}</span>{a.label}
                </Link>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="card-head"><h2>Cảnh báo gần đây</h2><Link className="link-sm" href="/canh-bao">Xem tất cả</Link></div>
            {o.recentAlerts.length === 0 && <div className="muted">Không có cảnh báo trong 7 ngày.</div>}
            <ul className="list">
              {o.recentAlerts.slice(0, 4).map((a) => (
                <li key={a.id}>
                  <Link className="list-row" href={`/nguoi-than/${a.elderId}`}>
                    <span className={`icon-tile ${a.resolvedAt ? "tile-teal" : "tile-coral"}`}><IconHeartSmall /></span>
                    <span className="grow">
                      <span className="title" style={{ display: "block" }}>{a.elderName}</span>
                      <span className="muted" style={{ display: "block" }}>{a.message}</span>
                    </span>
                    <SeverityChip severity={a.severity} />
                  </Link>
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

function IconHeartSmall() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}
