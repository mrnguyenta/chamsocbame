import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { HeartArt } from "@/components/icons";
import ShareLink from "@/components/ShareLink";
import { getIdentity } from "@/lib/auth";
import { getPairingState } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * Trang đồng hồ mở trên điện thoại (thông báo "Chăm Sóc Ba Mẹ" từ Garmin Connect).
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

  return (
    <main className="container" style={{ maxWidth: 520 }}>
      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "center", textAlign: "center", padding: 28 }}>
        <HeartArt size={72} />
        {state === "pending" ? (
          <>
            <div>
              <h1 style={{ fontSize: 24 }}>Đồng hồ đang chờ kết nối</h1>
              <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: 6, color: "var(--accent-ink)", marginTop: 8 }}>{pretty}</div>
              <p className="muted" style={{ fontSize: 14, margin: "6px 0 0" }}>Mã dùng được trong 15 phút.</p>
            </div>
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
              <h2 style={{ fontSize: 17 }}>Đây là điện thoại của ba mẹ?</h2>
              <p className="muted" style={{ fontSize: 14, margin: 0 }}>Gửi link này cho con cháu. Con cháu bấm vào là kết nối xong, ba mẹ không phải làm gì thêm.</p>
              <ShareLink text={`Đồng hồ của ba/mẹ đang chờ kết nối Chăm Sóc Ba Mẹ (mã ${pretty}). Con bấm vào đây để kết nối:`} />
            </div>
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
              <h2 style={{ fontSize: 17 }}>Bạn là con cháu?</h2>
              <p className="muted" style={{ fontSize: 14, margin: 0 }}>Đăng nhập bằng email (chưa có thì đăng ký), rồi chọn người đeo đồng hồ.</p>
              <Link className="btn primary" href={`/dang-nhap?next=${encodeURIComponent(target)}`}>Đăng nhập để kết nối</Link>
            </div>
          </>
        ) : state === "claimed" ? (
          <div>
            <h1 style={{ fontSize: 22 }}>Đồng hồ đã được kết nối</h1>
            <p className="muted">Đồng hồ sẽ tự gửi dữ liệu mỗi 5 phút. Không cần làm gì thêm.</p>
            <Link className="btn" href="/">Xem sức khoẻ</Link>
          </div>
        ) : (
          <div>
            <h1 style={{ fontSize: 22 }}>Mã đã hết hạn</h1>
            <p className="muted">Mở lại ứng dụng “Chăm Sóc Ba Mẹ” trên đồng hồ để lấy mã mới, điện thoại sẽ nhận thông báo mới.</p>
          </div>
        )}
      </section>
    </main>
  );
}
