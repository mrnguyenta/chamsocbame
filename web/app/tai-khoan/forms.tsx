"use client";

import { useT } from "@/components/LangProvider";
import { useFormAction } from "@/components/useFormAction";
import { type AccountState, changeOwnPassword, renameAccount } from "./actions";

const INIT: AccountState = { ok: false, message: "" };
const COL: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 12 };

function Msg({ s }: { s: AccountState }) {
  return s.message ? <div role="status" className={`banner ${s.ok ? "info" : "danger"}`}>{s.message}</div> : null;
}

export function NameForm({ name }: { name: string }) {
  const f = useFormAction(renameAccount, INIT);
  const t = useT();
  return (
    <form ref={f.ref} onSubmit={f.onSubmit} style={COL}>
      <label className="field" htmlFor="name">{t("Tên hiển thị", "Display name")}<input id="name" name="name" type="text" defaultValue={name} required /></label>
      <button className="btn small" type="submit" disabled={f.pending} style={{ alignSelf: "flex-start" }}>{t("Lưu tên", "Save name")}</button>
      <Msg s={f.state} />
    </form>
  );
}

export function PasswordForm() {
  const f = useFormAction(changeOwnPassword, INIT);
  const t = useT();
  return (
    <form ref={f.ref} onSubmit={f.onSubmit} style={COL}>
      <label className="field" htmlFor="current">{t("Mật khẩu hiện tại", "Current password")}
        <input id="current" name="current" type="password" autoComplete="current-password" required /></label>
      <label className="field" htmlFor="password">{t("Mật khẩu mới (ít nhất 8 ký tự)", "New password (at least 8 characters)")}
        <input id="password" name="password" type="password" autoComplete="new-password" required /></label>
      <label className="field" htmlFor="password2">{t("Nhập lại mật khẩu mới", "Repeat new password")}
        <input id="password2" name="password2" type="password" autoComplete="new-password" required /></label>
      <button className="btn small" type="submit" disabled={f.pending} style={{ alignSelf: "flex-start" }}>{t("Đổi mật khẩu", "Change password")}</button>
      <Msg s={f.state} />
    </form>
  );
}
