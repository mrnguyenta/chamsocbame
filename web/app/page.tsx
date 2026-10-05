import Link from "next/link";
import AutoRefresh from "@/components/AutoRefresh";
import HrChart from "@/components/HrChart";
import {
  HeartArt, IconAlert, IconBell, IconBolt, IconChart, IconChevron, IconMoon, IconPill, IconSteps, IconWatch,
} from "@/components/icons";
import { Avatar, SeverityChip, StatusChip } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { getOverview } from "@/lib/data";
import { isDemo } from "@/lib/db";
import { age, fmtAgo, fmtDateTime, fmtDuration, fmtNum } from "@/lib/format";
import type { ElderSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

const ROLE = { admin: "Quản trị", alerts: "Nhận cảnh báo", reports: "Chỉ nhận báo cáo" } as const;

function greeting(): string {
  const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Ho_Chi_Minh" }));
  if (h < 11) return "Chào buổi sáng";
  if (h < 14) return "Chào buổi trưa";
  if (h < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

function MiniStat({ icon, tile, label, value, unit }: {
  icon: React.ReactNode; tile: string; label: string; value: string | number; unit?: string;
}) {
  return (
    <div className="kpi">
      <div className="label"><span className={`icon-tile sm ${tile}`}>{icon}</span>{label}</div>
      <div className="value">{value}{unit && value !== "—" && <span className="unit"> {unit}</span>}</div>
    </div>
  );
}

function ElderCard({ e }: { e: ElderSummary }) {
  const hr = e.hrNow ?? e.today.restingHr;
  const high = e.status === "attention";
  return (
    <article className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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

      <div style={{ background: "var(--surface-solid)", borderRadius: 20, padding: 16, boxShadow: "var(--shadow-sm)",
        display: "flex", gap: 14, alignItems: "center" }}>
        <HeartArt size={58} />
        <div style={{ flex: "0 0 auto" }}>
          <div className="muted">{e.hrNow != null ? "Nhịp tim lúc này" : "Nhịp tim nghỉ"}</div>
          <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1, color: high ? "var(--coral-ink)" : undefined }}>
            {hr ?? "—"}{hr != null && <span className="unit" style={{ fontSize: 13, fontWeight: 500, color: "var(--muted)" }}> bpm</span>}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <HrChart data={e.hr24h} height={44} compact label={`Nhịp tim 24 giờ của ${e.name}`} />
        </div>
      </div>

      <div className="kpis tight">
        <MiniStat icon={<IconSteps size={16} />} tile="tile-teal" label="Bước chân" value={fmtNum(e.today.steps)} />
        <MiniStat icon={<IconMoon size={16} />} tile="tile-violet" label="Giấc ngủ" value={fmtDuration(e.today.sleepSeconds)} />
        <MiniStat icon={<IconBolt size={16} />} tile="tile-amber" label="Năng lượng" value={e.today.bodyBattery ?? "—"} unit="/100" />
      </div>

      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="muted" style={e.status === "offline" ? { color: "var(--warn-fg)", fontWeight: 600 } : undefined}>
          {e.liveSource ? "Đồng hồ gửi trực tiếp" : "Garmin Connect"} · {fmtAgo(e.lastDataAt)}
        </span>
        <Link className="btn primary small" href={`/nguoi-than/${e.id}`}>
          Xem chi tiết <span className="arrow"><IconChevron size={16} /></span>
        </Link>
      </div>
    </article>
  );
}

export default async function OverviewPage() {
  const session = await requireSession();
  const o = await getOverview(session.familyId);
  const urgent = o.openAlerts.filter((a) => a.severity === "high" || a.severity === "urgent");
  const firstName = isDemo ? "" : `, ${session.name.split(" ").pop()}`;

  const actions = [
    { href: "/ket-noi-dong-ho", label: "Kết nối đồng hồ", tile: "tile-teal", icon: <IconWatch size={22} /> },
    { href: "/cai-dat#thuoc", label: "Lịch thuốc", tile: "tile-violet", icon: <IconPill size={22} /> },
    { href: "/canh-bao", label: "Cảnh báo", tile: "tile-coral", icon: <IconAlert size={22} /> },
    { href: "/cai-dat", label: "Ngưỡng", tile: "tile-blue", icon: <IconChart size={22} /> },
  ];

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
            {o.elders.map((e) => <ElderCard key={e.id} e={e} />)}
          </div>
          {o.elders.length === 0 && <div className="card">Chưa có người thân nào.</div>}
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

          <section className="card">
            <h2>Người cùng chăm sóc</h2>
            <ul className="list">
              {o.carers.map((c) => (
                <li key={c.id} className="list-row" style={{ minHeight: 0 }}>
                  <Avatar name={c.name} small />
                  <span className="grow">
                    <span className="title" style={{ display: "block" }}>{c.name}</span>
                    <span className="muted">{ROLE[c.role]}{c.phone ? " · có số gọi khẩn" : ""}</span>
                  </span>
                  <span className={`chip ${c.hasTelegram ? "tone-ok" : "tone-neutral"}`}>{c.hasTelegram ? "Telegram" : "Chưa nối"}</span>
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
