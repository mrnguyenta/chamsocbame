"use client";

import { useFormAction } from "@/components/useFormAction";
import { type AccountState, changeOwnPassword, renameAccount } from "./actions";

const INIT: AccountState = { ok: false, message: "" };
const COL: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 12 };

function Msg({ s }: { s: AccountState }) {
  return s.message ? <div role="status" className={`banner ${s.ok ? "info" : "danger"}`}>{s.message}</div> : null;
}

export function NameForm({ name }: { name: string }) {
  const f = useFormAction(renameAccount, INIT);
  return (
    <form ref={f.ref} onSubmit={f.onSubmit} style={COL}>
      <label className="field" htmlFor="name">Tên hiển thị<input id="name" name="name" type="text" defaultValue={name} required /></label>
      <button className="btn small" type="submit" disabled={f.pending} style={{ alignSelf: "flex-start" }}>Lưu tên</button>
      <Msg s={f.state} />
    </form>
  );
}

export function PasswordForm() {
  const f = useFormAction(changeOwnPassword, INIT);
  return (
    <form ref={f.ref} onSubmit={f.onSubmit} style={COL}>
      <label className="field" htmlFor="current">Mật khẩu hiện tại
        <input id="current" name="current" type="password" autoComplete="current-password" required /></label>
      <label className="field" htmlFor="password">Mật khẩu mới (ít nhất 8 ký tự)
        <input id="password" name="password" type="password" autoComplete="new-password" required /></label>
      <label className="field" htmlFor="password2">Nhập lại mật khẩu mới
        <input id="password2" name="password2" type="password" autoComplete="new-password" required /></label>
      <button className="btn small" type="submit" disabled={f.pending} style={{ alignSelf: "flex-start" }}>Đổi mật khẩu</button>
      <Msg s={f.state} />
    </form>
  );
}
