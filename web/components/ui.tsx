import { SEVERITY, STATUS } from "@/lib/metrics";
import type { Severity, Status } from "@/lib/types";

export function StatusChip({ status }: { status: Status }) {
  const s = STATUS[status];
  return <span className={`chip tone-${s.tone}`}>{s.label}</span>;
}

export function SeverityChip({ severity }: { severity: Severity }) {
  const s = SEVERITY[severity];
  return <span className={`chip tone-${s.tone}`}>{s.label}</span>;
}

export function Avatar({ name }: { name: string }) {
  const initial = name.split(" ").pop()?.[0] ?? "?";
  return <div className="avatar" aria-hidden>{initial}</div>;
}

export function Kpi({ label, value, unit, note, tone }: {
  label: string; value: React.ReactNode; unit?: string; note?: string; tone?: "danger" | "warn";
}) {
  const color = tone === "danger" ? "var(--danger-mark)" : tone === "warn" ? "var(--warn-fg)" : undefined;
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value" style={{ color }}>{value}{unit && value !== "—" && <span className="unit"> {unit}</span>}</div>
      {note && <div className="muted" style={{ fontSize: 12 }}>{note}</div>}
    </div>
  );
}
