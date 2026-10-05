"use client";

import { severities, statuses } from "@/lib/metrics";
import { useLang } from "./LangProvider";
import type { Severity, Status } from "@/lib/types";

export function StatusChip({ status }: { status: Status }) {
  const s = statuses(useLang())[status];
  return <span className={`chip tone-${s.tone}`}>{s.label}</span>;
}

export function SeverityChip({ severity }: { severity: Severity }) {
  const s = severities(useLang())[severity];
  return <span className={`chip tone-${s.tone}`}>{s.label}</span>;
}

export function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  const initial = name.split(" ").pop()?.[0] ?? "?";
  const size = small ? 38 : 52;
  return <div className="avatar" aria-hidden style={{ width: size, height: size, fontSize: small ? 15 : 20 }}>{initial}</div>;
}

export function Kpi({ label, value, unit, note, tone, icon, tile = "tile-teal" }: {
  label: string; value: React.ReactNode; unit?: string; note?: string; tone?: "danger" | "warn";
  icon?: React.ReactNode; tile?: string;
}) {
  const color = tone === "danger" ? "var(--coral-ink)" : tone === "warn" ? "var(--warn-fg)" : undefined;
  return (
    <div className="kpi">
      <div className="label">{icon && <span className={`icon-tile sm ${tile}`}>{icon}</span>}{label}</div>
      <div className="value" style={{ color }}>{value}{unit && value !== "—" && <span className="unit"> {unit}</span>}</div>
      {note && <div className="muted" style={{ fontSize: 12 }}>{note}</div>}
    </div>
  );
}
