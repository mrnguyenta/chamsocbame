"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { IconTelegram } from "@/components/icons";
import { useFormAction } from "@/components/useFormAction";
import { type AdminState, claimSystemAdmin, resetPassword, saveBot, saveGeneral } from "./actions";

const INIT: AdminState = { ok: false, message: "" };
const MONO: React.CSSProperties = { fontFamily: "ui-monospace, Menlo, monospace", minHeight: 48, fontSize: 16 };
const COL: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 12 };

function Msg({ s }: { s: AdminState }) {
  return s.message ? <div role="status" className={`banner ${s.ok ? "info" : "danger"}`}>{s.message}</div> : null;
}

export function ClaimForm() {
  const f = useFormAction(claimSystemAdmin, INIT);
  const router = useRouter();
  // Nhận quyền xong: tải lại trang để hiện bảng quản trị.
  useEffect(() => { if (f.state.ok) router.refresh(); }, [f.state, router]);
  return (
    <form ref={f.ref} onSubmit={f.onSubmit} style={COL}>
      <label className="field" htmlFor="setup_key">Mã khởi tạo (Claude đã gửi)
        <input id="setup_key" name="setup_key" type="password" autoComplete="off" required style={MONO} />
      </label>
      <button className="btn primary" type="submit" disabled={f.pending} style={{ alignSelf: "flex-start" }}>
        {f.pending ? "Đang kiểm tra…" : "Nhận quyền quản trị hệ thống"}
      </button>
      <Msg s={f.state} />
    </form>
  );
}

export function BotForm({ hasBot }: { hasBot: boolean }) {
  const f = useFormAction(saveBot, INIT);
  return (
    <form ref={f.ref} onSubmit={f.onSubmit} style={COL}>
      <label className="field" htmlFor="token">{hasBot ? "Token mới (chỉ nhập khi muốn đổi bot)" : "Token bot (BotFather gửi, dạng 123456789:AAH…)"}
        <input id="token" name="token" type="password" autoComplete="off" spellCheck={false} required style={MONO} />
      </label>
      <button className="btn primary" type="submit" disabled={f.pending} style={{ alignSelf: "flex-start" }}>
        <IconTelegram size={18} /> {f.pending ? "Đang kiểm tra với Telegram…" : "Lưu và kết nối bot"}
      </button>
      <Msg s={f.state} />
    </form>
  );
}

export function GeneralForm({ watchAppUrl, contactEmail }: { watchAppUrl: string; contactEmail: string }) {
  const f = useFormAction(saveGeneral, INIT);
  return (
    <form ref={f.ref} onSubmit={f.onSubmit} style={COL}>
      <label className="field" htmlFor="watch_app_url">Link ứng dụng trên Connect IQ Store (để trống khi chưa được duyệt)
        <input id="watch_app_url" name="watch_app_url" type="url" defaultValue={watchAppUrl} autoCapitalize="none"
          placeholder="https://apps.garmin.com/apps/…" />
      </label>
      <label className="field" htmlFor="contact_email">Email liên hệ (hiện ở trang quyền riêng tư)
        <input id="contact_email" name="contact_email" type="email" defaultValue={contactEmail} autoCapitalize="none" />
      </label>
      <button className="btn primary small" type="submit" disabled={f.pending} style={{ alignSelf: "flex-start" }}>
        {f.pending ? "Đang lưu…" : "Lưu"}
      </button>
      <Msg s={f.state} />
    </form>
  );
}

export function ResetPasswordForm({ accountId }: { accountId: string }) {
  const f = useFormAction(resetPassword, INIT);
  return (
    <form ref={f.ref} onSubmit={f.onSubmit} className="row" style={{ gap: 6, width: "100%" }}>
      <input type="hidden" name="account_id" value={accountId} />
      <input type="password" name="password" placeholder="Mật khẩu mới" autoComplete="new-password" aria-label="Mật khẩu mới"
        style={{ flex: "1 1 160px" }} />
      <button className="btn small" type="submit" disabled={f.pending}>Đặt lại</button>
      {f.state.message && <div style={{ width: "100%" }}><Msg s={f.state} /></div>}
    </form>
  );
}
