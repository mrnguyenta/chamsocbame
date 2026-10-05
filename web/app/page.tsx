import Link from "next/link";
import AutoRefresh from "@/components/AutoRefresh";
import ElderCard from "@/components/ElderCard";
import { IconAlert, IconBell, IconChart, IconPlus, IconSparkle, IconUsers, IconWatch } from "@/components/icons";
import { SeverityChip } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { getOverview } from "@/lib/data";
import { isDemo } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import type { T } from "@/lib/i18n";
import { getLang, getT } from "@/lib/i18n-server";
import { alertText } from "@/lib/metrics";

export const dynamic = "force-dynamic";

function greeting(t: T): string {
  const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Ho_Chi_Minh" }));
  if (h < 11) return t("Chào buổi sáng", "Good morning");
  if (h < 14) return t("Chào buổi trưa", "Good afternoon");
  if (h < 18) return t("Chào buổi chiều", "Good afternoon");
  return t("Chào buổi tối", "Good evening");
}

export default async function OverviewPage() {
  const session = await requireSession();
  const lang = await getLang();
  const t = await getT();
  const o = await getOverview(session.familyId);
  const urgent = o.openAlerts.filter((a) => a.severity === "high" || a.severity === "urgent");
  const firstName = isDemo ? "" : `, ${session.name.split(" ").pop()}`;

  const actions = [
    { href: "/ket-noi-dong-ho", label: t("Kết nối đồng hồ", "Connect watch"), tile: "tile-teal", icon: <IconWatch size={22} /> },
    { href: "/nguoi-than#them", label: t("Thêm người thân", "Add a parent"), tile: "tile-violet", icon: <IconPlus size={22} /> },
    { href: "/canh-bao", label: t("Cảnh báo", "Alerts"), tile: "tile-coral", icon: <IconAlert size={22} /> },
    { href: "/gia-dinh", label: t("Anh chị em", "Siblings"), tile: "tile-blue", icon: <IconUsers size={22} /> },
    { href: "/hoi-ai", label: t("Hỏi AI", "Ask AI"), tile: "tile-amber", icon: <IconSparkle size={22} /> },
    { href: "/bao-cao", label: t("Báo cáo tuần", "Weekly report"), tile: "tile-teal", icon: <IconChart size={22} /> },
  ];
  const openBy = (id: string) => o.openAlerts.filter((a) => a.elderId === id).length;

  return (
    <main className="container">
      <AutoRefresh seconds={60} />
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <div>
          <h1 style={{ fontSize: 26 }}>{greeting(t)}{firstName}</h1>
          <div className="muted" style={{ fontSize: 14 }}>{o.familyName} · {t(`${o.elders.length} người thân đang được theo dõi`, `${o.elders.length} ${o.elders.length === 1 ? "person" : "people"} monitored`)}</div>
        </div>
        <Link href="/canh-bao" aria-label={t(`Cảnh báo (${o.openAlerts.length} đang mở)`, `Alerts (${o.openAlerts.length} open)`)} className="icon-tile lg"
          style={{ background: "var(--surface-solid)", boxShadow: "var(--shadow-sm)", color: "var(--text)", position: "relative" }}>
          <IconBell size={22} />
          {o.openAlerts.length > 0 && (
            <span style={{ position: "absolute", top: 10, right: 12, width: 10, height: 10, borderRadius: "50%",
              background: "var(--coral)", border: "2px solid var(--surface-solid)" }} />
          )}
        </Link>
      </div>

      {urgent.map((a) => (
        <section key={a.id} className="banner danger" aria-label={t("Cảnh báo đang mở", "Open alert")}>
          <span className="icon-tile" style={{ background: "var(--coral)", color: "#fff" }}><IconAlert size={20} /></span>
          <div style={{ flex: "1 1 300px", minWidth: 0 }}>
            <strong>{a.elderName} · {alertText(a, lang)}</strong>
            <div style={{ fontSize: 13 }}>
              {fmtDateTime(a.openedAt, lang)} · {a.ackedBy ? t(`${a.ackedBy} đang xử lý`, `${a.ackedBy} is handling it`)
                : t("Chưa ai nhận xử lý trên Telegram", "Nobody has taken it on Telegram yet")}
            </div>
          </div>
          <Link className="btn small" href={`/nguoi-than/${a.elderId}`}>{t("Xem", "View")}</Link>
        </section>
      ))}

      <div className="split">
        <section className="main-col" aria-label={t("Người thân", "Parents")}>
          <div className="grid-cards">
            {o.elders.map((e) => <ElderCard key={e.id} e={e} openAlerts={openBy(e.id)} />)}
          </div>
          {o.elders.length === 0 && (
            <div className="card">{t("Chưa có người thân nào.", "No parents added yet.")} <Link href="/nguoi-than#them">{t("Thêm ba mẹ", "Add a parent")}</Link> {t("hoặc", "or")} <Link href="/ket-noi-dong-ho">{t("kết nối đồng hồ", "connect a watch")}</Link>.</div>
          )}
        </section>

        <aside className="side-col">
          <section className="card">
            <h2>{t("Thao tác nhanh", "Quick actions")}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "14px 10px" }}>
              {actions.map((a) => (
                <Link key={a.href} href={a.href} style={{ display: "flex", flexDirection: "column", alignItems: "center",
                  gap: 6, textDecoration: "none", color: "var(--text-2)", fontSize: 12, fontWeight: 600, textAlign: "center" }}>
                  <span className={`icon-tile lg ${a.tile}`}>{a.icon}</span>{a.label}
                </Link>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="card-head"><h2>{t("Cảnh báo gần đây", "Recent alerts")}</h2><Link className="link-sm" href="/canh-bao">{t("Xem tất cả", "View all")}</Link></div>
            {o.recentAlerts.length === 0 && <div className="muted">{t("Không có cảnh báo trong 7 ngày.", "No alerts in the last 7 days.")}</div>}
            <ul className="list">
              {o.recentAlerts.slice(0, 4).map((a) => (
                <li key={a.id}>
                  <Link className="list-row" href={`/nguoi-than/${a.elderId}`}>
                    <span className={`icon-tile ${a.resolvedAt ? "tile-teal" : "tile-coral"}`}><IconHeartSmall /></span>
                    <span className="grow">
                      <span className="title" style={{ display: "block" }}>{a.elderName}</span>
                      <span className="muted" style={{ display: "block" }}>{alertText(a, lang)}</span>
                    </span>
                    <SeverityChip severity={a.severity} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

        </aside>
      </div>
      <p className="muted">{t("Thông tin chỉ để tham khảo, không thay thế chẩn đoán của bác sĩ.", "For reference only; not a substitute for a doctor's diagnosis.")}</p>
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
