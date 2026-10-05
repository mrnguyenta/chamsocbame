import { HeartArt } from "./icons";

/** Vòng đo nhịp tim: cung màu theo vị trí trên thang 40–160 bpm, trái tim ở giữa. */
export default function HeartRing({ bpm, size = 168 }: { bpm: number | null; size?: number }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  const frac = bpm == null ? 0 : Math.min(1, Math.max(0.04, (bpm - 40) / 120));
  return (
    <div style={{ position: "relative", width: size, height: size, flex: "none" }}
      role="img" aria-label={bpm == null ? "Chưa có nhịp tim" : `Nhịp tim ${bpm} nhịp mỗi phút`}>
      <svg width={size} height={size} viewBox="0 0 180 180" style={{ transform: "rotate(-90deg)" }} aria-hidden>
        <defs>
          <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--coral)" />
          </linearGradient>
        </defs>
        <circle cx="90" cy="90" r={r} fill="none" stroke="var(--grid)" strokeWidth="14" />
        <circle cx="90" cy="90" r={r} fill="none" stroke="url(#ring)" strokeWidth="14" strokeLinecap="round"
          strokeDasharray={`${frac * c} ${c}`} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <HeartArt size={size * 0.42} />
      </div>
    </div>
  );
}
