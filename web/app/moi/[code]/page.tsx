import Link from "next/link";
import { HeartArt } from "@/components/icons";
import { requireIdentity } from "@/lib/auth";
import { getInvite } from "@/lib/data";
import type { T } from "@/lib/i18n";
import { getT } from "@/lib/i18n-server";
import { AcceptInviteForm } from "../../gia-dinh/forms";

export const dynamic = "force-dynamic";

const role = (t: T): Record<string, string> => ({
  admin: t("quản trị", "admin"), alerts: t("nhận cảnh báo", "receive alerts"), reports: t("nhận báo cáo", "receive reports"),
});

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = code.toLowerCase().replace(/[^a-z0-9]/g, "");
  const id = await requireIdentity(`/moi/${clean}`);
  const inv = await getInvite(clean);
  const t = await getT();
  return (
    <main className="container" style={{ maxWidth: 520 }}>
      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ textAlign: "center" }}><HeartArt size={72} /></div>
        {inv ? (
          <>
            <div style={{ textAlign: "center" }}>
              <h1 style={{ fontSize: 24 }}>{t("Lời mời vào", "Invitation to")} {inv.familyName}</h1>
              <p className="muted" style={{ fontSize: 15, margin: "6px 0 0" }}>
                {inv.inviter ? t(`${inv.inviter} mời bạn`, `${inv.inviter} invites you`) : t("Bạn được mời", "You are invited")}{" "}
                {t("cùng theo dõi sức khoẻ ba mẹ, với quyền", "to help look after your parents' health, with the role:")} {role(t)[inv.role]}.
              </p>
            </div>
            <AcceptInviteForm code={clean} suggestedName={id.name} />
          </>
        ) : (
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: 22 }}>{t("Lời mời không còn hiệu lực", "This invitation is no longer valid")}</h1>
            <p className="muted">{t("Link đã hết hạn hoặc bị thu hồi. Xin người mời tạo link mới.", "The link has expired or been revoked. Ask the person who invited you for a new one.")}</p>
            <Link className="btn" href="/bat-dau">{t("Về trang bắt đầu", "Back to start")}</Link>
          </div>
        )}
      </section>
    </main>
  );
}
