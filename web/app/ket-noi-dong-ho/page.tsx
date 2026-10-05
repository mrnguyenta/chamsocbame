import Link from "next/link";
import QRCode from "qrcode";
import { getSession, requireIdentity } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { getT } from "@/lib/i18n-server";
import { getWatchAppUrl } from "@/lib/settings";
import ClaimForm from "./ClaimForm";

export const dynamic = "force-dynamic";

const STEP: React.CSSProperties = {
  width: 36, height: 36, borderRadius: "50%", background: "var(--accent)", color: "#fff",
  display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flex: "none",
};

export default async function PairPage({ searchParams }: { searchParams: Promise<{ nguoi?: string; ma?: string }> }) {
  const { nguoi, ma } = await searchParams;
  const t = await getT();
  const code = (ma ?? "").replace(/\D/g, "").slice(0, 6) || undefined;
  // Người mới chưa có gia đình vẫn vào được: kết nối đồng hồ sẽ tạo gia đình luôn.
  await requireIdentity(code ? `/ket-noi-dong-ho?ma=${code}` : "/ket-noi-dong-ho");
  const session = await getSession();
  const elders = session ? (await getSettings(session.familyId)).elders.map((e) => ({ id: e.id, name: e.name })) : [];
  const canConnect = !session || session.isAdmin;
  const form = canConnect ? <ClaimForm elders={elders} selected={nguoi} code={code} />
    : <p className="muted">{t("Chỉ người quản trị gia đình mới kết nối được đồng hồ.", "Only the family admin can connect a watch.")}</p>;

  // Mở từ thông báo đồng hồ gửi lên điện thoại: app đã cài, mã đã có, chỉ còn chọn người.
  if (code) {
    return (
      <main className="container" style={{ maxWidth: 560 }}>
        <section className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24 }}>{t("Kết nối đồng hồ", "Connect watch")}</h1>
            <p className="muted" style={{ margin: "6px 0 0" }}>{t(`Đồng hồ đang hiện mã ${code.slice(0, 3)} ${code.slice(3)}. Chọn người đeo rồi bấm kết nối.`,
              `The watch is showing code ${code.slice(0, 3)} ${code.slice(3)}. Choose who wears it, then tap Connect.`)}</p>
          </div>
          {form}
        </section>
      </main>
    );
  }

  const storeUrl = await getWatchAppUrl();
  const qr = storeUrl ? await QRCode.toString(storeUrl, { type: "svg", margin: 1, width: 180 }) : null;

  return (
    <main className="container" style={{ maxWidth: 760 }}>
      {session && <Link href="/tai-khoan" className="btn small" style={{ alignSelf: "flex-start" }}>← {t("Tài khoản", "Account")}</Link>}
      <h1 style={{ fontSize: 26 }}>{t("Kết nối đồng hồ", "Connect watch")}</h1>
      <p style={{ margin: 0 }}>
        {t("Làm một lần cho mỗi đồng hồ, khoảng 3 phút. Sau đó đồng hồ tự gửi dữ liệu mỗi 5 phút, ba mẹ không phải làm gì.",
          "Do this once per watch; it takes about 3 minutes. After that the watch sends data every 5 minutes on its own, and your parents don't need to do anything.")}
      </p>

      <section className="card row" style={{ alignItems: "flex-start", gap: 16, flexWrap: "nowrap" }}>
        <span style={STEP}>1</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ marginBottom: 6 }}>{t("Cài ứng dụng “Chăm Sóc Người Thân” lên đồng hồ", "Install the “Chăm Sóc Người Thân” app on the watch")}</h2>
          {storeUrl ? (
            <div className="row" style={{ alignItems: "flex-start", gap: 18 }}>
              <div aria-label={t("Mã QR tới ứng dụng", "QR code for the app")} style={{ background: "#fff", padding: 6, borderRadius: 8, lineHeight: 0 }}
                dangerouslySetInnerHTML={{ __html: qr! }} />
              <div style={{ flex: "1 1 240px" }}>
                <p style={{ marginTop: 0 }}>{t("Dùng điện thoại đang ghép với đồng hồ của ba mẹ, quét mã QR hoặc bấm nút dưới. App Garmin Connect sẽ mở trang ứng dụng, bấm",
                  "On the phone paired with your parent's watch, scan the QR code or tap the button below. Garmin Connect will open the app page; tap")}{" "}
                  <strong>{t("Cài đặt", "Install")}</strong>.</p>
                <a className="btn" href={storeUrl} target="_blank" rel="noreferrer">{t("Mở trong Connect IQ Store", "Open in Connect IQ Store")}</a>
              </div>
            </div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              {t("Ứng dụng đang chờ Garmin duyệt trên Connect IQ Store. Khi được duyệt, quản trị dán link Store ở trang Quản trị hệ thống để trang này hiện mã QR và nút cài.",
                "The app is awaiting Garmin's review on the Connect IQ Store. Once approved, an admin pastes the Store link on the System admin page so this page shows the QR code and install button.")}
            </p>
          )}
        </div>
      </section>

      <section className="card row" style={{ alignItems: "flex-start", gap: 16, flexWrap: "nowrap" }}>
        <span style={STEP}>2</span>
        <div>
          <h2 style={{ marginBottom: 6 }}>{t("Mở ứng dụng trên đồng hồ", "Open the app on the watch")}</h2>
          <p style={{ margin: 0 }}>{t("Màn hình đồng hồ hiện", "The watch screen shows a")} <strong>{t("mã 6 số", "6-digit code")}</strong>{" "}
            {t("(ví dụ 482 917), đồng thời điện thoại nhận một thông báo: bấm vào là mở thẳng trang kết nối, không cần gõ mã. Mã dùng được trong 15 phút. Điện thoại cần ở gần, bật Bluetooth và có mạng.",
              "(e.g. 482 917), and the phone gets a notification: tap it to open the connect page directly, no typing needed. The code is valid for 15 minutes. The phone must be nearby, with Bluetooth on and online.")}</p>
        </div>
      </section>

      <section className="card row" style={{ alignItems: "flex-start", gap: 16, flexWrap: "nowrap" }}>
        <span style={STEP}>3</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ marginBottom: 12 }}>{t("Nhập mã ở đây", "Enter the code here")}</h2>
          {form}
        </div>
      </section>
    </main>
  );
}
