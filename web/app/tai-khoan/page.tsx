import Link from "next/link";
import { requireIdentity } from "@/lib/auth";
import { NameForm, PasswordForm } from "./forms";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const me = await requireIdentity("/tai-khoan");
  return (
    <main className="container" style={{ maxWidth: 560 }}>
      <div>
        <h1 style={{ fontSize: 26 }}>Tài khoản</h1>
        <div className="muted" style={{ fontSize: 14 }}>Đăng nhập bằng {me.email}</div>
      </div>
      <section className="card"><NameForm name={me.name} /></section>
      <section className="card"><h2 style={{ marginBottom: 12 }}>Đổi mật khẩu</h2><PasswordForm /></section>
      {me.isSystemAdmin && <Link className="btn" href="/quan-tri" style={{ alignSelf: "flex-start" }}>Quản trị hệ thống</Link>}
      <p className="muted" style={{ fontSize: 14, margin: 0 }}>
        Nhận cảnh báo qua Telegram: vào <Link href="/gia-dinh">Gia đình</Link> → “Nối Telegram của tôi”.
      </p>
    </main>
  );
}
