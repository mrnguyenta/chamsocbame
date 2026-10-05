import type { Metadata } from "next";
import { IconGear, IconTelegram, IconUsers, IconWatch } from "@/components/icons";
import { requireIdentity } from "@/lib/auth";
import { getBot } from "@/lib/bot";
import { getSystemAdmins, getSystemStats } from "@/lib/data";
import { isDemo, sql } from "@/lib/db";
import { readSettings } from "@/lib/settings";
import { setSystemAdmin } from "./actions";
import { BotForm, ClaimForm, GeneralForm, ResetPasswordForm } from "./forms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Quản trị hệ thống · Chăm Sóc Ba Mẹ", robots: { index: false } };

function Title({ icon, tile, title, sub }: { icon: React.ReactNode; tile: string; title: string; sub?: string }) {
  return (
    <div className="card-title">
      <span className={`icon-tile ${tile}`}>{icon}</span>
      <div><h2>{title}</h2>{sub && <div className="muted">{sub}</div>}</div>
    </div>
  );
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "chưa có");

/** Quản trị hệ thống: bot Telegram, link Store, tài khoản. Chỉ tài khoản is_system_admin. */
export default async function AdminPage() {
  const me = await requireIdentity("/quan-tri");

  if (!me.isSystemAdmin) {
    const [r] = isDemo ? [{ any: true }] : await sql()`select exists(select 1 from accounts where is_system_admin) as any`;
    return (
      <main className="container" style={{ maxWidth: 560 }}>
        <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Title icon={<IconGear size={20} />} tile="tile-teal" title="Quản trị hệ thống" />
          {r.any ? <p className="muted" style={{ margin: 0 }}>Tài khoản của bạn không có quyền quản trị hệ thống.</p> : (
            <>
              <p style={{ margin: 0 }}>Hệ thống chưa có quản trị viên. Nhập mã khởi tạo để tài khoản <b>{me.email}</b> trở thành quản trị hệ thống.</p>
              <ClaimForm />
            </>
          )}
        </section>
      </main>
    );
  }

  const [bot, stats, settings, accounts] = await Promise.all([
    getBot(), getSystemStats(), readSettings(["watch_app_url", "contact_email"]), getSystemAdmins(),
  ]);
  const tiles: [string, number | string][] = [
    ["Gia đình", stats.families], ["Ba mẹ được theo dõi", stats.elders], ["Người chăm sóc", stats.caregivers],
    ["Đồng hồ đã kết nối", stats.watches], ["Cảnh báo đang mở", stats.openAlerts],
  ];

  return (
    <main className="container" style={{ maxWidth: 860 }}>
      <div>
        <h1 style={{ fontSize: 26 }}>Quản trị hệ thống</h1>
        <div className="muted" style={{ fontSize: 14 }}>Đăng nhập: {me.email} · Đồng hồ gửi dữ liệu lần cuối: {when(stats.lastWatchAt)}</div>
      </div>

      <section className="kpis tight" aria-label="Tổng quan">
        {tiles.map(([label, value]) => (
          <div key={label} className="card" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 13 }}>{label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{value}</div>
          </div>
        ))}
      </section>

      <div className="split">
        <div className="main-col">
          <section className="card">
            <Title icon={<IconTelegram size={20} />} tile="tile-blue" title="Bot Telegram"
              sub="Gửi cảnh báo, báo cáo, nhắc thuốc cho gia đình" />
            {bot.token && bot.username
              ? <div className="banner info" style={{ marginBottom: 12 }}>Đang dùng bot <b>@{bot.username}</b></div>
              : <div className="banner danger" style={{ marginBottom: 12 }}>Chưa có bot. Tạo bot bằng @BotFather (/newbot) rồi dán token.</div>}
            <BotForm hasBot={!!bot.token} />
          </section>

          <section className="card">
            <Title icon={<IconUsers size={20} />} tile="tile-violet" title="Tài khoản" sub="Đặt lại mật khẩu khi ai đó quên" />
            <ul className="list">
              {accounts.map((a) => (
                <li key={a.id} className="list-row" style={{ flexWrap: "wrap" }}>
                  <span className="grow">
                    <span className="title" style={{ display: "block" }}>{a.name}{a.isSystemAdmin ? " · quản trị hệ thống" : ""}</span>
                    <span className="muted">{a.email} · {a.families.join(", ") || "chưa có gia đình"} · đăng nhập {when(a.lastLoginAt)}</span>
                  </span>
                  {a.id !== me.accountId && (
                    <form action={setSystemAdmin}>
                      <input type="hidden" name="account_id" value={a.id} />
                      <input type="hidden" name="value" value={a.isSystemAdmin ? "0" : "1"} />
                      <button className="btn ghost small" type="submit">{a.isSystemAdmin ? "Bỏ quyền quản trị" : "Cấp quyền quản trị"}</button>
                    </form>
                  )}
                  <ResetPasswordForm accountId={a.id} />
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="side-col">
          <section className="card">
            <Title icon={<IconWatch size={20} />} tile="tile-teal" title="Ứng dụng đồng hồ" />
            <GeneralForm watchAppUrl={settings.watch_app_url ?? ""} contactEmail={settings.contact_email ?? ""} />
            <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
              File cài đặt mới nhất: <a href="https://github.com/mrnguyenta/chamsocbame/releases/tag/watch-latest" target="_blank" rel="noreferrer">GitHub Release</a>
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
