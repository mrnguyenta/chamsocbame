import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { IconHeart } from "@/components/icons";
import { BottomNav, TopNav } from "@/components/Nav";
import { getIdentity, getSession } from "@/lib/auth";
import { isDemo } from "@/lib/db";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chăm Sóc Ba Mẹ",
  description: "Theo dõi sức khoẻ ba mẹ từ đồng hồ Garmin, cảnh báo qua Telegram",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#dff3ef" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [session, identity] = await Promise.all([getSession(), getIdentity()]);
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body>
        <header className="topbar">
          <div className="row" style={{ maxWidth: 1200, margin: "0 auto", padding: "10px 16px", gap: "10px 24px", flexWrap: "nowrap" }}>
            <Link href="/" className="row" style={{ gap: 10, textDecoration: "none", color: "var(--text)", flexWrap: "nowrap", minWidth: 0 }}>
              <span aria-hidden className="icon-tile" style={{ background: "var(--accent-strong)", color: "#fff", borderRadius: 12 }}>
                <IconHeart size={20} />
              </span>
              <strong style={{ fontSize: 17, whiteSpace: "nowrap", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>Chăm Sóc Ba Mẹ</strong>
            </Link>
            {session && <TopNav />}
            <div style={{ flex: 1 }} />
            {identity && !isDemo && (
              // Điện thoại: tên và Đăng xuất nằm trong tab Tài khoản, đầu trang chỉ để logo.
              <form action="/api/auth/logout" method="post" className="row hide-sm" style={{ gap: 8, flexWrap: "nowrap" }}>
                {identity.isSystemAdmin && <Link className="btn ghost small" href="/quan-tri">Quản trị</Link>}
                <Link className="muted" href="/tai-khoan" title="Tài khoản"
                  style={{ whiteSpace: "nowrap", textDecoration: "none", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {session?.name ?? identity.name}
                </Link>
                <button className="btn small" type="submit">Đăng xuất</button>
              </form>
            )}
          </div>
        </header>
        {isDemo && (
          <div style={{ textAlign: "center", fontSize: 13, padding: "8px 16px", color: "var(--info-fg)", background: "var(--blue-soft)" }}>
            Chế độ demo: đang hiển thị dữ liệu mẫu.
          </div>
        )}
        {children}
        {session && <BottomNav />}
      </body>
    </html>
  );
}
