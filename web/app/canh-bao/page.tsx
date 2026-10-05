import Link from "next/link";
import AutoRefresh from "@/components/AutoRefresh";
import { IconAlert, IconChevron, IconFile } from "@/components/icons";
import { SeverityChip } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { getAlerts } from "@/lib/data";
import { fmtDateTime, fmtTime } from "@/lib/format";
import { makeT, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { alertText } from "@/lib/metrics";
import type { AlertRow } from "@/lib/types";

export const dynamic = "force-dynamic";

function Row({ a, lang }: { a: AlertRow; lang: Lang }) {
  const t = makeT(lang);
  const open = !a.resolvedAt;
  return (
    <li>
      <Link className="list-row" href={`/nguoi-than/${a.elderId}`}>
        <span className={`icon-tile ${open ? "tile-coral" : "tile-teal"}`}>{open ? <IconAlert size={20} /> : <IconFile size={20} />}</span>
        <span className="grow">
          <span className="title" style={{ display: "block" }}>{a.elderName} · {alertText(a, lang)}</span>
          <span className="muted">
            {fmtDateTime(a.openedAt, lang)}
            {a.ackedBy ? t(` · ${a.ackedBy} nhận lúc ${fmtTime(a.ackedAt!, lang)}`, ` · handled by ${a.ackedBy} at ${fmtTime(a.ackedAt!, lang)}`)
              : open ? t(" · chưa ai nhận", " · not taken yet") : ""}
            {a.resolvedAt ? t(" · đã bình thường", " · back to normal") : ""}
          </span>
        </span>
        <SeverityChip severity={a.severity} />
        <span className="chev"><IconChevron size={18} /></span>
      </Link>
    </li>
  );
}

export default async function AlertsPage() {
  const session = await requireSession();
  const lang = await getLang();
  const t = makeT(lang);
  const alerts = await getAlerts(session.familyId);
  const open = alerts.filter((a) => !a.resolvedAt);
  const closed = alerts.filter((a) => a.resolvedAt);
  return (
    <main className="container" style={{ maxWidth: 860 }}>
      <AutoRefresh seconds={60} />
      <h1 style={{ fontSize: 24 }}>{t("Cảnh báo", "Alerts")}</h1>
      <section className="card">
        <h2>{t("Đang mở", "Open")} ({open.length})</h2>
        {open.length === 0 ? <div className="muted">{t("Không có cảnh báo nào đang mở.", "No open alerts.")}</div> : <ul className="list">{open.map((a) => <Row key={a.id} a={a} lang={lang} />)}</ul>}
      </section>
      <section className="card">
        <h2>{t("Đã xử lý (30 ngày)", "Resolved (30 days)")}</h2>
        {closed.length === 0 ? <div className="muted">{t("Chưa có.", "None yet.")}</div> : <ul className="list">{closed.map((a) => <Row key={a.id} a={a} lang={lang} />)}</ul>}
      </section>
      <p className="muted">{t("Nhận xử lý và tạm tắt cảnh báo ngay trong tin nhắn Telegram.", "Take on or snooze alerts right from the Telegram message.")}</p>
    </main>
  );
}
