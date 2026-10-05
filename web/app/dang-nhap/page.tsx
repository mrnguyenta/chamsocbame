import { redirect } from "next/navigation";
import { HeartArt, IconBell, IconTelegram, IconUsers, IconWatch } from "@/components/icons";
import TelegramLogin from "@/components/TelegramLogin";
import { getIdentity, getSession } from "@/lib/auth";
import { getBot } from "@/lib/bot";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  invalid: "Không xác minh được đăng nhập Telegram. Thử lại nhé.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ loi?: string; next?: string }> }) {
  const { loi, next } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
  if (await getSession()) redirect(safeNext ?? "/");
  if (await getIdentity()) redirect(safeNext ?? "/bat-dau");
  const bot = (await getBot()).username;
  const points = [
    { icon: <IconWatch size={20} />, tile: "tile-teal", text: "Xem nhịp tim, giấc ngủ, bước chân của ba mẹ từ đồng hồ Garmin" },
    { icon: <IconBell size={20} />, tile: "tile-coral", text: "Cảnh báo ngay vào nhóm Telegram khi có chỉ số bất thường" },
    { icon: <IconUsers size={20} />, tile: "tile-violet", text: "Anh chị em cùng theo dõi, phân công ai gọi hỏi thăm" },
  ];
  return (
    <main className="container" style={{ maxWidth: 520 }}>
      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "center", textAlign: "center", padding: 28 }}>
        <HeartArt size={84} />
        <div>
          <h1 style={{ fontSize: 28 }}>Chăm sóc ba mẹ<br />từ xa, yên tâm hơn</h1>
          <p className="muted" style={{ fontSize: 15, margin: "8px 0 0" }}>Đăng nhập bằng Telegram để bắt đầu. Miễn phí cho gia đình.</p>
        </div>
        {loi && <div className="banner danger" style={{ width: "100%" }}>{ERRORS[loi] ?? "Đăng nhập lỗi."}</div>}
        {bot ? <TelegramLogin bot={bot} next={safeNext} /> : (
          <div className="banner info" style={{ width: "100%" }}><IconTelegram size={18} /> Chưa cấu hình bot Telegram cho website.</div>
        )}
        <ul className="list" style={{ width: "100%", textAlign: "left" }}>
          {points.map((p) => (
            <li key={p.text} className="list-row" style={{ minHeight: 0 }}>
              <span className={`icon-tile ${p.tile}`}>{p.icon}</span>
              <span className="grow" style={{ fontSize: 14 }}>{p.text}</span>
            </li>
          ))}
        </ul>
        <div className="muted" style={{ fontSize: 13 }}>
          Không phải thiết bị y tế. <a href="/quyen-rieng-tu">Quyền riêng tư</a>
        </div>
      </section>
    </main>
  );
}
