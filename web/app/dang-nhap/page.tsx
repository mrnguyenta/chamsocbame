import { redirect } from "next/navigation";
import Link from "next/link";
import { HeartArt, IconBell, IconUsers, IconWatch } from "@/components/icons";
import { getIdentity, getSession, safeNext as cleanNext } from "@/lib/auth";
import { LoginForm } from "./forms";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = cleanNext(next) ?? undefined;
  if (await getSession()) redirect(safeNext ?? "/");
  if (await getIdentity()) redirect(safeNext ?? "/bat-dau");
  const points = [
    { icon: <IconWatch size={20} />, tile: "tile-teal", text: "Xem nhịp tim, giấc ngủ, vận động của người thân từ đồng hồ Garmin" },
    { icon: <IconBell size={20} />, tile: "tile-coral", text: "Bot Telegram báo ngay cho cả nhà khi có chỉ số bất thường" },
    { icon: <IconUsers size={20} />, tile: "tile-violet", text: "Anh chị em cùng theo dõi, phân công ai gọi hỏi thăm" },
  ];
  return (
    <main className="container" style={{ maxWidth: 520 }}>
      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "center", textAlign: "center", padding: 28 }}>
        <HeartArt size={84} />
        <div>
          <h1 style={{ fontSize: 28 }}>Chăm sóc người thân<br />từ xa, yên tâm hơn</h1>
          <p className="muted" style={{ fontSize: 15, margin: "8px 0 0" }}>Đăng nhập bằng email. Miễn phí cho gia đình.</p>
        </div>
        <LoginForm next={safeNext} />
        <div style={{ fontSize: 14 }}>
          Chưa có tài khoản? <Link href={safeNext ? `/dang-ky?next=${encodeURIComponent(safeNext)}` : "/dang-ky"}><b>Đăng ký</b></Link>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>Quên mật khẩu: nhờ người quản trị đặt lại.</div>
        </div>
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
