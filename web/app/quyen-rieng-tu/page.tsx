import type { Metadata } from "next";

export const metadata: Metadata = { title: "Quyền riêng tư · Chăm Sóc Ba Mẹ" };

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

/** Chính sách quyền riêng tư (công khai, dùng cho trang Connect IQ Store). Tiếng Việt và tiếng Anh. */
export default function PrivacyPage() {
  return (
    <main className="container" style={{ maxWidth: 760 }}>
      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h1 style={{ fontSize: 26 }}>Quyền riêng tư</h1>
        <p className="muted" style={{ margin: 0 }}>Cập nhật: 05/10/2026</p>

        <h2>Ứng dụng làm gì</h2>
        <p>Chăm Sóc Ba Mẹ giúp con cháu theo dõi sức khoẻ ba mẹ từ xa qua đồng hồ Garmin và báo qua Telegram.
          <strong> Đây không phải thiết bị y tế</strong>, không chẩn đoán bệnh và không thay thế bác sĩ hay dịch vụ cấp cứu.</p>

        <h2>Dữ liệu thu thập</h2>
        <ul>
          <li><strong>Từ đồng hồ</strong> (chỉ sau khi đã kết nối bằng mã 6 số): nhịp tim, bước chân, SpO2, mức căng thẳng,
            Body Battery, nhịp thở, mức pin đồng hồ, thời điểm đo, mẫu đồng hồ.</li>
          <li><strong>Từ Telegram khi đăng nhập</strong>: mã người dùng và tên hiển thị Telegram.</li>
          <li><strong>Do gia đình nhập</strong>: tên người thân, năm sinh, bệnh nền, lịch uống thuốc, chỉ số huyết áp, đường huyết, cân nặng.</li>
          <li><strong>Nếu gia đình tự liên kết Garmin Connect</strong>: mã truy cập (được mã hoá) để đọc giấc ngủ và SpO2 ban đêm.</li>
        </ul>
        <p>Không thu thập vị trí, danh bạ, tin nhắn hay quảng cáo. Không bán hay chia sẻ dữ liệu cho bên thứ ba.</p>

        <h2>Ai xem được</h2>
        <p>Chỉ những thành viên được quản trị gia đình mời vào gia đình đó. Mỗi gia đình chỉ thấy dữ liệu của mình.
          Cảnh báo được gửi vào nhóm Telegram mà gia đình đã nối.</p>

        <h2>Lưu ở đâu, bao lâu</h2>
        <p>Máy chủ chạy trên Vercel; cơ sở dữ liệu Supabase (Singapore), kết nối mã hoá. Dữ liệu chi tiết theo phút được giữ
          để vẽ biểu đồ và có thể được dọn bớt theo thời gian; tóm tắt theo ngày được giữ cho đến khi gia đình xoá.</p>

        <h2>Ngừng và xoá dữ liệu</h2>
        <p>Gỡ ứng dụng trên đồng hồ hoặc gỡ đồng hồ trong trang Cài đặt là ngừng gửi ngay. Quản trị gia đình có thể yêu cầu
          xoá toàn bộ dữ liệu của gia đình{CONTACT ? <> qua email <a href={`mailto:${CONTACT}`}>{CONTACT}</a></> : ""}.</p>

        <hr style={{ border: "none", borderTop: "1px solid var(--border-strong)", margin: "12px 0" }} />

        <h1 style={{ fontSize: 22 }} lang="en">Privacy policy (English)</h1>
        <div lang="en" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p>Chăm Sóc Ba Mẹ (“Care for Mom &amp; Dad”) lets family members check on elderly parents through their Garmin watch
            and Telegram. <strong>It is not a medical device</strong>; it does not diagnose anything and does not replace a
            doctor or emergency services.</p>
          <p><strong>Data collected.</strong> From the watch, only after it is paired with a 6-digit code: heart rate, steps,
            SpO2, stress, Body Battery, respiration, watch battery, timestamps and the watch model. From Telegram login: the
            Telegram user id and display name. Entered by the family: names, birth year, conditions, medication schedules,
            blood pressure, glucose and weight readings. Optionally, encrypted Garmin Connect tokens if the family links an
            account. No location, contacts, messages or advertising. Data is never sold or shared with third parties.</p>
          <p><strong>Access.</strong> Only members invited into that family by its administrator. Alerts go to the family’s
            Telegram group.</p>
          <p><strong>Storage.</strong> Hosted on Vercel with a Supabase database in Singapore over encrypted connections.</p>
          <p><strong>Stopping and deletion.</strong> Removing the watch app or removing the watch in Settings stops sending
            immediately. A family administrator can request deletion of all family data{CONTACT ? <> at <a href={`mailto:${CONTACT}`}>{CONTACT}</a></> : ""}.</p>
        </div>
      </section>
    </main>
  );
}
