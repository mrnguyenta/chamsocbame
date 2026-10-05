import Link from "next/link";
import { redirect } from "next/navigation";
import { HeartArt } from "@/components/icons";
import { LangSwitch } from "@/components/LangProvider";
import { getIdentity, safeNext } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { RegisterForm } from "../dang-nhap/forms";

export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next) ?? undefined;
  if (await getIdentity()) redirect(next ?? "/");
  const t = await getT();
  return (
    <main className="container" style={{ maxWidth: 520 }}>
      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "center", textAlign: "center", padding: 28 }}>
        <div style={{ alignSelf: "stretch", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, margin: "-12px -12px -8px 0" }}>
          <span className="muted" style={{ fontSize: 13 }}>Language / Ngôn ngữ</span>
          <LangSwitch className="btn small" />
        </div>
        <HeartArt size={72} />
        <div>
          <h1 style={{ fontSize: 26 }}>{t("Tạo tài khoản", "Create an account")}</h1>
          <p className="muted" style={{ fontSize: 15, margin: "8px 0 0" }}>{t("Dùng email để đăng nhập. Cảnh báo sức khoẻ gửi qua bot Telegram.", "You sign in with your email. Health alerts are sent via a Telegram bot.")}</p>
        </div>
        <RegisterForm next={next} />
        <div style={{ fontSize: 14 }}>
          {t("Đã có tài khoản?", "Already have an account?")} <Link href={next ? `/dang-nhap?next=${encodeURIComponent(next)}` : "/dang-nhap"}><b>{t("Đăng nhập", "Sign in")}</b></Link>
        </div>
      </section>
    </main>
  );
}
