import Link from "next/link";
import { HeartArt, IconPlus, IconUsers, IconWatch } from "@/components/icons";
import { getSession, requireIdentity } from "@/lib/auth";
import { CreateFamilyForm, JoinByCodeForm } from "../gia-dinh/forms";

export const dynamic = "force-dynamic";

/** Người mới đăng nhập: tạo gia đình của mình, hoặc vào gia đình có sẵn bằng link mời. */
export default async function StartPage() {
  const id = await requireIdentity("/bat-dau");
  const hasFamily = !!(await getSession());
  return (
    <main className="container" style={{ maxWidth: 880 }}>
      <div className="row" style={{ gap: 16, flexWrap: "nowrap" }}>
        <HeartArt size={64} />
        <div>
          <h1 style={{ fontSize: 26 }}>Chào {id.name}!</h1>
          <div className="muted" style={{ fontSize: 15 }}>
            {hasFamily ? "Tạo thêm một gia đình khác (ví dụ bên nội / bên ngoại), hoặc vào gia đình được mời."
              : "Bạn muốn theo dõi ba mẹ của mình, hay cùng theo dõi với anh chị em đã có sẵn trên đây?"}
          </div>
        </div>
      </div>
      {!hasFamily && (
        <section className="card row" style={{ gap: 14, flexWrap: "wrap" }}>
          <span className="icon-tile tile-teal"><IconWatch size={20} /></span>
          <div style={{ flex: "1 1 240px" }}>
            <h2>Đã cài ứng dụng lên đồng hồ?</h2>
            <div className="muted">Kết nối luôn, gia đình sẽ được tạo tự động. Đặt tên và mời anh chị em sau.</div>
          </div>
          <Link className="btn primary" href="/ket-noi-dong-ho">Kết nối đồng hồ</Link>
        </section>
      )}
      <div className="split">
        <section className="card" style={{ flex: "1 1 320px", minWidth: 0 }}>
          <div className="card-title">
            <span className="icon-tile tile-teal"><IconPlus size={20} /></span>
            <div><h2>Tạo gia đình mới</h2><div className="muted">Bạn sẽ là người quản trị, rồi mời anh chị em vào sau</div></div>
          </div>
          <CreateFamilyForm suggestedName={id.name} />
        </section>
        <section className="card" style={{ flex: "1 1 320px", minWidth: 0 }}>
          <div className="card-title">
            <span className="icon-tile tile-violet"><IconUsers size={20} /></span>
            <div><h2>Tôi có link mời</h2><div className="muted">Anh chị em đã tạo gia đình và gửi link cho bạn</div></div>
          </div>
          <JoinByCodeForm />
        </section>
      </div>
    </main>
  );
}
