import { redirect } from "next/navigation";
import Link from "next/link";
import { HeartArt, IconBell, IconUsers, IconWatch } from "@/components/icons";
import { LangSwitch } from "@/components/LangProvider";
import { getIdentity, getSession, safeNext as cleanNext } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { LoginForm, SampleButton } from "./forms";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = cleanNext(next) ?? undefined;
  if (await getSession()) redirect(safeNext ?? "/");
  if (await getIdentity()) redirect(safeNext ?? "/bat-dau");
  const t = await getT();
  const points = [
    { icon: <IconWatch size={20} />, tile: "tile-teal", text: t("Xem nhịp tim, giấc ngủ, vận động của người thân từ đồng hồ Garmin", "See your loved one's heart rate, sleep and activity from their Garmin watch") },
    { icon: <IconBell size={20} />, tile: "tile-coral", text: t("Bot Telegram báo ngay cho cả nhà khi có chỉ số bất thường", "A Telegram bot alerts the whole family right away when a reading is unusual") },
    { icon: <IconUsers size={20} />, tile: "tile-violet", text: t("Anh chị em cùng theo dõi, phân công ai gọi hỏi thăm", "Siblings keep watch together and decide who calls to check in") },
  ];
  return (
    <main className="container" style={{ maxWidth: 520 }}>
      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "center", textAlign: "center", padding: 28 }}>
        <div style={{ alignSelf: "stretch", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, margin: "-12px -12px -8px 0" }}>
          <span className="muted" style={{ fontSize: 13 }}>Language / Ngôn ngữ</span>
          <LangSwitch className="btn small" />
        </div>
        <HeartArt size={84} />
        <div>
          <h1 style={{ fontSize: 28 }}>{t("Chăm sóc người thân", "Care for loved ones")}<br />{t("từ xa, yên tâm hơn", "from afar, with peace of mind")}</h1>
          <p className="muted" style={{ fontSize: 15, margin: "8px 0 0" }}>{t("Đăng nhập bằng email. Miễn phí cho gia đình.", "Sign in with email. Free for families.")}</p>
        </div>
        <LoginForm next={safeNext} />
        <div style={{ fontSize: 14 }}>
          {t("Chưa có tài khoản?", "No account yet?")} <Link href={safeNext ? `/dang-ky?next=${encodeURIComponent(safeNext)}` : "/dang-ky"}><b>{t("Đăng ký", "Sign up")}</b></Link>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{t("Quên mật khẩu: nhờ người quản trị đặt lại.", "Forgot your password? Ask an administrator to reset it.")}</div>
        </div>
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid var(--border-strong)", paddingTop: 16 }}>
          <SampleButton next={safeNext} />
          <div className="muted" style={{ fontSize: 13 }}>
            {t("Không cần đăng ký: mở một gia đình mẫu có sẵn dữ liệu, chỉ mình bạn thấy, tự xoá sau 24 giờ. Có thể nhập mã trên đồng hồ vào đó để thử.",
              "No sign-up needed: opens a sample family with ready-made data, visible only to you and deleted automatically after 24 hours. You can enter the code shown on a watch there to try it out.")}
          </div>
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
          {t("Không phải thiết bị y tế.", "Not a medical device.")} <a href="/quyen-rieng-tu">{t("Quyền riêng tư", "Privacy")}</a>
        </div>
      </section>
    </main>
  );
}
