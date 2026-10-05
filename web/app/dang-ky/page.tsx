import Link from "next/link";
import { redirect } from "next/navigation";
import { HeartArt } from "@/components/icons";
import { getIdentity, safeNext } from "@/lib/auth";
import { RegisterForm } from "../dang-nhap/forms";

export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next) ?? undefined;
  if (await getIdentity()) redirect(next ?? "/");
  return (
    <main className="container" style={{ maxWidth: 520 }}>
      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "center", textAlign: "center", padding: 28 }}>
        <HeartArt size={72} />
        <div>
          <h1 style={{ fontSize: 26 }}>Tạo tài khoản</h1>
          <p className="muted" style={{ fontSize: 15, margin: "8px 0 0" }}>Dùng email để đăng nhập. Cảnh báo sức khoẻ gửi qua bot Telegram.</p>
        </div>
        <RegisterForm next={next} />
        <div style={{ fontSize: 14 }}>
          Đã có tài khoản? <Link href={next ? `/dang-nhap?next=${encodeURIComponent(next)}` : "/dang-nhap"}><b>Đăng nhập</b></Link>
        </div>
      </section>
    </main>
  );
}
