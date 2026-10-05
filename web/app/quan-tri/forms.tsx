"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { IconTelegram } from "@/components/icons";
import { useT } from "@/components/LangProvider";
import { useFormAction } from "@/components/useFormAction";
import { type AdminState, claimSystemAdmin, resetPassword, saveAiKey, saveBot, saveGeneral } from "./actions";

const INIT: AdminState = { ok: false, message: "" };
const MONO: React.CSSProperties = { fontFamily: "ui-monospace, Menlo, monospace", minHeight: 48, fontSize: 16 };
const COL: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 12 };

function Msg({ s }: { s: AdminState }) {
  return s.message ? <div role="status" className={`banner ${s.ok ? "info" : "danger"}`}>{s.message}</div> : null;
}

export function ClaimForm() {
  const f = useFormAction(claimSystemAdmin, INIT);
  const t = useT();
  const router = useRouter();
  // Nhận quyền xong: tải lại trang để hiện bảng quản trị.
  useEffect(() => { if (f.state.ok) router.refresh(); }, [f.state, router]);
  return (
    <form ref={f.ref} onSubmit={f.onSubmit} style={COL}>
      <label className="field" htmlFor="setup_key">{t("Mã khởi tạo (Claude đã gửi)", "Setup key (sent by Claude)")}
        <input id="setup_key" name="setup_key" type="password" autoComplete="off" required style={MONO} />
      </label>
      <button className="btn primary" type="submit" disabled={f.pending} style={{ alignSelf: "flex-start" }}>
        {f.pending ? t("Đang kiểm tra…", "Checking…") : t("Nhận quyền quản trị hệ thống", "Become system administrator")}
      </button>
      <Msg s={f.state} />
    </form>
  );
}

export function BotForm({ hasBot }: { hasBot: boolean }) {
  const f = useFormAction(saveBot, INIT);
  const t = useT();
  return (
    <form ref={f.ref} onSubmit={f.onSubmit} style={COL}>
      <label className="field" htmlFor="token">{hasBot ? t("Token mới (chỉ nhập khi muốn đổi bot)", "New token (only if you want to change the bot)")
        : t("Token bot (BotFather gửi, dạng 123456789:AAH…)", "Bot token (from BotFather, like 123456789:AAH…)")}
        <input id="token" name="token" type="password" autoComplete="off" spellCheck={false} required style={MONO} />
      </label>
      <button className="btn primary" type="submit" disabled={f.pending} style={{ alignSelf: "flex-start" }}>
        <IconTelegram size={18} /> {f.pending ? t("Đang kiểm tra với Telegram…", "Checking with Telegram…") : t("Lưu và kết nối bot", "Save and connect bot")}
      </button>
      <Msg s={f.state} />
    </form>
  );
}

export function GeneralForm({ watchAppUrl, contactEmail }: { watchAppUrl: string; contactEmail: string }) {
  const f = useFormAction(saveGeneral, INIT);
  const t = useT();
  return (
    <form ref={f.ref} onSubmit={f.onSubmit} style={COL}>
      <label className="field" htmlFor="watch_app_url">{t("Link ứng dụng trên Connect IQ Store (để trống khi chưa được duyệt)", "App link on the Connect IQ Store (leave empty until approved)")}
        <input id="watch_app_url" name="watch_app_url" type="url" defaultValue={watchAppUrl} autoCapitalize="none"
          placeholder="https://apps.garmin.com/apps/…" />
      </label>
      <label className="field" htmlFor="contact_email">{t("Email liên hệ (hiện ở trang quyền riêng tư)", "Contact email (shown on the privacy page)")}
        <input id="contact_email" name="contact_email" type="email" defaultValue={contactEmail} autoCapitalize="none" />
      </label>
      <button className="btn primary small" type="submit" disabled={f.pending} style={{ alignSelf: "flex-start" }}>
        {f.pending ? t("Đang lưu…", "Saving…") : t("Lưu", "Save")}
      </button>
      <Msg s={f.state} />
    </form>
  );
}

export function AiKeyForm({ hasKey }: { hasKey: boolean }) {
  const f = useFormAction(saveAiKey, INIT);
  const t = useT();
  return (
    <form ref={f.ref} onSubmit={f.onSubmit} style={COL}>
      <label className="field" htmlFor="api_key">{hasKey ? t("Đổi khoá API", "Replace the API key") : t("Khoá API Claude", "Claude API key")}
        <input id="api_key" name="api_key" type="password" autoComplete="off" placeholder="sk-ant-…" style={MONO} />
      </label>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn primary small" type="submit" name="remove" value="0" disabled={f.pending}>
          {f.pending ? t("Đang lưu…", "Saving…") : t("Lưu khoá", "Save key")}
        </button>
        {hasKey && (
          <button className="btn ghost small" type="submit" name="remove" value="1" disabled={f.pending} formNoValidate
            style={{ color: "var(--coral-ink)" }}>{t("Tắt AI", "Turn AI off")}</button>
        )}
      </div>
      <Msg s={f.state} />
    </form>
  );
}

export function ResetPasswordForm({ accountId }: { accountId: string }) {
  const f = useFormAction(resetPassword, INIT);
  const t = useT();
  return (
    <form ref={f.ref} onSubmit={f.onSubmit} className="row" style={{ gap: 6, width: "100%" }}>
      <input type="hidden" name="account_id" value={accountId} />
      <input type="password" name="password" placeholder={t("Mật khẩu mới", "New password")} autoComplete="new-password" aria-label={t("Mật khẩu mới", "New password")}
        style={{ flex: "1 1 160px" }} />
      <button className="btn small" type="submit" disabled={f.pending}>{t("Đặt lại", "Reset")}</button>
      {f.state.message && <div style={{ width: "100%" }}><Msg s={f.state} /></div>}
    </form>
  );
}
