import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { HeartArt } from "@/components/icons";
import ShareLink from "@/components/ShareLink";
import { getIdentity } from "@/lib/auth";
import { getPairingState } from "@/lib/data";
import { getT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

/**
 * Trang đồng hồ mở trên điện thoại (thông báo "Chăm Sóc Người Thân" từ Garmin Connect).
 * - Con cháu đang đăng nhập: vào thẳng trang kết nối, mã đã điền sẵn.
 * - Điện thoại của ba mẹ: gửi link này cho con cháu, con cháu bấm là kết nối được.
 */
export default async function WatchLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^\d{6}$/.test(code)) notFound();
  const target = `/ket-noi-dong-ho?ma=${code}`;
  const state = await getPairingState(code);
  if (state === "pending" && (await getIdentity())) redirect(target);
  const pretty = `${code.slice(0, 3)} ${code.slice(3)}`;
  const t = await getT();

  return (
    <main className="container" style={{ maxWidth: 520 }}>
      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "center", textAlign: "center", padding: 28 }}>
        <HeartArt size={72} />
        {state === "pending" ? (
          <>
            <div>
              <h1 style={{ fontSize: 24 }}>{t("Đồng hồ đang chờ kết nối", "Watch waiting to connect")}</h1>
              <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: 6, color: "var(--accent-ink)", marginTop: 8 }}>{pretty}</div>
              <p className="muted" style={{ fontSize: 14, margin: "6px 0 0" }}>{t("Mã dùng được trong 15 phút.", "The code is valid for 15 minutes.")}</p>
            </div>
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
              <h2 style={{ fontSize: 17 }}>{t("Đây là điện thoại của ba mẹ?", "Is this your parent's phone?")}</h2>
              <p className="muted" style={{ fontSize: 14, margin: 0 }}>{t("Gửi link này cho con cháu. Con cháu bấm vào là kết nối xong, ba mẹ không phải làm gì thêm.",
                "Send this link to your children. They tap it to finish connecting; nothing more to do here.")}</p>
              <ShareLink text={t(`Đồng hồ của ba/mẹ đang chờ kết nối Chăm Sóc Người Thân (mã ${pretty}). Con bấm vào đây để kết nối:`,
                `My watch is waiting to connect to Chăm Sóc Người Thân (code ${pretty}). Tap here to connect it:`)} />
            </div>
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
              <h2 style={{ fontSize: 17 }}>{t("Bạn là con cháu?", "Are you a son or daughter?")}</h2>
              <p className="muted" style={{ fontSize: 14, margin: 0 }}>{t("Đăng nhập bằng email (chưa có thì đăng ký), rồi chọn người đeo đồng hồ.", "Sign in with email (or sign up), then choose who wears the watch.")}</p>
              <Link className="btn primary" href={`/dang-nhap?next=${encodeURIComponent(target)}`}>{t("Đăng nhập để kết nối", "Sign in to connect")}</Link>
            </div>
          </>
        ) : state === "claimed" ? (
          <div>
            <h1 style={{ fontSize: 22 }}>{t("Đồng hồ đã được kết nối", "Watch already connected")}</h1>
            <p className="muted">{t("Đồng hồ sẽ tự gửi dữ liệu mỗi 5 phút. Không cần làm gì thêm.", "The watch sends data every 5 minutes on its own. Nothing more to do.")}</p>
            <Link className="btn" href="/">{t("Xem sức khoẻ", "View health")}</Link>
          </div>
        ) : (
          <div>
            <h1 style={{ fontSize: 22 }}>{t("Mã đã hết hạn", "Code expired")}</h1>
            <p className="muted">{t("Mở lại ứng dụng “Chăm Sóc Người Thân” trên đồng hồ để lấy mã mới, điện thoại sẽ nhận thông báo mới.",
              "Reopen the “Chăm Sóc Người Thân” app on the watch to get a new code; the phone will get a new notification.")}</p>
          </div>
        )}
      </section>
    </main>
  );
}
