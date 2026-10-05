"use client";

import { useActionState, useState, useTransition } from "react";
import { IconPlus, IconTelegram } from "@/components/icons";
import { useLang, useT } from "@/components/LangProvider";
import type { T } from "@/lib/i18n";
import { conditions } from "@/lib/metrics";
import {
  type FormState, acceptInvite, addElder, addMember, createFamily, createInvite, createLinkCode, updateElder, updateMember,
  updateMemberInfo,
} from "./actions";
import { useFormAction } from "@/components/useFormAction";

const INIT: FormState = { ok: false, message: "" };

const roleOptions = (t: T) => [
  { v: "admin", label: t("Quản trị", "Admin"),
    desc: t("Xem tất cả, được gọi khi có cảnh báo, và sửa được người thân, ngưỡng, thuốc, đồng hồ.",
      "Sees everything, is contacted on alerts, and can edit relatives, thresholds, medicines and watches.") },
  { v: "alerts", label: t("Nhận cảnh báo", "Gets alerts"),
    desc: t("Xem tất cả và được bot nhắn riêng (gọi điện nếu bật) khi cảnh báo chưa ai nhận.",
      "Sees everything and gets a personal message (or call, if enabled) when nobody has taken an alert.") },
  { v: "reports", label: t("Chỉ báo cáo", "Reports only"),
    desc: t("Chỉ xem trên web và tin trong nhóm Telegram; không bị nhắn riêng hay gọi.",
      "Only sees the website and the Telegram group; never messaged personally or called.") },
];

/** Chọn quyền dạng 3 ô bấm (thay cho danh sách thả xuống), kèm một dòng giải thích. */
function RolePicker({ name, value, onChange, disabled }: {
  name: string; value: string; onChange: (v: string) => void; disabled?: boolean;
}) {
  const t = useT();
  const opts = roleOptions(t);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
      <div className="seg" role="radiogroup" aria-label={t("Quyền", "Role")}>
        {opts.map((o) => (
          <label key={o.v}>
            <input type="radio" name={name} value={o.v} checked={value === o.v} disabled={disabled}
              onChange={() => onChange(o.v)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      <div className="muted" style={{ fontSize: 13, fontWeight: 400 }}>{opts.find((o) => o.v === value)?.desc}</div>
    </div>
  );
}

function Msg({ s }: { s: FormState }) {
  if (!s.message) return null;
  return <div role="status" style={{ fontSize: 13, fontWeight: 600, color: s.ok ? "var(--ok-fg)" : "var(--danger-fg)" }}>{s.message}</div>;
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const t = useT();
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn small" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* bỏ qua */ }
    }}>{done ? t("Đã chép", "Copied") : label ?? t("Chép", "Copy")}</button>
  );
}

export function CreateFamilyForm({ suggestedName }: { suggestedName: string }) {
  const [state, action, pending] = useActionState(createFamily, INIT);
  const t = useT();
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <label className="field">{t("Tên gia đình", "Family name")}<input type="text" name="family_name" placeholder={t(`Gia đình ${suggestedName}`, `${suggestedName}'s family`)} /></label>
      <label className="field">{t("Tên bạn hiển thị với mọi người", "Your name as others see it")}<input type="text" name="my_name" defaultValue={suggestedName} required /></label>
      <label className="field">{t("Số điện thoại (để gọi khẩn khi cần, không bắt buộc)", "Phone number (for emergency calls, optional)")}<input type="text" name="phone" inputMode="tel" placeholder="+84…" /></label>
      <button className="btn primary" type="submit" disabled={pending}>{pending ? t("Đang tạo…", "Creating…") : t("Tạo gia đình", "Create family")}</button>
      <Msg s={state} />
    </form>
  );
}

export function AcceptInviteForm({ code, suggestedName }: { code: string; suggestedName: string }) {
  const [state, action, pending] = useActionState(acceptInvite, INIT);
  const t = useT();
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input type="hidden" name="code" value={code} />
      <label className="field">{t("Tên bạn hiển thị với mọi người", "Your name as others see it")}<input type="text" name="my_name" defaultValue={suggestedName} required /></label>
      <label className="field">{t("Số điện thoại (không bắt buộc)", "Phone number (optional)")}<input type="text" name="phone" inputMode="tel" placeholder="+84…" /></label>
      <button className="btn primary" type="submit" disabled={pending}>{pending ? t("Đang vào…", "Joining…") : t("Vào gia đình", "Join family")}</button>
      <Msg s={state} />
    </form>
  );
}

export function JoinByCodeForm() {
  const [code, setCode] = useState("");
  const t = useT();
  const clean = code.trim().split("/").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <label className="field">{t("Dán link mời hoặc mã mời", "Paste the invite link or code")}
        <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="https://…/moi/abcd2345ef" />
      </label>
      <a className="btn" href={clean.length === 10 ? `/moi/${clean}` : undefined} aria-disabled={clean.length !== 10}
        style={clean.length !== 10 ? { opacity: 0.55, pointerEvents: "none" } : undefined}>{t("Mở lời mời", "Open invite")}</a>
    </div>
  );
}

export function InviteForm() {
  const [state, action, pending] = useActionState(createInvite, INIT);
  const [role, setRole] = useState("alerts");
  const t = useT();
  const link = state.value ? `${typeof window !== "undefined" ? window.location.origin : ""}/moi/${state.value}` : "";
  const shareText = t(`Mời bạn cùng theo dõi sức khoẻ người thân trên Chăm Sóc Người Thân: ${link}`,
    `Join me in looking after our family's health on Family Care: ${link}`);
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <RolePicker name="role" value={role} onChange={setRole} />
      <div className="row"><button className="btn primary small" type="submit" disabled={pending}><IconPlus size={16} /> {t("Tạo link mời", "Create invite link")}</button></div>
      <Msg s={state} />
      {link && (
        <div className="rule" style={{ gap: 8 }}>
          <code style={{ wordBreak: "break-all", fontSize: 14 }}>{link}</code>
          <div className="row" style={{ gap: 8 }}>
            <CopyButton text={link} label={t("Chép link", "Copy link")} />
            <a className="btn small" target="_blank" rel="noreferrer"
              href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(t("Mời bạn cùng theo dõi sức khoẻ ba mẹ", "Join me in looking after our parents' health"))}`}>
              <IconTelegram size={16} /> {t("Gửi qua Telegram", "Send via Telegram")}
            </a>
            <button type="button" className="btn small"
              onClick={() => { if (navigator.share) navigator.share({ text: shareText, url: link }).catch(() => {}); }}>
              {t("Chia sẻ (Zalo, Messenger…)", "Share (WhatsApp, Messenger…)")}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

export function AddElderForm() {
  const [state, action, pending] = useActionState(addElder, INIT);
  const lang = useLang();
  const t = useT();
  return (
    <details className="more" open={false}>
      <summary className="btn primary small"><IconPlus size={16} /> {t("Thêm ba mẹ / người thân", "Add a parent / family member")}</summary>
      <form action={action} className="rule" style={{ marginTop: 10 }}>
        <div className="row" style={{ gap: 10 }}>
          <label className="field" style={{ flex: "2 1 200px" }}>{t("Cách gọi", "What you call them")}<input type="text" name="name" placeholder={t("Ba Hùng", "Dad")} required /></label>
          <label className="field" style={{ flex: "1 1 110px" }}>{t("Năm sinh", "Birth year")}<input type="text" name="birth_year" inputMode="numeric" placeholder="1955" /></label>
          <label className="field" style={{ flex: "1 1 150px" }}>{t("Lệnh xem nhanh (không bắt buộc)", "Quick command (optional)")}<input type="text" name="command" placeholder={t("ba", "dad")} /></label>
        </div>
        <div className="muted" style={{ fontSize: 13 }}>{lang === "en"
          ? <>Quick command: type e.g. <code>dad</code> and in the Telegram group just send <code>/dad</code> to get this person&apos;s health status from the bot.</>
          : <>Lệnh xem nhanh: gõ ví dụ <code>ba</code> thì trong nhóm Telegram chỉ cần nhắn <code>/ba</code> là bot trả lời tình hình sức khoẻ của người này.</>}</div>
        <div className="muted">{t("Bệnh nền (để tự tạo ngưỡng cảnh báo phù hợp)", "Health conditions (to create suitable alert thresholds)")}</div>
        <div className="row" style={{ gap: 8 }}>
          {Object.entries(conditions(lang)).map(([k, label]) => (
            <label key={k} className="check-chip">
              <input type="checkbox" name={`c_${k}`} />
              <span className="tick" aria-hidden>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="M5 12l5 5 9-10" /></svg>
              </span>
              {label}
            </label>
          ))}
        </div>
        <div className="row"><button className="btn primary small" type="submit" disabled={pending}>{t("Thêm", "Add")}</button><Msg s={state} /></div>
      </form>
    </details>
  );
}

/** Mã 6 số nối nhóm Telegram gia đình (kind=group) hoặc Telegram của ba mẹ (kind=elder). */
export function LinkCodeForm({ kind, elderId, label, bot }: { kind: "group" | "elder" | "caregiver"; elderId?: string; label: string; bot?: string | null }) {
  const BOT = bot ?? null;
  const [state, action, pending] = useActionState(createLinkCode, INIT);
  const t = useT();
  const en = useLang() === "en";
  const code = state.value;
  const deep = code && BOT ? (kind === "group" ? `https://t.me/${BOT}?startgroup=${code}` : `https://t.me/${BOT}?start=${code}`) : null;
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input type="hidden" name="kind" value={kind} />
      {elderId && <input type="hidden" name="elder_id" value={elderId} />}
      {!code && <button className="btn small" type="submit" disabled={pending}><IconTelegram size={16} /> {label}</button>}
      <Msg s={state} />
      {code && (
        <div className="rule" style={{ gap: 8 }}>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 6, color: "var(--accent-ink)" }}>{code.slice(0, 3)} {code.slice(3)}</div>
          <div className="muted" style={{ fontSize: 14 }}>
            {kind === "group"
              ? (en
                ? <>Add the bot{BOT ? <> <b>@{BOT}</b></> : ""} to your family Telegram group, then type in the group: <code>/ketnoi {code}</code></>
                : <>Thêm bot{BOT ? <> <b>@{BOT}</b></> : ""} vào nhóm Telegram của gia đình, rồi gõ trong nhóm: <code>/ketnoi {code}</code></>)
              : kind === "caregiver"
                ? (en
                  ? <>Open your Telegram, find the bot{BOT ? <> <b>@{BOT}</b></> : ""} and send: <code>/start {code}</code></>
                  : <>Mở Telegram của bạn, tìm bot{BOT ? <> <b>@{BOT}</b></> : ""} và nhắn: <code>/start {code}</code></>)
                : (en
                  ? <>Your parent opens Telegram, finds the bot{BOT ? <> <b>@{BOT}</b></> : ""} and sends: <code>/toi {code}</code></>
                  : <>Ba/mẹ mở Telegram, tìm bot{BOT ? <> <b>@{BOT}</b></> : ""} và nhắn: <code>/toi {code}</code></>)}
          </div>
          {deep && (
            <a className="btn primary small" href={deep} target="_blank" rel="noreferrer">
              <IconTelegram size={16} /> {kind === "group" ? t("Mở Telegram, chọn nhóm", "Open Telegram, pick the group") : kind === "caregiver" ? t("Mở Telegram", "Open Telegram")
                : t("Mở Telegram trên máy ba mẹ", "Open Telegram on the parent's phone")}
            </a>
          )}
        </div>
      )}
    </form>
  );
}

/** Quản trị thêm anh chị em bằng email (tạo tài khoản nếu email chưa có). */
export function AddMemberForm() {
  const f = useFormAction(addMember, INIT);
  const [role, setRole] = useState("alerts");
  const t = useT();
  return (
    <details className="more">
      <summary className="btn primary small"><IconPlus size={16} /> {t("Thêm anh chị em bằng email", "Add a sibling by email")}</summary>
      <form ref={f.ref} onSubmit={f.onSubmit} className="rule" style={{ marginTop: 10 }}>
        <div className="row" style={{ gap: 10 }}>
          <label className="field" style={{ flex: "1 1 160px" }}>{t("Tên", "Name")}<input type="text" name="name" placeholder={t("Anh Nhất", "John")} required /></label>
          <label className="field" style={{ flex: "2 1 220px" }}>Email<input type="email" name="email" autoCapitalize="none" placeholder={t("nhat@gmail.com", "john@gmail.com")} required /></label>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <label className="field" style={{ flex: "2 1 220px" }}>{t("Mật khẩu ban đầu (nếu email chưa có tài khoản)", "Initial password (if the email has no account)")}
            <input type="password" name="password" autoComplete="new-password" placeholder={t("ít nhất 8 ký tự", "at least 8 characters")} />
          </label>
        </div>
        <div className="field">{t("Quyền", "Role")}<RolePicker name="role" value={role} onChange={setRole} /></div>
        <div className="row"><button className="btn primary small" type="submit" disabled={f.pending}>{t("Thêm", "Add")}</button></div>
        <Msg s={f.state} />
      </form>
    </details>
  );
}

function ConditionChips({ selected }: { selected: string[] }) {
  const lang = useLang();
  return (
    <div className="row" style={{ gap: 8 }}>
      {Object.entries(conditions(lang)).map(([k, label]) => (
        <label key={k} className="check-chip">
          <input type="checkbox" name={`c_${k}`} defaultChecked={selected.includes(k)} />
          <span className="tick" aria-hidden>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="M5 12l5 5 9-10" /></svg>
          </span>
          {label}
        </label>
      ))}
    </div>
  );
}

/** Sửa thông tin ba mẹ / người thân sau khi đã tạo. */
export function EditElderForm({ elder }: {
  elder: { id: string; name: string; birthYear: number | null; conditions: string[]; command: string | null };
}) {
  const f = useFormAction(updateElder, INIT);
  const lang = useLang();
  const t = useT();
  return (
    <details className="more" style={{ width: "100%" }}>
      <summary className="btn ghost small">{t("Sửa thông tin", "Edit details")}</summary>
      <form ref={f.ref} onSubmit={f.onSubmit} className="rule" style={{ marginTop: 10 }}>
        <input type="hidden" name="elder_id" value={elder.id} />
        <div className="row" style={{ gap: 10 }}>
          <label className="field" style={{ flex: "2 1 200px" }}>{t("Cách gọi", "What you call them")}<input type="text" name="name" defaultValue={elder.name} required /></label>
          <label className="field" style={{ flex: "1 1 110px" }}>{t("Năm sinh", "Birth year")}
            <input type="text" name="birth_year" inputMode="numeric" defaultValue={elder.birthYear ?? ""} placeholder="1955" /></label>
          <label className="field" style={{ flex: "1 1 150px" }}>{t("Lệnh xem nhanh (không bắt buộc)", "Quick command (optional)")}
            <input type="text" name="command" defaultValue={elder.command ?? ""} placeholder={t("ba", "dad")} /></label>
        </div>
        <div className="muted" style={{ fontSize: 13 }}>{lang === "en"
          ? <>Quick command: type e.g. <code>dad</code> and in the Telegram group just send <code>/dad</code> to get this person&apos;s health status from the bot.</>
          : <>Lệnh xem nhanh: gõ ví dụ <code>ba</code> thì trong nhóm Telegram chỉ cần nhắn <code>/ba</code> là bot trả lời tình hình sức khoẻ của người này.</>}</div>
        <div className="muted">{t("Bệnh nền (thêm bệnh mới sẽ tự thêm ngưỡng cảnh báo phù hợp)", "Health conditions (adding one also adds suitable alert thresholds)")}</div>
        <ConditionChips selected={elder.conditions} />
        <div className="row"><button className="btn primary small" type="submit" disabled={f.pending}>{t("Lưu", "Save")}</button><Msg s={f.state} /></div>
      </form>
    </details>
  );
}

/** Sửa tên và số điện thoại của người chăm sóc. */
export function EditMemberForm({ member, manage }: {
  member: { id: string; name: string; phone: string | null; role: string };
  /** Quản trị sửa người khác: thêm đổi quyền và xoá khỏi gia đình. */
  manage?: boolean;
}) {
  const f = useFormAction(updateMemberInfo, INIT);
  const t = useT();
  return (
    <details className="more" style={{ width: "100%" }}>
      <summary className="btn ghost small">{t("Sửa thông tin", "Edit details")}</summary>
      <form ref={f.ref} onSubmit={f.onSubmit} className="rule" style={{ marginTop: 10 }}>
        <input type="hidden" name="caregiver_id" value={member.id} />
        <div className="row" style={{ gap: 10 }}>
          <label className="field" style={{ flex: "1 1 160px" }}>{t("Tên", "Name")}<input type="text" name="name" defaultValue={member.name} required /></label>
          <label className="field" style={{ flex: "1 1 160px" }}>{t("Số điện thoại (gọi khẩn)", "Phone (emergency calls)")}
            <input type="text" name="phone" inputMode="tel" defaultValue={member.phone ?? ""} placeholder="+84…" /></label>
        </div>
        <div className="row"><button className="btn primary small" type="submit" disabled={f.pending}>{t("Lưu", "Save")}</button><Msg s={f.state} /></div>
      </form>
      {manage && <MemberRole member={member} />}
    </details>
  );
}

/** Đổi quyền (lưu ngay khi bấm) và xoá khỏi gia đình (có hỏi lại). */
function MemberRole({ member }: { member: { id: string; name: string; role: string } }) {
  const t = useT();
  const [role, setRole] = useState(member.role);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const send = (action: string) => start(async () => {
    const fd = new FormData();
    fd.set("caregiver_id", member.id);
    fd.set("action", action);
    await updateMember(fd);
    setSaved(action !== "remove");
  });
  return (
    <div className="rule" style={{ marginTop: 10, gap: 10 }}>
      <div className="field">
        <span>{t("Quyền", "Role")}{pending ? <span className="muted">{t(" · đang lưu…", " · saving…")}</span>
          : saved ? <span style={{ color: "var(--accent-ink)" }}>{t(" · đã lưu ✓", " · saved ✓")}</span> : null}</span>
        <RolePicker name={`role-${member.id}`} value={role} disabled={pending}
          onChange={(v) => { setRole(v); setSaved(false); send(v); }} />
      </div>
      <div className="row">
        <button type="button" className="btn ghost small" disabled={pending} style={{ color: "var(--coral-ink)" }}
          onClick={() => { if (confirm(t(`Xoá ${member.name} khỏi gia đình? Người này sẽ không xem được nữa.`,
            `Remove ${member.name} from the family? They will no longer be able to see anything.`))) send("remove"); }}>
          {t("Xoá khỏi gia đình", "Remove from family")}
        </button>
      </div>
    </div>
  );
}
