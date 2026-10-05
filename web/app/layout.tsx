import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { isDemo } from "@/lib/db";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chăm Sóc Ba Mẹ",
  description: "Theo dõi sức khoẻ ba mẹ từ đồng hồ Garmin, cảnh báo qua Telegram",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        <header style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
          <div className="row" style={{ maxWidth: 1200, margin: "0 auto", padding: "12px 16px", gap: "10px 28px" }}>
            <Link href="/" className="row" style={{ gap: 10, textDecoration: "none", color: "var(--text)" }}>
              <span aria-hidden style={{ width: 34, height: 34, borderRadius: 10, background: "var(--accent)",
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" />
                </svg>
              </span>
              <strong style={{ fontSize: 18 }}>Chăm Sóc Ba Mẹ</strong>
            </Link>
            {session && (
              <nav className="row" style={{ gap: 4, flex: "1 1 260px" }}>
                <Link className="btn small" href="/" style={{ border: "none" }}>Tổng quan</Link>
                <Link className="btn small" href="/cai-dat" style={{ border: "none" }}>Cài đặt</Link>
              </nav>
            )}
            {session && !isDemo && (
              <form action="/api/auth/logout" method="post" className="row" style={{ gap: 8 }}>
                <span className="muted">{session.name}</span>
                <button className="btn small" type="submit">Đăng xuất</button>
              </form>
            )}
          </div>
        </header>
        {isDemo && (
          <div className="banner info" style={{ borderRadius: 0, justifyContent: "center", fontSize: 14 }}>
            Chế độ demo: đang hiển thị dữ liệu mẫu. Cấu hình DATABASE_URL để dùng dữ liệu thật.
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
