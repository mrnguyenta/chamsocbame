import Link from "next/link";
import HrChart from "./HrChart";
import { HeartArt, IconAlert, IconBolt, IconChevron, IconFlame, IconMoon, IconPulse, IconSteps, IconWatch } from "./icons";
import { Avatar, StatusChip } from "./ui";
import { age, fmtAgo, fmtDuration, fmtNum } from "@/lib/format";
import { makeT } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import type { ElderSummary } from "@/lib/types";

/** Thẻ lớn cho một người thân: nhìn một lần biết ổn hay không; bấm vào là mở trang của người đó. */
export default async function ElderCard({ e, openAlerts = 0 }: { e: ElderSummary; openAlerts?: number }) {
  const lang = await getLang();
  const t = makeT(lang);
  const hr = e.hrNow ?? e.today.restingHr;
  const warn = e.status === "attention" || openAlerts > 0;
  return (
    <Link href={`/nguoi-than/${e.id}`} className={`card elder-card ${warn ? "is-warn" : e.status === "offline" ? "is-off" : ""}`}>
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <Avatar name={e.name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 20 }}>{e.name}</div>
          <div className="muted">{[age(e.birthYear, lang), e.watchLabel ?? t("chưa gắn đồng hồ", "no watch set up")].filter(Boolean).join(" · ")}</div>
        </div>
        <StatusChip status={e.status} />
      </div>

      <div className="elder-hr">
        <HeartArt size={64} />
        <div style={{ flex: "0 0 auto" }}>
          <div className="muted">{e.hrNow != null ? t("Nhịp tim lúc này", "Heart rate now") : t("Nhịp tim nghỉ", "Resting heart rate")}</div>
          <div className="big-num" style={{ color: warn ? "var(--coral-ink)" : undefined }}>
            {hr ?? "—"}{hr != null && <span className="unit"> bpm</span>}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <HrChart data={e.hr24h} height={48} compact label={t(`Nhịp tim 24 giờ của ${e.name}`, `${e.name}'s 24-hour heart rate`)} />
        </div>
      </div>

      {openAlerts > 0 && (
        <div className="banner danger" style={{ padding: "10px 14px" }}>
          <IconAlert size={18} /> <strong>{t(`${openAlerts} cảnh báo đang mở`, `${openAlerts} open ${openAlerts === 1 ? "alert" : "alerts"}`)}</strong>
        </div>
      )}

      {e.wear === "not_worn" && (
        <div className="banner info" style={{ padding: "10px 14px" }}><IconWatch size={18} /> {t("Đang không đeo đồng hồ", "Watch not being worn")}</div>
      )}
      {e.wear === "charging" && (
        <div className="banner info" style={{ padding: "10px 14px" }}><IconWatch size={18} /> {t("Đồng hồ đang sạc", "Watch is charging")}</div>
      )}
      {e.inactiveMin != null && e.inactiveMin >= 90 && (
        <div className="banner warn" style={{ padding: "10px 14px" }}>
          {t("Ngồi/nằm im", "Not moving for")} {e.inactiveMin >= 120
            ? t(`${Math.floor(e.inactiveMin / 60)} giờ ${e.inactiveMin % 60} phút`, `${Math.floor(e.inactiveMin / 60)} h ${e.inactiveMin % 60} min`)
            : t(`${e.inactiveMin} phút`, `${e.inactiveMin} min`)}
        </div>
      )}

      <div className="elder-stats">
        <span><IconSteps size={16} /> {fmtNum(e.today.steps, lang)} {t("bước", "steps")}</span>
        {e.today.calories != null && <span><IconFlame size={16} /> {fmtNum(e.today.calories, lang)} kcal</span>}
        <span><IconPulse size={16} /> {t("căng thẳng", "stress")} {e.today.stressNow ?? e.today.stressAvg ?? "—"}</span>
        <span><IconBolt size={16} /> {e.today.bodyBattery ?? "—"}/100</span>
        <span><IconMoon size={16} /> {fmtDuration(e.today.sleepSeconds, lang)}</span>
      </div>

      <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <span className="muted" style={e.status === "offline" ? { color: "var(--warn-fg)", fontWeight: 600 } : undefined}>
          <IconWatch size={15} /> {e.watchBattery != null ? `${t("pin", "battery")} ${e.watchBattery}% · ` : ""}{t("gửi", "sent")} {fmtAgo(e.lastDataAt, undefined, lang)}
        </span>
        <span className="link-sm" style={{ display: "inline-flex", alignItems: "center", gap: 2, whiteSpace: "nowrap" }}>
          {t("Mở trang", "Open")} <IconChevron size={16} />

        </span>
      </div>
    </Link>
  );
}
