import type { Metadata } from "next";
import { IconBolt, IconGear, IconTelegram, IconUsers, IconWatch } from "@/components/icons";
import { requireIdentity } from "@/lib/auth";
import { getBot } from "@/lib/bot";
import { getSystemAdmins, getSystemStats } from "@/lib/data";
import { isDemo, sql } from "@/lib/db";
import { makeT, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { readSettings } from "@/lib/settings";
import { setSystemAdmin } from "./actions";
import { AiKeyForm, BotForm, ClaimForm, GeneralForm, ResetPasswordForm } from "./forms";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const t = makeT(await getLang());
  return { title: t("Quản trị hệ thống · Chăm Sóc Người Thân", "System administration · Family Care"), robots: { index: false } };
}

function Title({ icon, tile, title, sub }: { icon: React.ReactNode; tile: string; title: string; sub?: string }) {
  return (
    <div className="card-title">
      <span className={`icon-tile ${tile}`}>{icon}</span>
      <div><h2>{title}</h2>{sub && <div className="muted">{sub}</div>}</div>
    </div>
  );
}

const RELEASE = "https://github.com/mrnguyenta/chamsocbame/releases/download/watch-latest";
// Khớp danh sách <iq:product> trong watch/manifest.xml.
const DEVICES: [string, string][] = [
  ["fenix7", "Fenix 7"], ["fenix7s", "Fenix 7S"], ["fenix7x", "Fenix 7X"], ["fenix7pro", "Fenix 7 Pro"],
  ["fenix7spro", "Fenix 7S Pro"], ["fenix7xpro", "Fenix 7X Pro"], ["venu3", "Venu 3"], ["venu3s", "Venu 3S"],
  ["venu441mm", "Venu 4 (41 mm)"], ["venu445mm", "Venu 4 (45 mm)"], ["vivoactive5", "vívoactive 5"], ["vivoactive6", "vívoactive 6"],
];

/** Thời điểm build file .iq mới nhất trên GitHub Release (cache 10 phút; lỗi mạng thì bỏ qua). */
async function latestRelease(): Promise<{ builtAt: string } | null> {
  try {
    const r = await fetch("https://api.github.com/repos/mrnguyenta/chamsocbame/releases/tags/watch-latest", {
      next: { revalidate: 600 }, signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const j = await r.json() as { assets?: { name: string; updated_at: string }[] };
    const a = j.assets?.find((x) => x.name === "chamsoc-beta.iq");
    return a ? { builtAt: a.updated_at } : null;
  } catch {
    return null;
  }
}

const when = (iso: string | null, lang: Lang) =>
  iso ? new Date(iso).toLocaleString(lang === "en" ? "en-GB" : "vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : lang === "en" ? "never" : "chưa có";

/** Quản trị hệ thống: bot Telegram, link Store, tài khoản. Chỉ tài khoản is_system_admin. */
export default async function AdminPage() {
  const me = await requireIdentity("/quan-tri");
  const lang = await getLang();
  const t = makeT(lang);

  if (!me.isSystemAdmin) {
    const [r] = isDemo ? [{ any: true }] : await sql()`select exists(select 1 from accounts where is_system_admin) as any`;
    return (
      <main className="container" style={{ maxWidth: 560 }}>
        <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Title icon={<IconGear size={20} />} tile="tile-teal" title={t("Quản trị hệ thống", "System administration")} />
          {r.any ? <p className="muted" style={{ margin: 0 }}>{t("Tài khoản của bạn không có quyền quản trị hệ thống.", "Your account doesn't have system administrator access.")}</p> : (
            <>
              <p style={{ margin: 0 }}>{t("Hệ thống chưa có quản trị viên. Nhập mã khởi tạo để tài khoản", "The system has no administrator yet. Enter the setup key to make the account")}{" "}
                <b>{me.email}</b> {t("trở thành quản trị hệ thống.", "a system administrator.")}</p>
              <ClaimForm />
            </>
          )}
        </section>
      </main>
    );
  }

  const [bot, stats, settings, accounts, release] = await Promise.all([
    getBot(), getSystemStats(), readSettings(["watch_app_url", "contact_email", "anthropic_api_key"]), getSystemAdmins(), latestRelease(),
  ]);
  const tiles: [string, number | string][] = [
    [t("Gia đình", "Families"), stats.families], [t("Ba mẹ được theo dõi", "Parents monitored"), stats.elders],
    [t("Người chăm sóc", "Caregivers"), stats.caregivers],
    [t("Đồng hồ đã kết nối", "Watches connected"), stats.watches], [t("Cảnh báo đang mở", "Open alerts"), stats.openAlerts],
  ];

  return (
    <main className="container" style={{ maxWidth: 860 }}>
      <div>
        <h1 style={{ fontSize: 26 }}>{t("Quản trị hệ thống", "System administration")}</h1>
        <div className="muted" style={{ fontSize: 14 }}>
          {t("Đăng nhập", "Signed in")}: {me.email} · {t("Đồng hồ gửi dữ liệu lần cuối", "Last watch data")}: {when(stats.lastWatchAt, lang)}
        </div>
      </div>

      <section className="kpis tight" aria-label={t("Tổng quan", "Overview")}>
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
              sub={t("Gửi cảnh báo, báo cáo, nhắc thuốc cho gia đình", "Sends alerts, reports and medication reminders to families")} />
            {bot.token && bot.username
              ? <div className="banner info" style={{ marginBottom: 12 }}>{t("Đang dùng bot", "Using bot")} <b>@{bot.username}</b></div>
              : <div className="banner danger" style={{ marginBottom: 12 }}>{t("Chưa có bot. Tạo bot bằng @BotFather (/newbot) rồi dán token.", "No bot yet. Create one with @BotFather (/newbot), then paste the token.")}</div>}
            <BotForm hasBot={!!bot.token} />
          </section>

          <section className="card">
            <Title icon={<IconBolt size={20} />} tile="tile-amber" title={t("Trợ lý AI (Claude)", "AI assistant (Claude)")}
              sub={t("Hỏi đáp về sức khoẻ cả nhà (web và lệnh /hoi trong Telegram), nhận xét trong báo cáo tuần",
                "Q&A about the family's health (website and /hoi in Telegram), comments in the weekly report")} />
            {settings.anthropic_api_key
              ? <div className="banner info" style={{ marginBottom: 12 }}>{t("Đang bật · khoá", "On · key")} …{settings.anthropic_api_key.slice(-4)}</div>
              : <div className="banner warn" style={{ marginBottom: 12 }}>{t(
                  "Chưa bật. Tạo khoá ở console.anthropic.com → API Keys (cần nạp tiền ở Billing), rồi dán vào đây.",
                  "Off. Create a key at console.anthropic.com → API Keys (add credit under Billing), then paste it here.")}</div>}
            <AiKeyForm hasKey={!!settings.anthropic_api_key} />
            <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>{t(
              "Chi phí ước tính: vài nghìn đồng mỗi câu hỏi hoặc mỗi báo cáo tuần. Mỗi gia đình hỏi tối đa 60 câu/ngày.",
              "Estimated cost: a few cents per question or weekly report. Each family can ask up to 60 questions a day.")}</div>
          </section>

          <section className="card">
            <Title icon={<IconUsers size={20} />} tile="tile-violet" title={t("Tài khoản", "Accounts")} sub={t("Đặt lại mật khẩu khi ai đó quên", "Reset a password when someone forgets it")} />
            <ul className="list">
              {accounts.map((a) => (
                <li key={a.id} className="list-row" style={{ flexWrap: "wrap" }}>
                  <span className="grow">
                    <span className="title" style={{ display: "block" }}>{a.name}{a.isSystemAdmin ? ` · ${t("quản trị hệ thống", "system admin")}` : ""}</span>
                    <span className="muted">{a.email} · {a.families.join(", ") || t("chưa có gia đình", "no family yet")} · {t("đăng nhập", "last sign-in")} {when(a.lastLoginAt, lang)}</span>
                  </span>
                  {a.id !== me.accountId && (
                    <form action={setSystemAdmin}>
                      <input type="hidden" name="account_id" value={a.id} />
                      <input type="hidden" name="value" value={a.isSystemAdmin ? "0" : "1"} />
                      <button className="btn ghost small" type="submit">{a.isSystemAdmin ? t("Bỏ quyền quản trị", "Remove admin access") : t("Cấp quyền quản trị", "Grant admin access")}</button>
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
            <Title icon={<IconWatch size={20} />} tile="tile-teal" title={t("Ứng dụng đồng hồ", "Watch app")} />
            <GeneralForm watchAppUrl={settings.watch_app_url ?? ""} contactEmail={settings.contact_email ?? ""} />
          </section>

          <section className="card">
            <Title icon={<IconWatch size={20} />} tile="tile-violet" title={t("Tải file cài đặt", "Download install files")}
              sub={release ? `${t("Bản build lúc", "Built")} ${when(release.builtAt, lang)}` : t("Bản build mới nhất", "Latest build")} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <a className="btn primary" href={`${RELEASE}/chamsoc-beta.iq`}>{t("Tải bản Beta (chamsoc-beta.iq)", "Download Beta (chamsoc-beta.iq)")}</a>
              <div className="muted" style={{ fontSize: 13 }}>
                {t("Tải lên Garmin, đánh dấu “Beta App”. Sau đó trong trang Garmin bấm Download, chọn đồng hồ; app cài ở lần đồng bộ kế tiếp (chỉ đồng hồ trong tài khoản Garmin của bạn).",
                  "Upload to Garmin and tick “Beta App”. Then on the Garmin page click Download and choose the watch; the app installs on the next sync (only watches in your Garmin account).")}
              </div>
              <a className="btn" href={`${RELEASE}/chamsoc.iq`}>{t("Tải bản chính thức (chamsoc.iq)", "Download release (chamsoc.iq)")}</a>
              <div className="muted" style={{ fontSize: 13 }}>{t("Tải lên Garmin, không đánh dấu Beta, để Garmin duyệt cho mọi người cài.", "Upload to Garmin without ticking Beta, so Garmin can review it for everyone to install.")}</div>
              <a className="btn small" href="https://apps-developer.garmin.com" target="_blank" rel="noreferrer" style={{ alignSelf: "flex-start" }}>
                {t("Mở trang tải lên của Garmin ↗", "Open Garmin's upload page ↗")}
              </a>
              <details className="more">
                <summary className="muted" style={{ fontSize: 14 }}>{t("File chép qua cáp USB (.prg) cho từng đồng hồ", "Files to copy over USB cable (.prg) for each watch")}</summary>
                <ul style={{ margin: "8px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4, fontSize: 14 }}>
                  {DEVICES.map(([id, label]) => (
                    <li key={id}><a href={`${RELEASE}/chamsoc-${id}.prg`}>{label}</a></li>
                  ))}
                </ul>
              </details>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
