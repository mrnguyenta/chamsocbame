"use client";

import { useFormAction } from "@/components/useFormAction";
import { type AuthState, login, register } from "./actions";

const INIT: AuthState = { ok: false, message: "" };
const COL: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 12, width: "100%", textAlign: "left" };
const BIG: React.CSSProperties = { minHeight: 48, fontSize: 16 };

function Msg({ s }: { s: AuthState }) {
  return s.message ? <div role="status" className={`banner ${s.ok ? "info" : "danger"}`}>{s.message}</div> : null;
}

export function LoginForm({ next }: { next?: string }) {
  const f = useFormAction(login, INIT);
  return (
    <form ref={f.ref} onSubmit={f.onSubmit} style={COL}>
      {next && <input type="hidden" name="next" value={next} />}
      <label className="field" htmlFor="email">Email
        <input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" required style={BIG} />
      </label>
      <label className="field" htmlFor="password">Mật khẩu
        <input id="password" name="password" type="password" autoComplete="current-password" required style={BIG} />
      </label>
      <button className="btn primary" type="submit" disabled={f.pending} style={{ minHeight: 52, fontSize: 16 }}>
        {f.pending ? "Đang đăng nhập…" : "Đăng nhập"}
      </button>
      <Msg s={f.state} />
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const f = useFormAction(register, INIT);
  return (
    <form ref={f.ref} onSubmit={f.onSubmit} style={COL}>
      {next && <input type="hidden" name="next" value={next} />}
      <label className="field" htmlFor="name">Tên của bạn (hiện với gia đình)
        <input id="name" name="name" type="text" autoComplete="name" required placeholder="Nguyên" style={BIG} />
      </label>
      <label className="field" htmlFor="email">Email
        <input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" required style={BIG} />
      </label>
      <label className="field" htmlFor="password">Mật khẩu (ít nhất 8 ký tự)
        <input id="password" name="password" type="password" autoComplete="new-password" required style={BIG} />
      </label>
      <label className="field" htmlFor="password2">Nhập lại mật khẩu
        <input id="password2" name="password2" type="password" autoComplete="new-password" required style={BIG} />
      </label>
      <button className="btn primary" type="submit" disabled={f.pending} style={{ minHeight: 52, fontSize: 16 }}>
        {f.pending ? "Đang tạo…" : "Tạo tài khoản"}
      </button>
      <Msg s={f.state} />
    </form>
  );
}
