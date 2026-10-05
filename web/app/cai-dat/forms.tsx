"use client";

import { useActionState, useState } from "react";
import {
  IconBell, IconBolt, IconDrop, IconHeart, IconMoon, IconPlus, IconPulse, IconSteps, IconWatch,
} from "@/components/icons";
import { useLang, useT } from "@/components/LangProvider";
import { conditions as conditionLabels, metrics, severities } from "@/lib/metrics";
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
  const lang = useLang();
  const t = useT();
  return (
    <label className="input-group">
      <span className="muted">{t("Mức", "Level")}</span>
      <select name={name} defaultValue={value ?? "warn"} aria-label={t("Mức độ", "Severity")}
        style={{ border: "none", background: "transparent", minHeight: 38, padding: 0, fontWeight: 600 }}>
        {Object.entries(severities(lang)).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
    </label>
  );
}

export function RuleForm({ rule, tile, canEdit }: { rule: RuleRow; tile: string; canEdit: boolean }) {
  const [state, action, pending] = useActionState(saveRule, INIT);
  const [on, setOn] = useState(rule.enabled);
  const lang = useLang();
  const t = useT();
  const m = metrics(lang)[rule.metric] ?? { label: rule.metric, unit: "", hint: "" };
  return (
    <form action={action} className={`rule${on ? "" : " off"}`}>
      <input type="hidden" name="rule_id" value={rule.id} />
      <div className="rule-top">
        <span className={`icon-tile ${tile}`}>{METRIC_ICON[rule.metric] ?? <IconBell size={18} />}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{m.label} {rule.comparator === "gt" ? t("cao hơn", "above") : t("thấp hơn", "below")}</div>
          <div className="muted">{m.hint}{rule.notify === "elder" ? t(" · nhắn riêng ba mẹ", " · sent to the parent directly") : ""}</div>
        </div>
        <label className="switch-label" title={on ? t("Đang bật", "On") : t("Đang tắt", "Off")}>
          <input type="checkbox" className="switch" name="enabled" checked={on} disabled={!canEdit}
            onChange={(e) => { setOn(e.target.checked); e.currentTarget.form?.requestSubmit(); }} />
          <span className="sr-only">{t("Bật cảnh báo", "Enable alert")} {m.label}</span>
        </label>
      </div>
      <div className="rule-fields">
        <label className="input-group">
          <span className="muted">{rule.comparator === "gt" ? t("Trên", "Above") : t("Dưới", "Below")}</span>
          <input type="number" step="any" name="threshold" defaultValue={rule.threshold} aria-label={`${t("Ngưỡng", "Threshold")} ${m.label}`} disabled={!canEdit} />
          <span className="muted">{m.unit}</span>
        </label>
        <SeveritySelect value={rule.severity} />
        <label className="input-group" title={t("Chỉ kiểm tra sau giờ này mỗi ngày (để trống = luôn kiểm tra)", "Only check after this time each day (empty = always check)")}>
          <span className="muted">{t("Sau", "After")}</span>
          <input type="time" name="active_after" defaultValue={rule.activeAfter ?? ""} aria-label={t("Chỉ kiểm tra sau giờ", "Only check after time")} disabled={!canEdit} />
        </label>
        {canEdit && (
          <>
            <button className="btn primary small" type="submit" disabled={pending}>{pending ? t("Đang lưu…", "Saving…") : t("Lưu", "Save")}</button>
            <button className="btn ghost small" type="submit" formAction={deleteRule} formNoValidate
              style={{ color: "var(--coral-ink)" }}>{t("Xoá", "Delete")}</button>
          </>
        )}
        <Msg s={state} />
      </div>
    </form>
  );
}

export function AddRuleForm({ elderId }: { elderId: string }) {
  const [state, action, pending] = useActionState(addRule, INIT);
  const lang = useLang();
  const t = useT();
  return (
    <details className="more" style={{ marginTop: 14 }}>
      <summary className="btn small"><IconPlus size={16} /> {t("Thêm ngưỡng khác", "Add another threshold")}</summary>
      <form action={action} className="rule" style={{ marginTop: 10 }}>
        <input type="hidden" name="elder_id" value={elderId} />
        <div className="rule-fields">
          <label className="input-group">
            <span className="muted">{t("Chỉ số", "Metric")}</span>
            <select name="metric" aria-label={t("Chỉ số", "Metric")} style={{ border: "none", background: "transparent", minHeight: 38, padding: 0, fontWeight: 600 }}>
              {Object.entries(metrics(lang)).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </label>
          <label className="input-group">
            <select name="comparator" aria-label={t("So sánh", "Comparison")} style={{ border: "none", background: "transparent", minHeight: 38, padding: 0, fontWeight: 600 }}>
              <option value="gt">{t("Cao hơn", "Above")}</option>
              <option value="lt">{t("Thấp hơn", "Below")}</option>
            </select>
            <input type="number" step="any" name="threshold" required placeholder="0" aria-label={t("Ngưỡng", "Threshold")} />
          </label>
          <SeveritySelect />
          <label className="input-group"><span className="muted">{t("Sau", "After")}</span><input type="time" name="active_after" aria-label={t("Chỉ kiểm tra sau giờ", "Only check after time")} /></label>
          <button className="btn primary small" type="submit" disabled={pending}>{t("Thêm", "Add")}</button>
          <Msg s={state} />
        </div>
      </form>
    </details>
  );
}

export function ConditionsForm({ elderId, conditions, canEdit }: { elderId: string; conditions: string[]; canEdit: boolean }) {
  const [state, action, pending] = useActionState(saveConditions, INIT);
  const lang = useLang();
  const t = useT();
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input type="hidden" name="elder_id" value={elderId} />
      <div className="row" style={{ gap: 8 }}>
        {Object.entries(conditionLabels(lang)).map(([k, label]) => (
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
        <div className="row"><button className="btn small" type="submit" disabled={pending}>{t("Lưu bệnh nền", "Save conditions")}</button><Msg s={state} /></div>
      )}
    </form>
  );
}

export function FamilyForm({ f, canEdit }: { f: FamilySettings; canEdit: boolean }) {
  const [state, action, pending] = useActionState(saveFamily, INIT);
  const t = useT();
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div className="section-title" style={{ margin: "0 0 8px" }}>{t("Báo cáo vào nhóm gia đình", "Reports to the family group")}</div>
        <div className="row" style={{ gap: 8 }}>
          <label className="input-group"><span className="muted">{t("Sáng", "Morning")}</span><input type="time" name="morning_report_at" defaultValue={f.morningReportAt} disabled={!canEdit} /></label>
          <label className="input-group"><span className="muted">{t("Tối", "Evening")}</span><input type="time" name="evening_report_at" defaultValue={f.eveningReportAt ?? ""} disabled={!canEdit} /></label>
        </div>
      </div>
      <div>
        <div className="section-title" style={{ margin: "0 0 8px" }}>{t("Giờ yên lặng", "Quiet hours")}</div>
        <div className="row" style={{ gap: 8 }}>
          <label className="input-group"><span className="muted">{t("Từ", "From")}</span><input type="time" name="quiet_start" defaultValue={f.quietStart} disabled={!canEdit} /></label>
          <label className="input-group"><span className="muted">{t("Đến", "To")}</span><input type="time" name="quiet_end" defaultValue={f.quietEnd} disabled={!canEdit} /></label>
        </div>
        <div className="muted" style={{ marginTop: 6 }}>{t("Trong giờ yên lặng chỉ gửi cảnh báo Khẩn cấp.", "During quiet hours only Urgent alerts are sent.")}</div>
      </div>
      {canEdit && <div className="row"><button className="btn primary small" type="submit" disabled={pending}>{t("Lưu", "Save")}</button><Msg s={state} /></div>}
    </form>
  );
}

export function AddMedForm({ elderId }: { elderId: string }) {
  const [state, action, pending] = useActionState(addMed, INIT);
  const t = useT();
  return (
    <details className="more" style={{ marginTop: 12 }}>
      <summary className="btn small"><IconPlus size={16} /> {t("Thêm thuốc", "Add medication")}</summary>
      <form action={action} className="rule" style={{ marginTop: 10 }}>
        <input type="hidden" name="elder_id" value={elderId} />
        <label className="field">{t("Tên thuốc, liều", "Medication, dose")}<input type="text" name="name" placeholder="Amlodipine 5mg" required /></label>
        <div className="row" style={{ gap: 10 }}>
          <label className="field" style={{ flex: "1 1 140px" }}>{t("Giờ uống", "Dose times")}<input type="text" name="times" placeholder="07:00, 19:00" required /></label>
          <label className="field" style={{ flex: "2 1 200px" }}>{t("Ghi chú", "Note")}<input type="text" name="note" placeholder={t("sau ăn sáng", "after breakfast")} /></label>
        </div>
        <div className="row"><button className="btn primary small" type="submit" disabled={pending}>{t("Thêm thuốc", "Add medication")}</button><Msg s={state} /></div>
      </form>
    </details>
  );
}

export function WatchKeyForm({ elderId }: { elderId: string }) {
  const [state, action, pending] = useActionState(createWatchKey, INIT);
  const t = useT();
  return (
    <form action={action} className="row" style={{ gap: 10, marginTop: 10 }}>
      <input type="hidden" name="elder_id" value={elderId} />
      <input type="text" name="label" placeholder={t("Tên đồng hồ (Venu 4…)", "Watch name (Venu 4…)")} aria-label={t("Tên đồng hồ", "Watch name")} />
      <button className="btn small" type="submit" disabled={pending}>{t("Tạo mã dài", "Create long key")}</button>
      <Msg s={state} />
      {state.key && (
        <code style={{ display: "block", width: "100%", padding: 10, borderRadius: 10, background: "var(--surface-2)",
          userSelect: "all", wordBreak: "break-all" }}>{state.key}</code>
      )}
    </form>
  );
}
