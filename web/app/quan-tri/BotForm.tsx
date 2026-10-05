"use client";

import { useActionState, useState } from "react";
import { IconTelegram } from "@/components/icons";
import { type AdminState, saveBot } from "./actions";

const INIT: AdminState = { ok: false, message: "" };
const INPUT: React.CSSProperties = {
  minHeight: 48, fontSize: 16, fontFamily: "ui-monospace, Menlo, monospace", borderRadius: 12,
  border: "1px solid var(--border-strong)", padding: "0 14px", background: "var(--surface-solid)",
};

export default function BotForm() {
  const [state, action, pending] = useActionState(saveBot, INIT);
  // Giữ chữ đã gõ sau mỗi lần gửi (React tự xoá ô nhập không điều khiển sau server action).
  const [key, setKey] = useState("");
  const [token, setToken] = useState("");
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <label className="field">Mã quản trị
        <input id="setup_key" name="setup_key" type="password" autoComplete="off" required style={INPUT}
          value={key} onChange={(e) => setKey(e.target.value)} />
      </label>
      <label className="field">Token bot (BotFather gửi, dạng 123456789:AAH…)
        <input id="token" name="token" type="password" autoComplete="off" spellCheck={false} required style={INPUT}
          value={token} onChange={(e) => setToken(e.target.value)} />
      </label>
      <button className="btn primary" type="submit" disabled={pending} style={{ minHeight: 52, fontSize: 16 }}>
        <IconTelegram size={18} /> {pending ? "Đang kiểm tra với Telegram…" : "Lưu và kết nối bot"}
      </button>
      {state.message && <div role="status" className={`banner ${state.ok ? "info" : "danger"}`}>{state.message}</div>}
      {state.ok && (
        <div className="rule" style={{ gap: 8 }}>
          <b>Việc cuối, làm trong Telegram</b>
          <div className="muted" style={{ fontSize: 14 }}>
            Mở @BotFather, gõ <code>/setdomain</code>, chọn <b>@{state.username}</b>, rồi gửi <code>chamsocbame.vercel.app</code>.
            Thiếu bước này, nút “Đăng nhập bằng Telegram” trên website sẽ báo lỗi domain.
          </div>
          <a className="btn small" href="https://t.me/BotFather" target="_blank" rel="noreferrer"><IconTelegram size={16} /> Mở BotFather</a>
        </div>
      )}
    </form>
  );
}
