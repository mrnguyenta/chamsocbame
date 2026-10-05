"use client";

import { useActionState } from "react";
import { CONDITIONS, METRICS, SEVERITY } from "@/lib/metrics";
import type { FamilySettings, RuleRow } from "@/lib/types";
import {
  type ActionState, addMed, addRule, createWatchKey, saveConditions, saveFamily, saveRule,
} from "./actions";

const INIT: ActionState = { ok: false, message: "" };

function Msg({ s }: { s: ActionState }) {
  if (!s.message) return null;
  return <span role="status" style={{ fontSize: 13, color: s.ok ? "var(--ok-fg)" : "var(--danger-fg)" }}>{s.message}</span>;
}

function SeveritySelect({ value, name = "severity" }: { value?: string; name?: string }) {
  return (
    <select name={name} defaultValue={value ?? "warn"} aria-label="Mức độ">
      {Object.entries(SEVERITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
    </select>
  );
}

export function RuleForm({ rule }: { rule: RuleRow }) {
  const [state, action, pending] = useActionState(saveRule, INIT);
  const m = METRICS[rule.metric] ?? { label: rule.metric, unit: "", hint: "" };
  return (
    <form action={action} className="row" style={{ gap: 10, padding: "10px 0", borderTop: "1px solid var(--border)" }}>
      <input type="hidden" name="rule_id" value={rule.id} />
      <label className="row" style={{ gap: 6, minHeight: 44 }}>
        <input type="checkbox" name="enabled" defaultChecked={rule.enabled} style={{ width: 20, height: 20 }} />
        <span className="sr-only">Bật</span>
      </label>
      <div style={{ flex: "1 1 200px", minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{m.label} {rule.comparator === "gt" ? "cao hơn" : "thấp hơn"}</div>
        <div className="muted">{m.hint}{rule.notify === "elder" ? " · nhắn riêng ba mẹ" : ""}</div>
      </div>
      <label className="row" style={{ gap: 6 }}>
        <span className="muted">{rule.comparator === "gt" ? ">" : "<"}</span>
        <input type="number" step="any" name="threshold" defaultValue={rule.threshold} style={{ width: 90 }}
          aria-label={`Ngưỡng ${m.label}`} />
        <span className="muted">{m.unit}</span>
      </label>
      <SeveritySelect value={rule.severity} />
      <input type="time" name="active_after" defaultValue={rule.activeAfter ?? ""} aria-label="Chỉ kiểm tra sau giờ"
        title="Chỉ kiểm tra sau giờ này (để trống = luôn kiểm tra)" />
      <button className="btn small" type="submit" disabled={pending}>Lưu</button>
      <Msg s={state} />
    </form>
  );
}

export function AddRuleForm({ elderId }: { elderId: string }) {
  const [state, action, pending] = useActionState(addRule, INIT);
  return (
    <form action={action} className="row" style={{ gap: 10, marginTop: 12 }}>
      <input type="hidden" name="elder_id" value={elderId} />
      <select name="metric" aria-label="Chỉ số">
        {Object.entries(METRICS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
      <select name="comparator" aria-label="So sánh">
        <option value="gt">cao hơn</option>
        <option value="lt">thấp hơn</option>
      </select>
      <input type="number" step="any" name="threshold" required placeholder="Ngưỡng" style={{ width: 100 }} aria-label="Ngưỡng" />
      <SeveritySelect />
      <input type="time" name="active_after" aria-label="Chỉ kiểm tra sau giờ" />
      <button className="btn small" type="submit" disabled={pending}>+ Thêm ngưỡng</button>
      <Msg s={state} />
    </form>
  );
}

export function ConditionsForm({ elderId, conditions }: { elderId: string; conditions: string[] }) {
  const [state, action, pending] = useActionState(saveConditions, INIT);
  return (
    <form action={action} className="row" style={{ gap: 14 }}>
      <input type="hidden" name="elder_id" value={elderId} />
      {Object.entries(CONDITIONS).map(([k, label]) => (
        <label key={k} className="row" style={{ gap: 6, minHeight: 44 }}>
          <input type="checkbox" name={`c_${k}`} defaultChecked={conditions.includes(k)} style={{ width: 20, height: 20 }} />
          {label}
        </label>
      ))}
      <button className="btn small" type="submit" disabled={pending}>Lưu bệnh nền</button>
      <Msg s={state} />
    </form>
  );
}

export function FamilyForm({ f }: { f: FamilySettings }) {
  const [state, action, pending] = useActionState(saveFamily, INIT);
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="row">
        <label className="field">Giờ yên lặng từ<input type="time" name="quiet_start" defaultValue={f.quietStart} /></label>
        <label className="field">đến<input type="time" name="quiet_end" defaultValue={f.quietEnd} /></label>
      </div>
      <div className="muted">Trong giờ yên lặng chỉ gửi cảnh báo Khẩn cấp.</div>
      <div className="row">
        <label className="field">Báo cáo sáng<input type="time" name="morning_report_at" defaultValue={f.morningReportAt} /></label>
        <label className="field">Tổng kết tối<input type="time" name="evening_report_at" defaultValue={f.eveningReportAt ?? ""} /></label>
      </div>
      <div className="row"><button className="btn small" type="submit" disabled={pending}>Lưu</button><Msg s={state} /></div>
    </form>
  );
}

export function AddMedForm({ elderId }: { elderId: string }) {
  const [state, action, pending] = useActionState(addMed, INIT);
  return (
    <form action={action} className="row" style={{ gap: 10, marginTop: 10 }}>
      <input type="hidden" name="elder_id" value={elderId} />
      <input type="text" name="name" placeholder="Tên thuốc, liều" aria-label="Tên thuốc" required />
      <input type="text" name="times" placeholder="07:00, 19:00" aria-label="Giờ uống" required style={{ width: 130 }} />
      <input type="text" name="note" placeholder="Ghi chú (sau ăn…)" aria-label="Ghi chú" />
      <button className="btn small" type="submit" disabled={pending}>+ Thêm thuốc</button>
      <Msg s={state} />
    </form>
  );
}

export function WatchKeyForm({ elderId }: { elderId: string }) {
  const [state, action, pending] = useActionState(createWatchKey, INIT);
  return (
    <form action={action} className="row" style={{ gap: 10, marginTop: 10 }}>
      <input type="hidden" name="elder_id" value={elderId} />
      <input type="text" name="label" placeholder="Tên đồng hồ (Venu 4…)" aria-label="Tên đồng hồ" />
      <button className="btn small" type="submit" disabled={pending}>Tạo mã cho đồng hồ</button>
      <Msg s={state} />
      {state.key && (
        <code style={{ display: "block", width: "100%", padding: 10, borderRadius: 8, background: "var(--surface-2)",
          userSelect: "all", wordBreak: "break-all" }}>{state.key}</code>
      )}
    </form>
  );
}
