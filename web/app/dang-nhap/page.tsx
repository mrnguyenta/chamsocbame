import { redirect } from "next/navigation";
import TelegramLogin from "@/components/TelegramLogin";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  invalid: "Không xác minh được đăng nhập Telegram. Thử lại nhé.",
  unknown: "Tài khoản Telegram này chưa có trong danh sách người chăm sóc của gia đình nào.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ loi?: string }> }) {
  if (await getSession()) redirect("/");
  const { loi } = await searchParams;
  const bot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  return (
    <main className="container" style={{ maxWidth: 480 }}>
      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h1 style={{ fontSize: 24 }}>Đăng nhập</h1>
        <p style={{ margin: 0 }}>Dùng tài khoản Telegram đã được thêm vào danh sách người chăm sóc của gia đình.</p>
        {loi && <div className="banner danger">{ERRORS[loi] ?? "Đăng nhập lỗi."}</div>}
        {bot ? (
          <TelegramLogin bot={bot} />
        ) : (
          <div className="muted">Chưa cấu hình NEXT_PUBLIC_TELEGRAM_BOT_USERNAME.</div>
        )}
      </section>
    </main>
  );
}
