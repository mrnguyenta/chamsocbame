import Link from "next/link";
import HrChart from "./HrChart";
import { HeartArt, IconAlert, IconBolt, IconChevron, IconMoon, IconSteps, IconWatch } from "./icons";
import { Avatar, StatusChip } from "./ui";
import { age, fmtAgo, fmtDuration, fmtNum } from "@/lib/format";
import type { ElderSummary } from "@/lib/types";

/** Thẻ lớn cho một người thân: nhìn một lần biết ổn hay không; bấm vào là mở trang của người đó. */
export default function ElderCard({ e, openAlerts = 0 }: { e: ElderSummary; openAlerts?: number }) {
  const hr = e.hrNow ?? e.today.restingHr;
  const warn = e.status === "attention" || openAlerts > 0;
  return (
    <Link href={`/nguoi-than/${e.id}`} className={`card elder-card ${warn ? "is-warn" : e.status === "offline" ? "is-off" : ""}`}>
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <Avatar name={e.name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 20 }}>{e.name}</div>
          <div className="muted">{[age(e.birthYear), e.watchLabel ?? "chưa gắn đồng hồ"].filter(Boolean).join(" · ")}</div>
        </div>
        <StatusChip status={e.status} />
      </div>

      <div className="elder-hr">
        <HeartArt size={64} />
        <div style={{ flex: "0 0 auto" }}>
          <div className="muted">{e.hrNow != null ? "Nhịp tim lúc này" : "Nhịp tim nghỉ"}</div>
          <div className="big-num" style={{ color: warn ? "var(--coral-ink)" : undefined }}>
            {hr ?? "—"}{hr != null && <span className="unit"> bpm</span>}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <HrChart data={e.hr24h} height={48} compact label={`Nhịp tim 24 giờ của ${e.name}`} />
        </div>
      </div>

      {openAlerts > 0 && (
        <div className="banner danger" style={{ padding: "10px 14px" }}>
          <IconAlert size={18} /> <strong>{openAlerts} cảnh báo đang mở</strong>
        </div>
      )}

      <div className="elder-stats">
        <span><IconSteps size={16} /> {fmtNum(e.today.steps)} bước</span>
        <span><IconMoon size={16} /> {fmtDuration(e.today.sleepSeconds)}</span>
        <span><IconBolt size={16} /> {e.today.bodyBattery ?? "—"}/100</span>
      </div>

      <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <span className="muted" style={e.status === "offline" ? { color: "var(--warn-fg)", fontWeight: 600 } : undefined}>
          <IconWatch size={15} /> {e.watchBattery != null ? `pin ${e.watchBattery}% · ` : ""}gửi {fmtAgo(e.lastDataAt)}
        </span>
        <span className="link-sm" style={{ display: "inline-flex", alignItems: "center", gap: 2, whiteSpace: "nowrap" }}>
          Mở trang <IconChevron size={16} />
        </span>
      </div>
    </Link>
  );
}
