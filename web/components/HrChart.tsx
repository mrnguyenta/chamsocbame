"use client";

import { useState } from "react";
import { useLang } from "@/components/LangProvider";
import { makeT, type Lang } from "@/lib/i18n";

interface Point { ts: string; bpm: number }

const TZ = "Asia/Ho_Chi_Minh";
const hm = (ts: string, lang: Lang) =>
  new Date(ts).toLocaleTimeString(lang === "en" ? "en-GB" : "vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: TZ });

/** Nhịp tim theo thời gian: một đường 2px, ngưỡng nét đứt, rê chuột để xem giá trị. */
export default function HrChart({
  data, threshold, height = 180, compact = false, label,
}: { data: Point[]; threshold?: number; height?: number; compact?: boolean; label?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const lang = useLang();
  const t = makeT(lang);
  if (data.length < 2) {
    return <div className="muted" style={{ height, display: "flex", alignItems: "center" }}>
      {t("Chưa có dữ liệu nhịp tim 24 giờ qua.", "No heart rate data in the last 24 hours.")}</div>;
  }
  const W = 1000;
  const t0 = new Date(data[0].ts).getTime();
  const t1 = new Date(data[data.length - 1].ts).getTime();
  const vals = data.map((d) => d.bpm);
  const lo = Math.max(30, Math.min(...vals, threshold ?? 999) - 10);
  const hi = Math.max(...vals, threshold ?? 0) + 10;
  const x = (ts: string) => ((new Date(ts).getTime() - t0) / Math.max(1, t1 - t0)) * W;
  const y = (v: number) => height - ((v - lo) / (hi - lo)) * height;
  const path = data.map((d, i) => `${i ? "L" : "M"}${x(d.ts).toFixed(1)},${y(d.bpm).toFixed(1)}`).join(" ");
  const p = hover === null ? null : data[hover];

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - r.left) / r.width;
    const target = t0 + frac * (t1 - t0);
    let best = 0;
    for (let i = 1; i < data.length; i++) {
      if (Math.abs(new Date(data[i].ts).getTime() - target) < Math.abs(new Date(data[best].ts).getTime() - target)) best = i;
    }
    setHover(best);
  }

  const ticks = compact ? [] : [0, 0.25, 0.5, 0.75, 1].map((f) => new Date(t0 + f * (t1 - t0)).toISOString());

  return (
    <figure style={{ margin: 0 }}>
      <div
        style={{ position: "relative", height, touchAction: "none" }}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={t(`${label ?? "Nhịp tim"}: thấp nhất ${Math.min(...vals)}, cao nhất ${Math.max(...vals)} nhịp mỗi phút`,
          `${label ?? "Heart rate"}: low ${Math.min(...vals)}, high ${Math.max(...vals)} beats per minute`)}
      >
        <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" width="100%" height={height} style={{ display: "block", overflow: "visible" }}>
          {!compact && [0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1="0" x2={W} y1={height * f} y2={height * f} stroke="var(--grid)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          {threshold !== undefined && (
            <line x1="0" x2={W} y1={y(threshold)} y2={y(threshold)} stroke="var(--warn-mark)" strokeWidth="1.5"
              strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
          )}
          <path d={path} fill="none" stroke="var(--series-hr)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
            vectorEffect="non-scaling-stroke" />
        </svg>
        {threshold !== undefined && !compact && (
          <span className="muted" style={{ position: "absolute", right: 0, top: y(threshold) - 20, fontSize: 11,
            background: "var(--surface)", padding: "0 4px", color: "var(--warn-fg)" }}>{t("ngưỡng", "threshold")} {threshold}</span>
        )}
        {p && (
          <>
            <div style={{ position: "absolute", top: 0, bottom: 0, left: `${(x(p.ts) / W) * 100}%`, width: 1, background: "var(--border-strong)" }} />
            <div style={{ position: "absolute", left: `${(x(p.ts) / W) * 100}%`, top: y(p.bpm), width: 10, height: 10,
              borderRadius: "50%", background: "var(--series-hr)", border: "2px solid var(--surface)", transform: "translate(-50%,-50%)" }} />
            <div className="chart-tip" style={{ left: `${(x(p.ts) / W) * 100}%`, top: Math.max(18, y(p.bpm) - 8) }}>
              {hm(p.ts, lang)} · <strong>{p.bpm}</strong> bpm
            </div>
          </>
        )}
      </div>
      {!compact && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
          {ticks.map((tk) => <span key={tk}>{hm(tk, lang)}</span>)}

        </div>
      )}
    </figure>
  );
}
