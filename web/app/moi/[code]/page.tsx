import Link from "next/link";
import { HeartArt } from "@/components/icons";
import { requireIdentity } from "@/lib/auth";
import { getInvite } from "@/lib/data";
import { AcceptInviteForm } from "../../gia-dinh/forms";

export const dynamic = "force-dynamic";

const ROLE: Record<string, string> = { admin: "quản trị", alerts: "nhận cảnh báo", reports: "nhận báo cáo" };

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = code.toLowerCase().replace(/[^a-z0-9]/g, "");
  const id = await requireIdentity(`/moi/${clean}`);
  const inv = await getInvite(clean);
  return (
    <main className="container" style={{ maxWidth: 520 }}>
      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ textAlign: "center" }}><HeartArt size={72} /></div>
        {inv ? (
          <>
            <div style={{ textAlign: "center" }}>
              <h1 style={{ fontSize: 24 }}>Lời mời vào {inv.familyName}</h1>
              <p className="muted" style={{ fontSize: 15, margin: "6px 0 0" }}>
                {inv.inviter ? `${inv.inviter} mời bạn` : "Bạn được mời"} cùng theo dõi sức khoẻ ba mẹ, với quyền {ROLE[inv.role]}.
              </p>
            </div>
            <AcceptInviteForm code={clean} suggestedName={id.name} />
          </>
        ) : (
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: 22 }}>Lời mời không còn hiệu lực</h1>
            <p className="muted">Link đã hết hạn hoặc bị thu hồi. Xin người mời tạo link mới.</p>
            <Link className="btn" href="/bat-dau">Về trang bắt đầu</Link>
          </div>
        )}
      </section>
    </main>
  );
}
