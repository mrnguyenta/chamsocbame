"use client";

import { useState } from "react";

const DOW = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

/** Bước chân 7 ngày: cột mảnh, mục tiêu là đường tham chiếu, rê chuột để xem số. */
export default function StepsChart({ data, goal = 6000 }: { data: { day: string; steps: number | null }[]; goal?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const H = 120;
  const max = Math.max(goal, ...data.map((d) => d.steps ?? 0)) * 1.1;
  const reached = data.filter((d) => (d.steps ?? 0) >= goal).length;
  return (
    <figure style={{ margin: 0 }}>
      <figcaption className="muted">Mục tiêu {goal.toLocaleString("vi-VN")} bước · đạt {reached}/{data.length} ngày</figcaption>
      <div style={{ position: "relative", height: H, marginTop: 14, display: "flex", alignItems: "flex-end", gap: 2,
        borderBottom: "1px solid var(--border-strong)" }}>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: (goal / max) * H, borderTop: "1.5px dashed var(--muted)" }} />
        {data.map((d, i) => (
          <div key={d.day} style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center",
            position: "relative" }}
            onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}
            aria-label={`${d.day}: ${d.steps ?? "không có dữ liệu"} bước`} role="img">
            <div style={{ width: "100%", maxWidth: 24, height: d.steps ? Math.max(3, (d.steps / max) * H) : 0,
              background: "var(--series-steps)", borderRadius: "4px 4px 0 0", opacity: hover === null || hover === i ? 1 : 0.55 }} />
            {hover === i && (
              <div className="chart-tip" style={{ left: "50%", top: H - (d.steps ? (d.steps / max) * H : 0) - 4 }}>
                {d.steps === null ? "Không có dữ liệu" : `${d.steps.toLocaleString("vi-VN")} bước`}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 2, marginTop: 6 }}>
        {data.map((d) => (
          <span key={d.day} style={{ flex: 1, textAlign: "center", fontSize: 12, color: "var(--muted)" }}>
            {DOW[new Date(d.day + "T00:00:00").getDay()]}
          </span>
        ))}
      </div>
    </figure>
  );
}
