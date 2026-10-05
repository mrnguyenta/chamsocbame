import Link from "next/link";
import { HeartArt, IconPlus, IconUsers, IconWatch } from "@/components/icons";
import { getSession, requireIdentity } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { CreateFamilyForm, JoinByCodeForm } from "../gia-dinh/forms";

export const dynamic = "force-dynamic";

/** Người mới đăng nhập: tạo gia đình của mình, hoặc vào gia đình có sẵn bằng link mời. */
export default async function StartPage() {
  const id = await requireIdentity("/bat-dau");
  const hasFamily = !!(await getSession());
  const t = await getT();
  return (
    <main className="container" style={{ maxWidth: 880 }}>
      <div className="row" style={{ gap: 16, flexWrap: "nowrap" }}>
        <HeartArt size={64} />
        <div>
          <h1 style={{ fontSize: 26 }}>{t(`Chào ${id.name}!`, `Hi ${id.name}!`)}</h1>
          <div className="muted" style={{ fontSize: 15 }}>
            {hasFamily ? t("Tạo thêm một gia đình khác (ví dụ bên nội / bên ngoại), hoặc vào gia đình được mời.",
              "Create another family (e.g. your spouse's side), or join a family you were invited to.")
              : t("Bạn muốn theo dõi ba mẹ của mình, hay cùng theo dõi với anh chị em đã có sẵn trên đây?",
                "Do you want to look after your own parents, or join siblings who are already here?")}
          </div>
        </div>
      </div>
      {!hasFamily && (
        <section className="card row" style={{ gap: 14, flexWrap: "wrap" }}>
          <span className="icon-tile tile-teal"><IconWatch size={20} /></span>
          <div style={{ flex: "1 1 240px" }}>
            <h2>{t("Đã cài ứng dụng lên đồng hồ?", "Already installed the app on the watch?")}</h2>
            <div className="muted">{t("Kết nối luôn, gia đình sẽ được tạo tự động. Đặt tên và mời anh chị em sau.", "Connect it now; a family is created automatically. Name it and invite siblings later.")}</div>
          </div>
          <Link className="btn primary" href="/ket-noi-dong-ho">{t("Kết nối đồng hồ", "Connect watch")}</Link>
        </section>
      )}
      <div className="split">
        <section className="card" style={{ flex: "1 1 320px", minWidth: 0 }}>
          <div className="card-title">
            <span className="icon-tile tile-teal"><IconPlus size={20} /></span>
            <div><h2>{t("Tạo gia đình mới", "Create a new family")}</h2><div className="muted">{t("Bạn sẽ là người quản trị, rồi mời anh chị em vào sau", "You will be the admin and can invite siblings later")}</div></div>
          </div>
          <CreateFamilyForm suggestedName={id.name} />
        </section>
        <section className="card" style={{ flex: "1 1 320px", minWidth: 0 }}>
          <div className="card-title">
            <span className="icon-tile tile-violet"><IconUsers size={20} /></span>
            <div><h2>{t("Tôi có link mời", "I have an invite link")}</h2><div className="muted">{t("Anh chị em đã tạo gia đình và gửi link cho bạn", "A sibling created the family and sent you a link")}</div></div>
          </div>
          <JoinByCodeForm />
        </section>
      </div>
    </main>
  );
}
