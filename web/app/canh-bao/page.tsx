import Link from "next/link";
import AutoRefresh from "@/components/AutoRefresh";
import { IconAlert, IconChevron, IconFile } from "@/components/icons";
import { SeverityChip } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { getAlerts } from "@/lib/data";
import { fmtDateTime, fmtTime } from "@/lib/format";
import type { AlertRow } from "@/lib/types";

export const dynamic = "force-dynamic";

function Row({ a }: { a: AlertRow }) {
  const open = !a.resolvedAt;
  return (
    <li>
      <Link className="list-row" href={`/nguoi-than/${a.elderId}`}>
        <span className={`icon-tile ${open ? "tile-coral" : "tile-teal"}`}>{open ? <IconAlert size={20} /> : <IconFile size={20} />}</span>
        <span className="grow">
          <span className="title" style={{ display: "block" }}>{a.elderName} · {a.message}</span>
          <span className="muted">
            {fmtDateTime(a.openedAt)}
            {a.ackedBy ? ` · ${a.ackedBy} nhận lúc ${fmtTime(a.ackedAt!)}` : open ? " · chưa ai nhận" : ""}
            {a.resolvedAt ? " · đã bình thường" : ""}
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
  const alerts = await getAlerts(session.familyId);
  const open = alerts.filter((a) => !a.resolvedAt);
  const closed = alerts.filter((a) => a.resolvedAt);
  return (
    <main className="container" style={{ maxWidth: 860 }}>
      <AutoRefresh seconds={60} />
      <h1 style={{ fontSize: 24 }}>Cảnh báo</h1>
      <section className="card">
        <h2>Đang mở ({open.length})</h2>
        {open.length === 0 ? <div className="muted">Không có cảnh báo nào đang mở.</div> : <ul className="list">{open.map((a) => <Row key={a.id} a={a} />)}</ul>}
      </section>
      <section className="card">
        <h2>Đã xử lý (30 ngày)</h2>
        {closed.length === 0 ? <div className="muted">Chưa có.</div> : <ul className="list">{closed.map((a) => <Row key={a.id} a={a} />)}</ul>}
      </section>
      <p className="muted">Nhận xử lý và tạm tắt cảnh báo ngay trong tin nhắn Telegram.</p>
    </main>
  );
}
