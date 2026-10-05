"use client";

import { useState } from "react";
import { useLang } from "@/components/LangProvider";
import { makeT } from "@/lib/i18n";

const DOW_VI = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const DOW_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Bước chân 7 ngày: cột bo tròn, ngày cao nhất có nhãn số, mục tiêu là đường nét đứt; rê chuột để xem số. */
export default function StepsChart({ data, goal = 6000 }: { data: { day: string; steps: number | null }[]; goal?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const lang = useLang();
  const t = makeT(lang);
  const DOW = lang === "en" ? DOW_EN : DOW_VI;
  const nf = lang === "en" ? "en-US" : "vi-VN";
  const H = 130;
  const max = Math.max(goal, ...data.map((d) => d.steps ?? 0)) * 1.15;
  const best = data.reduce((bi, d, i) => ((d.steps ?? 0) > (data[bi].steps ?? 0) ? i : bi), 0);
  const reached = data.filter((d) => (d.steps ?? 0) >= goal).length;
  const shown = hover ?? best;
  return (
    <figure style={{ margin: 0 }}>
      <figcaption className="muted">
        {t(`Mục tiêu ${goal.toLocaleString(nf)} bước · đạt ${reached}/${data.length} ngày`,
          `Goal ${goal.toLocaleString(nf)} steps · reached ${reached}/${data.length} days`)}
      </figcaption>
      <div style={{ position: "relative", height: H, marginTop: 26, display: "flex", alignItems: "flex-end", gap: 6 }}>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: (goal / max) * H, borderTop: "1.5px dashed var(--muted)", opacity: 0.6 }} />
        {data.map((d, i) => {
          const h = d.steps ? Math.max(8, (d.steps / max) * H) : 0;
          const isLast = i === data.length - 1;
          return (
            <div key={d.day} style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", position: "relative" }}
              onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}
              role="img" aria-label={t(`${DOW[new Date(d.day + "T00:00:00").getDay()]}: ${d.steps ?? "không có dữ liệu"} bước`,
                `${DOW[new Date(d.day + "T00:00:00").getDay()]}: ${d.steps ?? "no data"} steps`)}>
              <div style={{ width: 14, height: h, borderRadius: 999,
                background: isLast || i === shown ? "var(--accent-strong)" : "color-mix(in srgb, var(--accent) 45%, transparent)" }} />
              {i === shown && d.steps != null && (
                <div className="chart-tip" style={{ left: "50%", top: H - h - 6, background: "var(--accent-strong)", color: "#fff" }}>
                  {d.steps.toLocaleString(nf)}

                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        {data.map((d) => (
          <span key={d.day} style={{ flex: 1, textAlign: "center", fontSize: 12, color: "var(--muted)" }}>
            {DOW[new Date(d.day + "T00:00:00").getDay()]}
          </span>
        ))}
      </div>
    </figure>
  );
}
