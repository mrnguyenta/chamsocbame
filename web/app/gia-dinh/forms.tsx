"use client";

import { useActionState, useState } from "react";
import { IconPlus, IconTelegram } from "@/components/icons";
import { CONDITIONS } from "@/lib/metrics";
import {
  type FormState, acceptInvite, addElder, addMember, createFamily, createInvite, createLinkCode, updateElder, updateMemberInfo,
} from "./actions";
import { useFormAction } from "@/components/useFormAction";

const INIT: FormState = { ok: false, message: "" };

function Msg({ s }: { s: FormState }) {
  if (!s.message) return null;
  return <div role="status" style={{ fontSize: 13, fontWeight: 600, color: s.ok ? "var(--ok-fg)" : "var(--danger-fg)" }}>{s.message}</div>;
}

function CopyButton({ text, label = "Chép" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn small" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* bỏ qua */ }
    }}>{done ? "Đã chép" : label}</button>
  );
}

export function CreateFamilyForm({ suggestedName }: { suggestedName: string }) {
  const [state, action, pending] = useActionState(createFamily, INIT);
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <label className="field">Tên gia đình<input type="text" name="family_name" placeholder={`Gia đình ${suggestedName}`} /></label>
      <label className="field">Tên bạn hiển thị với mọi người<input type="text" name="my_name" defaultValue={suggestedName} required /></label>
      <label className="field">Số điện thoại (để gọi khẩn khi cần, không bắt buộc)<input type="text" name="phone" inputMode="tel" placeholder="+84…" /></label>
      <button className="btn primary" type="submit" disabled={pending}>{pending ? "Đang tạo…" : "Tạo gia đình"}</button>
      <Msg s={state} />
    </form>
  );
}

export function AcceptInviteForm({ code, suggestedName }: { code: string; suggestedName: string }) {
  const [state, action, pending] = useActionState(acceptInvite, INIT);
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input type="hidden" name="code" value={code} />
      <label className="field">Tên bạn hiển thị với mọi người<input type="text" name="my_name" defaultValue={suggestedName} required /></label>
      <label className="field">Số điện thoại (không bắt buộc)<input type="text" name="phone" inputMode="tel" placeholder="+84…" /></label>
      <button className="btn primary" type="submit" disabled={pending}>{pending ? "Đang vào…" : "Vào gia đình"}</button>
      <Msg s={state} />
    </form>
  );
}

export function JoinByCodeForm() {
  const [code, setCode] = useState("");
  const clean = code.trim().split("/").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <label className="field">Dán link mời hoặc mã mời
        <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="https://…/moi/abcd2345ef" />
      </label>
      <a className="btn" href={clean.length === 10 ? `/moi/${clean}` : undefined} aria-disabled={clean.length !== 10}
        style={clean.length !== 10 ? { opacity: 0.55, pointerEvents: "none" } : undefined}>Mở lời mời</a>
    </div>
  );
}

export function InviteForm() {
  const [state, action, pending] = useActionState(createInvite, INIT);
  const link = state.value ? `${typeof window !== "undefined" ? window.location.origin : ""}/moi/${state.value}` : "";
  const shareText = `Mời bạn cùng theo dõi sức khoẻ người thân trên Chăm Sóc Người Thân: ${link}`;
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="row" style={{ gap: 8 }}>
        <label className="input-group">
          <span className="muted">Quyền</span>
          <select name="role" defaultValue="alerts" style={{ border: "none", background: "transparent", minHeight: 38, padding: 0, fontWeight: 600 }}>
            <option value="alerts">Nhận cảnh báo</option>
            <option value="reports">Chỉ nhận báo cáo</option>
            <option value="admin">Quản trị</option>
          </select>
        </label>
        <button className="btn primary small" type="submit" disabled={pending}><IconPlus size={16} /> Tạo link mời</button>
      </div>
      <Msg s={state} />
      {link && (
        <div className="rule" style={{ gap: 8 }}>
          <code style={{ wordBreak: "break-all", fontSize: 14 }}>{link}</code>
          <div className="row" style={{ gap: 8 }}>
            <CopyButton text={link} label="Chép link" />
            <a className="btn small" target="_blank" rel="noreferrer"
              href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("Mời bạn cùng theo dõi sức khoẻ ba mẹ")}`}>
              <IconTelegram size={16} /> Gửi qua Telegram
            </a>
            <button type="button" className="btn small"
              onClick={() => { if (navigator.share) navigator.share({ text: shareText, url: link }).catch(() => {}); }}>
              Chia sẻ (Zalo, Messenger…)
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

export function AddElderForm() {
  const [state, action, pending] = useActionState(addElder, INIT);
  return (
    <details className="more" open={false}>
      <summary className="btn primary small"><IconPlus size={16} /> Thêm ba mẹ / người thân</summary>
      <form action={action} className="rule" style={{ marginTop: 10 }}>
        <div className="row" style={{ gap: 10 }}>
          <label className="field" style={{ flex: "2 1 200px" }}>Cách gọi<input type="text" name="name" placeholder="Ba Hùng" required /></label>
          <label className="field" style={{ flex: "1 1 110px" }}>Năm sinh<input type="text" name="birth_year" inputMode="numeric" placeholder="1955" /></label>
          <label className="field" style={{ flex: "1 1 150px" }}>Lệnh xem nhanh (không bắt buộc)<input type="text" name="command" placeholder="ba" /></label>
        </div>
        <div className="muted" style={{ fontSize: 13 }}>Lệnh xem nhanh: gõ ví dụ <code>ba</code> thì trong nhóm Telegram chỉ cần nhắn <code>/ba</code> là bot trả lời tình hình sức khoẻ của người này.</div>
        <div className="muted">Bệnh nền (để tự tạo ngưỡng cảnh báo phù hợp)</div>
        <div className="row" style={{ gap: 8 }}>
          {Object.entries(CONDITIONS).map(([k, label]) => (
            <label key={k} className="check-chip">
              <input type="checkbox" name={`c_${k}`} />
              <span className="tick" aria-hidden>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="M5 12l5 5 9-10" /></svg>
              </span>
              {label}
            </label>
          ))}
        </div>
        <div className="row"><button className="btn primary small" type="submit" disabled={pending}>Thêm</button><Msg s={state} /></div>
      </form>
    </details>
  );
}

/** Mã 6 số nối nhóm Telegram gia đình (kind=group) hoặc Telegram của ba mẹ (kind=elder). */
export function LinkCodeForm({ kind, elderId, label, bot }: { kind: "group" | "elder" | "caregiver"; elderId?: string; label: string; bot?: string | null }) {
  const BOT = bot ?? null;
  const [state, action, pending] = useActionState(createLinkCode, INIT);
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
              ? <>Thêm bot{BOT ? <> <b>@{BOT}</b></> : ""} vào nhóm Telegram của gia đình, rồi gõ trong nhóm: <code>/ketnoi {code}</code></>
              : kind === "caregiver"
                ? <>Mở Telegram của bạn, tìm bot{BOT ? <> <b>@{BOT}</b></> : ""} và nhắn: <code>/start {code}</code></>
                : <>Ba/mẹ mở Telegram, tìm bot{BOT ? <> <b>@{BOT}</b></> : ""} và nhắn: <code>/toi {code}</code></>}
          </div>
          {deep && (
            <a className="btn primary small" href={deep} target="_blank" rel="noreferrer">
              <IconTelegram size={16} /> {kind === "group" ? "Mở Telegram, chọn nhóm" : kind === "caregiver" ? "Mở Telegram" : "Mở Telegram trên máy ba mẹ"}
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
  return (
    <details className="more">
      <summary className="btn primary small"><IconPlus size={16} /> Thêm anh chị em bằng email</summary>
      <form ref={f.ref} onSubmit={f.onSubmit} className="rule" style={{ marginTop: 10 }}>
        <div className="row" style={{ gap: 10 }}>
          <label className="field" style={{ flex: "1 1 160px" }}>Tên<input type="text" name="name" placeholder="Anh Nhất" required /></label>
          <label className="field" style={{ flex: "2 1 220px" }}>Email<input type="email" name="email" autoCapitalize="none" placeholder="nhat@gmail.com" required /></label>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <label className="field" style={{ flex: "1 1 160px" }}>Quyền
            <select name="role" defaultValue="alerts">
              <option value="alerts">Nhận cảnh báo</option>
              <option value="reports">Chỉ nhận báo cáo</option>
              <option value="admin">Quản trị</option>
            </select>
          </label>
          <label className="field" style={{ flex: "2 1 220px" }}>Mật khẩu ban đầu (nếu email chưa có tài khoản)
            <input type="password" name="password" autoComplete="new-password" placeholder="ít nhất 8 ký tự" />
          </label>
        </div>
        <div className="row"><button className="btn primary small" type="submit" disabled={f.pending}>Thêm</button></div>
        <Msg s={f.state} />
      </form>
    </details>
  );
}

function ConditionChips({ selected }: { selected: string[] }) {
  return (
    <div className="row" style={{ gap: 8 }}>
      {Object.entries(CONDITIONS).map(([k, label]) => (
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
  return (
    <details className="more" style={{ width: "100%" }}>
      <summary className="btn ghost small">Sửa thông tin</summary>
      <form ref={f.ref} onSubmit={f.onSubmit} className="rule" style={{ marginTop: 10 }}>
        <input type="hidden" name="elder_id" value={elder.id} />
        <div className="row" style={{ gap: 10 }}>
          <label className="field" style={{ flex: "2 1 200px" }}>Cách gọi<input type="text" name="name" defaultValue={elder.name} required /></label>
          <label className="field" style={{ flex: "1 1 110px" }}>Năm sinh
            <input type="text" name="birth_year" inputMode="numeric" defaultValue={elder.birthYear ?? ""} placeholder="1955" /></label>
          <label className="field" style={{ flex: "1 1 150px" }}>Lệnh xem nhanh (không bắt buộc)
            <input type="text" name="command" defaultValue={elder.command ?? ""} placeholder="ba" /></label>
        </div>
        <div className="muted" style={{ fontSize: 13 }}>Lệnh xem nhanh: gõ ví dụ <code>ba</code> thì trong nhóm Telegram chỉ cần nhắn <code>/ba</code> là bot trả lời tình hình sức khoẻ của người này.</div>
        <div className="muted">Bệnh nền (thêm bệnh mới sẽ tự thêm ngưỡng cảnh báo phù hợp)</div>
        <ConditionChips selected={elder.conditions} />
        <div className="row"><button className="btn primary small" type="submit" disabled={f.pending}>Lưu</button><Msg s={f.state} /></div>
      </form>
    </details>
  );
}

/** Sửa tên và số điện thoại của người chăm sóc. */
export function EditMemberForm({ member }: { member: { id: string; name: string; phone: string | null } }) {
  const f = useFormAction(updateMemberInfo, INIT);
  return (
    <details className="more" style={{ width: "100%" }}>
      <summary className="btn ghost small">Sửa thông tin</summary>
      <form ref={f.ref} onSubmit={f.onSubmit} className="rule" style={{ marginTop: 10 }}>
        <input type="hidden" name="caregiver_id" value={member.id} />
        <div className="row" style={{ gap: 10 }}>
          <label className="field" style={{ flex: "1 1 160px" }}>Tên<input type="text" name="name" defaultValue={member.name} required /></label>
          <label className="field" style={{ flex: "1 1 160px" }}>Số điện thoại (gọi khẩn)
            <input type="text" name="phone" inputMode="tel" defaultValue={member.phone ?? ""} placeholder="+84…" /></label>
        </div>
        <div className="row"><button className="btn primary small" type="submit" disabled={f.pending}>Lưu</button><Msg s={f.state} /></div>
      </form>
    </details>
  );
}
