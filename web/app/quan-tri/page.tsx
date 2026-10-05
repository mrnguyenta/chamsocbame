import type { Metadata } from "next";
import Link from "next/link";
import { IconTelegram } from "@/components/icons";
import { getBot } from "@/lib/bot";
import { isDemo } from "@/lib/db";
import BotForm from "./BotForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Quản trị · Chăm Sóc Ba Mẹ", robots: { index: false } };

/** Trang quản trị hệ thống: nhập token bot Telegram. Bảo vệ bằng mã quản trị (ADMIN_SETUP_KEY), vì lúc này chưa đăng nhập được. */
export default async function AdminPage() {
  const bot = await getBot();
  return (
    <main className="container" style={{ maxWidth: 560 }}>
      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="card-title">
          <span className="icon-tile tile-blue"><IconTelegram size={20} /></span>
          <div>
            <h1 style={{ fontSize: 22 }}>Bot Telegram</h1>
            <div className="muted">Dùng để đăng nhập website và gửi cảnh báo cho gia đình</div>
          </div>
        </div>
        {bot.token && bot.username ? (
          <div className="banner info">Đang dùng bot <b>@{bot.username}</b>. Nhập token mới bên dưới nếu muốn đổi bot.</div>
        ) : (
          <div className="banner danger">Chưa có bot. Dán token từ @BotFather vào ô bên dưới.</div>
        )}
        {isDemo ? <p className="muted">Website đang ở chế độ demo (chưa nối cơ sở dữ liệu).</p> : <BotForm />}
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Token được kiểm tra trực tiếp với Telegram và chỉ lưu trên máy chủ, không hiện lại ở đây.
          Nếu lộ token, gõ <code>/revoke</code> trong @BotFather rồi nhập token mới.
        </p>
        <Link className="btn small" href="/dang-nhap" style={{ alignSelf: "flex-start" }}>← Trang đăng nhập</Link>
      </section>
    </main>
  );
}
