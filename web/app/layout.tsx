import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { IconHeart } from "@/components/icons";
import { LangProvider, LangSwitch } from "@/components/LangProvider";
import { BottomNav, SideNav } from "@/components/Nav";
import { getIdentity, getSession } from "@/lib/auth";
import { isDemo } from "@/lib/db";
import { getLang } from "@/lib/i18n-server";
import { makeT } from "@/lib/i18n";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = makeT(await getLang());
  return {
    title: t("Chăm Sóc Người Thân", "Family Care"),
    description: t("Theo dõi sức khoẻ người thân từ đồng hồ Garmin, cảnh báo qua Telegram",
      "Follow your loved ones' health from their Garmin watch, with alerts on Telegram"),
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#dff3ef" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [session, identity, lang] = await Promise.all([getSession(), getIdentity(), getLang()]);
  const t = makeT(lang);
  return (
    <html lang={lang}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body>
        <LangProvider lang={lang}>
        <div className={session ? "shell" : undefined}>
        {session && <SideNav name={session.name} isSystemAdmin={identity?.isSystemAdmin ?? false} canSignOut={!isDemo} />}
        <div className="shell-main">
        {/* Máy tính: menu bên trái thay cho đầu trang; điện thoại: đầu trang gọn + menu dưới. */}
        <header className={session ? "topbar has-side" : "topbar"}>
          <div className="row" style={{ maxWidth: 1200, margin: "0 auto", padding: "10px 16px", gap: "10px 24px", flexWrap: "nowrap" }}>
            <Link href="/" className="row" style={{ gap: 10, textDecoration: "none", color: "var(--text)", flexWrap: "nowrap", minWidth: 0 }}>
              <span aria-hidden className="icon-tile" style={{ background: "var(--accent-strong)", color: "#fff", borderRadius: 12 }}>
                <IconHeart size={20} />
              </span>
              <strong style={{ fontSize: 17, whiteSpace: "nowrap", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{t("Chăm Sóc Người Thân", "Family Care")}</strong>
            </Link>
            <div style={{ flex: 1 }} />
            <LangSwitch />
            {identity && !isDemo && (
              // Điện thoại: tên và Đăng xuất nằm trong tab Tài khoản, đầu trang chỉ để logo.
              <form action="/api/auth/logout" method="post" className="row hide-sm" style={{ gap: 8, flexWrap: "nowrap" }}>
                {identity.isSystemAdmin && <Link className="btn ghost small" href="/quan-tri">{t("Quản trị", "Admin")}</Link>}
                <Link className="muted" href="/tai-khoan" title={t("Tài khoản", "Account")}
                  style={{ whiteSpace: "nowrap", textDecoration: "none", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {session?.name ?? identity.name}
                </Link>
                <button className="btn small" type="submit">{t("Đăng xuất", "Sign out")}</button>
              </form>
            )}
          </div>
        </header>
        {isDemo && (
          <div style={{ textAlign: "center", fontSize: 13, padding: "8px 16px", color: "var(--info-fg)", background: "var(--blue-soft)" }}>
            {t("Chế độ demo: đang hiển thị dữ liệu mẫu.", "Demo mode: showing sample data.")}
          </div>
        )}
        {identity?.isSample && (
          <form action="/api/auth/logout" method="post" className="row"
            style={{ justifyContent: "center", gap: "4px 12px", fontSize: 13, padding: "8px 16px", color: "var(--info-fg)", background: "var(--blue-soft)" }}>
            <span>{t("Bạn đang xem ", "You are viewing a ")}<b>{t("tài khoản mẫu", "demo account")}</b>
              {t(" (dữ liệu mẫu, tự xoá sau 24 giờ).", " (sample data, deleted after 24 hours).")}</span>
            <span className="row" style={{ gap: 8 }}>
              <button className="btn small" type="submit" name="to" value="/dang-ky">{t("Đăng ký thật", "Sign up")}</button>
              <button className="btn small ghost" type="submit">{t("Thoát", "Exit demo")}</button>
            </span>
          </form>
        )}
        {children}
        </div>
        </div>
        {session && <BottomNav />}
        </LangProvider>
      </body>
    </html>
  );
}
