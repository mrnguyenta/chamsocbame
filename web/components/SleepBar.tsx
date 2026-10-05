import { fmtDuration } from "@/lib/format";
import { getLang } from "@/lib/i18n-server";
import type { Lang } from "@/lib/i18n";
import type { SleepStages } from "@/lib/types";

const stages = (lang: Lang): { key: keyof SleepStages; label: string; color: string }[] => [
  { key: "deep", label: lang === "en" ? "Deep" : "Sâu", color: "var(--sleep-deep)" },
  { key: "light", label: lang === "en" ? "Light" : "Nhẹ", color: "var(--sleep-light)" },
  { key: "rem", label: "REM", color: "var(--sleep-rem)" },
  { key: "awake", label: lang === "en" ? "Awake" : "Thức", color: "var(--sleep-awake)" },
];

/** Giai đoạn ngủ: một thanh xếp chồng, khe 2px giữa các đoạn, chú thích kèm số. */
export default async function SleepBar({ sleep }: { sleep: SleepStages }) {
  const lang = await getLang();
  const STAGES = stages(lang);
  const total = STAGES.reduce((s, x) => s + sleep[x.key], 0) || 1;
  return (
    <div>
      <div style={{ display: "flex", gap: 2, height: 22, borderRadius: 6, overflow: "hidden" }} role="img"
        aria-label={STAGES.map((s) => `${s.label} ${fmtDuration(sleep[s.key], lang)}`).join(", ")}>
        {STAGES.map((s) => sleep[s.key] > 0 && (
          <div key={s.key} title={`${s.label}: ${fmtDuration(sleep[s.key], lang)}`}
            style={{ flex: sleep[s.key] / total, background: s.color }} />
        ))}
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6, fontSize: 13 }}>
        {STAGES.map((s) => (
          <li key={s.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: 2, background: s.color }} />
            {s.label} · {fmtDuration(sleep[s.key], lang)}

          </li>
        ))}
      </ul>
    </div>
  );
}
