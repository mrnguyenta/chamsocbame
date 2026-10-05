import Link from "next/link";
import QRCode from "qrcode";
import { getSession, requireIdentity } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import ClaimForm from "./ClaimForm";

export const dynamic = "force-dynamic";

const STEP: React.CSSProperties = {
  width: 36, height: 36, borderRadius: "50%", background: "var(--accent)", color: "#fff",
  display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flex: "none",
};

export default async function PairPage({ searchParams }: { searchParams: Promise<{ nguoi?: string; ma?: string }> }) {
  const { nguoi, ma } = await searchParams;
  const code = (ma ?? "").replace(/\D/g, "").slice(0, 6) || undefined;
  // Người mới chưa có gia đình vẫn vào được: kết nối đồng hồ sẽ tạo gia đình luôn.
  await requireIdentity(code ? `/ket-noi-dong-ho?ma=${code}` : "/ket-noi-dong-ho");
  const session = await getSession();
  const elders = session ? (await getSettings(session.familyId)).elders.map((e) => ({ id: e.id, name: e.name })) : [];
  const canConnect = !session || session.isAdmin;
  const form = canConnect ? <ClaimForm elders={elders} selected={nguoi} code={code} />
    : <p className="muted">Chỉ người quản trị gia đình mới kết nối được đồng hồ.</p>;

  // Mở từ thông báo đồng hồ gửi lên điện thoại: app đã cài, mã đã có, chỉ còn chọn người.
  if (code) {
    return (
      <main className="container" style={{ maxWidth: 560 }}>
        <section className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24 }}>Kết nối đồng hồ</h1>
            <p className="muted" style={{ margin: "6px 0 0" }}>Đồng hồ đang hiện mã {code.slice(0, 3)} {code.slice(3)}. Chọn người đeo rồi bấm kết nối.</p>
          </div>
          {form}
        </section>
      </main>
    );
  }

  const storeUrl = process.env.NEXT_PUBLIC_WATCH_APP_URL;
  const qr = storeUrl ? await QRCode.toString(storeUrl, { type: "svg", margin: 1, width: 180 }) : null;

  return (
    <main className="container" style={{ maxWidth: 760 }}>
      {session && <Link href="/cai-dat" className="btn small" style={{ alignSelf: "flex-start" }}>← Cài đặt</Link>}
      <h1 style={{ fontSize: 26 }}>Kết nối đồng hồ</h1>
      <p style={{ margin: 0 }}>
        Làm một lần cho mỗi đồng hồ, khoảng 3 phút. Sau đó đồng hồ tự gửi dữ liệu mỗi 5 phút, ba mẹ không phải làm gì.
      </p>

      <section className="card row" style={{ alignItems: "flex-start", gap: 16, flexWrap: "nowrap" }}>
        <span style={STEP}>1</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ marginBottom: 6 }}>Cài ứng dụng “Chăm Sóc Ba Mẹ” lên đồng hồ</h2>
          {storeUrl ? (
            <div className="row" style={{ alignItems: "flex-start", gap: 18 }}>
              <div aria-label="Mã QR tới ứng dụng" style={{ background: "#fff", padding: 6, borderRadius: 8, lineHeight: 0 }}
                dangerouslySetInnerHTML={{ __html: qr! }} />
              <div style={{ flex: "1 1 240px" }}>
                <p style={{ marginTop: 0 }}>Dùng điện thoại đang ghép với đồng hồ của ba mẹ, quét mã QR hoặc bấm nút dưới.
                  App Garmin Connect sẽ mở trang ứng dụng, bấm <strong>Cài đặt</strong>.</p>
                <a className="btn" href={storeUrl} target="_blank" rel="noreferrer">Mở trong Connect IQ Store</a>
              </div>
            </div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Ứng dụng chưa phát hành trên Connect IQ Store. Tạm thời cài bằng cáp USB theo hướng dẫn trong
              <code> watch/README.md</code>. Khi phát hành, đặt NEXT_PUBLIC_WATCH_APP_URL để trang này hiện mã QR.
            </p>
          )}
        </div>
      </section>

      <section className="card row" style={{ alignItems: "flex-start", gap: 16, flexWrap: "nowrap" }}>
        <span style={STEP}>2</span>
        <div>
          <h2 style={{ marginBottom: 6 }}>Mở ứng dụng trên đồng hồ</h2>
          <p style={{ margin: 0 }}>Màn hình đồng hồ hiện <strong>mã 6 số</strong> (ví dụ 482 917), đồng thời điện thoại nhận một
            thông báo: bấm vào là mở thẳng trang kết nối, không cần gõ mã. Mã dùng được trong 15 phút.
            Điện thoại cần ở gần, bật Bluetooth và có mạng.</p>
        </div>
      </section>

      <section className="card row" style={{ alignItems: "flex-start", gap: 16, flexWrap: "nowrap" }}>
        <span style={STEP}>3</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ marginBottom: 12 }}>Nhập mã ở đây</h2>
          {form}
        </div>
      </section>
    </main>
  );
}
