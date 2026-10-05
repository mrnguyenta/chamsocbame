"use client";

import { useActionState, useState } from "react";
import {
  IconBell, IconBolt, IconDrop, IconHeart, IconMoon, IconPlus, IconPulse, IconSteps, IconWatch,
} from "@/components/icons";
import { CONDITIONS, METRICS, SEVERITY } from "@/lib/metrics";
import type { FamilySettings, RuleRow } from "@/lib/types";
import {
  type ActionState, addMed, addRule, createWatchKey, deleteRule, saveConditions, saveFamily, saveRule,
} from "./actions";

const INIT: ActionState = { ok: false, message: "" };

const METRIC_ICON: Record<string, React.ReactNode> = {
  hr_now: <IconHeart size={18} />, resting_hr: <IconHeart size={18} />, spo2_min: <IconDrop size={18} />,
  systolic: <IconPulse size={18} />, diastolic: <IconPulse size={18} />, glucose: <IconDrop size={18} />,
  steps: <IconSteps size={18} />, sleep_hours: <IconMoon size={18} />, body_battery: <IconBolt size={18} />,
  stress_avg: <IconPulse size={18} />, no_live_minutes: <IconWatch size={18} />, no_sync_hours: <IconWatch size={18} />,
  watch_battery: <IconBolt size={18} />,
};

function Msg({ s }: { s: ActionState }) {
  if (!s.message) return null;
  return <span role="status" style={{ fontSize: 13, fontWeight: 600, color: s.ok ? "var(--ok-fg)" : "var(--danger-fg)" }}>{s.message}</span>;
}

function SeveritySelect({ value, name = "severity" }: { value?: string; name?: string }) {
  return (
    <label className="input-group">
      <span className="muted">Mức</span>
      <select name={name} defaultValue={value ?? "warn"} aria-label="Mức độ"
        style={{ border: "none", background: "transparent", minHeight: 38, padding: 0, fontWeight: 600 }}>
        {Object.entries(SEVERITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
    </label>
  );
}

export function RuleForm({ rule, tile, canEdit }: { rule: RuleRow; tile: string; canEdit: boolean }) {
  const [state, action, pending] = useActionState(saveRule, INIT);
  const [on, setOn] = useState(rule.enabled);
  const m = METRICS[rule.metric] ?? { label: rule.metric, unit: "", hint: "" };
  return (
    <form action={action} className={`rule${on ? "" : " off"}`}>
      <input type="hidden" name="rule_id" value={rule.id} />
      <div className="rule-top">
        <span className={`icon-tile ${tile}`}>{METRIC_ICON[rule.metric] ?? <IconBell size={18} />}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{m.label} {rule.comparator === "gt" ? "cao hơn" : "thấp hơn"}</div>
          <div className="muted">{m.hint}{rule.notify === "elder" ? " · nhắn riêng ba mẹ" : ""}</div>
        </div>
        <label className="switch-label" title={on ? "Đang bật" : "Đang tắt"}>
          <input type="checkbox" className="switch" name="enabled" checked={on} disabled={!canEdit}
            onChange={(e) => { setOn(e.target.checked); e.currentTarget.form?.requestSubmit(); }} />
          <span className="sr-only">Bật cảnh báo {m.label}</span>
        </label>
      </div>
      <div className="rule-fields">
        <label className="input-group">
          <span className="muted">{rule.comparator === "gt" ? "Trên" : "Dưới"}</span>
          <input type="number" step="any" name="threshold" defaultValue={rule.threshold} aria-label={`Ngưỡng ${m.label}`} disabled={!canEdit} />
          <span className="muted">{m.unit}</span>
        </label>
        <SeveritySelect value={rule.severity} />
        <label className="input-group" title="Chỉ kiểm tra sau giờ này mỗi ngày (để trống = luôn kiểm tra)">
          <span className="muted">Sau</span>
          <input type="time" name="active_after" defaultValue={rule.activeAfter ?? ""} aria-label="Chỉ kiểm tra sau giờ" disabled={!canEdit} />
        </label>
        {canEdit && (
          <>
            <button className="btn primary small" type="submit" disabled={pending}>{pending ? "Đang lưu…" : "Lưu"}</button>
            <button className="btn ghost small" type="submit" formAction={deleteRule} formNoValidate
              style={{ color: "var(--coral-ink)" }}>Xoá</button>
          </>
        )}
        <Msg s={state} />
      </div>
    </form>
  );
}

export function AddRuleForm({ elderId }: { elderId: string }) {
  const [state, action, pending] = useActionState(addRule, INIT);
  return (
    <details className="more" style={{ marginTop: 14 }}>
      <summary className="btn small"><IconPlus size={16} /> Thêm ngưỡng khác</summary>
      <form action={action} className="rule" style={{ marginTop: 10 }}>
        <input type="hidden" name="elder_id" value={elderId} />
        <div className="rule-fields">
          <label className="input-group">
            <span className="muted">Chỉ số</span>
            <select name="metric" aria-label="Chỉ số" style={{ border: "none", background: "transparent", minHeight: 38, padding: 0, fontWeight: 600 }}>
              {Object.entries(METRICS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </label>
          <label className="input-group">
            <select name="comparator" aria-label="So sánh" style={{ border: "none", background: "transparent", minHeight: 38, padding: 0, fontWeight: 600 }}>
              <option value="gt">Cao hơn</option>
              <option value="lt">Thấp hơn</option>
            </select>
            <input type="number" step="any" name="threshold" required placeholder="0" aria-label="Ngưỡng" />
          </label>
          <SeveritySelect />
          <label className="input-group"><span className="muted">Sau</span><input type="time" name="active_after" aria-label="Chỉ kiểm tra sau giờ" /></label>
          <button className="btn primary small" type="submit" disabled={pending}>Thêm</button>
          <Msg s={state} />
        </div>
      </form>
    </details>
  );
}

export function ConditionsForm({ elderId, conditions, canEdit }: { elderId: string; conditions: string[]; canEdit: boolean }) {
  const [state, action, pending] = useActionState(saveConditions, INIT);
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input type="hidden" name="elder_id" value={elderId} />
      <div className="row" style={{ gap: 8 }}>
        {Object.entries(CONDITIONS).map(([k, label]) => (
          <label key={k} className="check-chip">
            <input type="checkbox" name={`c_${k}`} defaultChecked={conditions.includes(k)} disabled={!canEdit} />
            <span className="tick" aria-hidden>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="M5 12l5 5 9-10" /></svg>
            </span>
            {label}
          </label>
        ))}
      </div>
      {canEdit && (
        <div className="row"><button className="btn small" type="submit" disabled={pending}>Lưu bệnh nền</button><Msg s={state} /></div>
      )}
    </form>
  );
}

export function FamilyForm({ f, canEdit }: { f: FamilySettings; canEdit: boolean }) {
  const [state, action, pending] = useActionState(saveFamily, INIT);
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div className="section-title" style={{ margin: "0 0 8px" }}>Báo cáo vào nhóm gia đình</div>
        <div className="row" style={{ gap: 8 }}>
          <label className="input-group"><span className="muted">Sáng</span><input type="time" name="morning_report_at" defaultValue={f.morningReportAt} disabled={!canEdit} /></label>
          <label className="input-group"><span className="muted">Tối</span><input type="time" name="evening_report_at" defaultValue={f.eveningReportAt ?? ""} disabled={!canEdit} /></label>
        </div>
      </div>
      <div>
        <div className="section-title" style={{ margin: "0 0 8px" }}>Giờ yên lặng</div>
        <div className="row" style={{ gap: 8 }}>
          <label className="input-group"><span className="muted">Từ</span><input type="time" name="quiet_start" defaultValue={f.quietStart} disabled={!canEdit} /></label>
          <label className="input-group"><span className="muted">Đến</span><input type="time" name="quiet_end" defaultValue={f.quietEnd} disabled={!canEdit} /></label>
        </div>
        <div className="muted" style={{ marginTop: 6 }}>Trong giờ yên lặng chỉ gửi cảnh báo Khẩn cấp.</div>
      </div>
      {canEdit && <div className="row"><button className="btn primary small" type="submit" disabled={pending}>Lưu</button><Msg s={state} /></div>}
    </form>
  );
}

export function AddMedForm({ elderId }: { elderId: string }) {
  const [state, action, pending] = useActionState(addMed, INIT);
  return (
    <details className="more" style={{ marginTop: 12 }}>
      <summary className="btn small"><IconPlus size={16} /> Thêm thuốc</summary>
      <form action={action} className="rule" style={{ marginTop: 10 }}>
        <input type="hidden" name="elder_id" value={elderId} />
        <label className="field">Tên thuốc, liều<input type="text" name="name" placeholder="Amlodipine 5mg" required /></label>
        <div className="row" style={{ gap: 10 }}>
          <label className="field" style={{ flex: "1 1 140px" }}>Giờ uống<input type="text" name="times" placeholder="07:00, 19:00" required /></label>
          <label className="field" style={{ flex: "2 1 200px" }}>Ghi chú<input type="text" name="note" placeholder="sau ăn sáng" /></label>
        </div>
        <div className="row"><button className="btn primary small" type="submit" disabled={pending}>Thêm thuốc</button><Msg s={state} /></div>
      </form>
    </details>
  );
}

export function WatchKeyForm({ elderId }: { elderId: string }) {
  const [state, action, pending] = useActionState(createWatchKey, INIT);
  return (
    <form action={action} className="row" style={{ gap: 10, marginTop: 10 }}>
      <input type="hidden" name="elder_id" value={elderId} />
      <input type="text" name="label" placeholder="Tên đồng hồ (Venu 4…)" aria-label="Tên đồng hồ" />
      <button className="btn small" type="submit" disabled={pending}>Tạo mã dài</button>
      <Msg s={state} />
      {state.key && (
        <code style={{ display: "block", width: "100%", padding: 10, borderRadius: 10, background: "var(--surface-2)",
          userSelect: "all", wordBreak: "break-all" }}>{state.key}</code>
      )}
    </form>
  );
}
