import type { Metadata } from "next";
import { isLang, makeT } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { getContactEmail } from "@/lib/settings";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ lang?: string }> }): Promise<Metadata> {
  const q = (await searchParams).lang;
  const t = makeT(isLang(q) ? q : await getLang());
  return { title: t("Quyền riêng tư · Chăm Sóc Người Thân", "Privacy policy · Family Care") };
}

export const dynamic = "force-dynamic";

/** Chính sách quyền riêng tư (công khai, dùng cho trang Connect IQ Store). Tiếng Việt và tiếng Anh; ?lang=en mở thẳng bản tiếng Anh. */
export default async function PrivacyPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const q = (await searchParams).lang;
  const lang = isLang(q) ? q : await getLang();
  const t = makeT(lang);
  const CONTACT = await getContactEmail();
  return (
    <main className="container" style={{ maxWidth: 760 }} lang={lang}>
      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
          <h1 style={{ fontSize: 26 }}>{t("Quyền riêng tư", "Privacy policy")}</h1>
          {lang === "en"
            ? <a href="/quyen-rieng-tu?lang=vi" lang="vi" style={{ fontSize: 14 }}>Tiếng Việt</a>
            : <a href="/quyen-rieng-tu?lang=en" lang="en" style={{ fontSize: 14 }}>English</a>}
        </div>
        <p className="muted" style={{ margin: 0 }}>{t("Cập nhật: 05/10/2026", "Last updated: 5 October 2026")}</p>

        <h2>{t("Ứng dụng làm gì", "What the app does")}</h2>
        <p>{t("Chăm Sóc Người Thân giúp gia đình theo dõi sức khoẻ ông bà, ba mẹ và người thân từ xa qua đồng hồ Garmin và báo qua Telegram.",
          "Chăm Sóc Người Thân (“Family Care”) helps a family keep an eye on the health of grandparents, parents and other loved ones from afar, through their Garmin watch, with alerts sent via Telegram.")}
          <strong>{t(" Đây không phải thiết bị y tế", " It is not a medical device")}</strong>
          {t(", không chẩn đoán bệnh và không thay thế bác sĩ hay dịch vụ cấp cứu.",
            "; it does not diagnose any illness and does not replace a doctor or emergency services.")}</p>

        <h2>{t("Dữ liệu thu thập", "Data we collect")}</h2>
        <ul>
          <li><strong>{t("Từ đồng hồ", "From the watch")}</strong>{" "}
            {t("(chỉ sau khi đã kết nối bằng mã 6 số): nhịp tim, bước chân, SpO2, mức căng thẳng, Body Battery, nhịp thở, mức pin đồng hồ, thời điểm đo, mẫu đồng hồ.",
              "(only after it has been connected with a 6-digit code): heart rate, steps, SpO2, stress level, Body Battery, respiration rate, watch battery level, measurement times and the watch model.")}</li>
          <li><strong>{t("Tài khoản", "Account")}</strong>
            {t(": email, tên và mật khẩu đã mã hoá (không ai đọc được mật khẩu).",
              ": email, name and a hashed password (no one can read the password).")}</li>
          <li><strong>{t("Từ Telegram khi nối bot", "From Telegram, when connecting the bot")}</strong>
            {t(": mã người dùng và tên hiển thị Telegram, để gửi cảnh báo.",
              ": the Telegram user ID and display name, used to send alerts.")}</li>
          <li><strong>{t("Do gia đình nhập", "Entered by the family")}</strong>
            {t(": tên người thân, năm sinh, bệnh nền, lịch uống thuốc, chỉ số huyết áp, đường huyết, cân nặng.",
              ": the loved one’s name, birth year, underlying health conditions, medication schedules, and blood pressure, blood glucose and weight readings.")}</li>
          <li><strong>{t("Nếu gia đình tự liên kết Garmin Connect", "If the family chooses to link Garmin Connect")}</strong>
            {t(": mã truy cập (được mã hoá) để đọc giấc ngủ và SpO2 ban đêm.",
              ": access tokens (stored encrypted), used to read sleep and overnight SpO2.")}</li>
        </ul>
        <p>{t("Không thu thập vị trí, danh bạ, tin nhắn hay quảng cáo. Không bán hay chia sẻ dữ liệu cho bên thứ ba.",
          "We do not collect location, contacts or messages, and there is no advertising. Data is never sold or shared with third parties.")}</p>

        <h2>{t("Ai xem được", "Who can see the data")}</h2>
        <p>{t("Chỉ những thành viên được quản trị gia đình mời vào gia đình đó. Mỗi gia đình chỉ thấy dữ liệu của mình. Cảnh báo được gửi vào nhóm Telegram mà gia đình đã nối.",
          "Only members whom the family administrator has invited into that family. Each family sees only its own data. Alerts are sent to the Telegram group the family has connected.")}</p>

        <h2>{t("Lưu ở đâu, bao lâu", "Where and how long data is stored")}</h2>
        <p>{t("Máy chủ chạy trên Vercel; cơ sở dữ liệu Supabase (Singapore), kết nối mã hoá. Dữ liệu chi tiết theo phút được giữ để vẽ biểu đồ và có thể được dọn bớt theo thời gian; tóm tắt theo ngày được giữ cho đến khi gia đình xoá.",
          "The server runs on Vercel; the database is on Supabase (Singapore), and all connections are encrypted. Detailed minute-by-minute data is kept to draw charts and may be pruned over time; daily summaries are kept until the family deletes them.")}</p>

        <h2>{t("Ngừng và xoá dữ liệu", "Stopping and deleting data")}</h2>
        <p>{t("Gỡ ứng dụng trên đồng hồ hoặc gỡ đồng hồ trong trang Cài đặt là ngừng gửi ngay. Quản trị gia đình có thể yêu cầu xoá toàn bộ dữ liệu của gia đình",
          "Uninstalling the app from the watch, or removing the watch on the Settings page, stops data from being sent immediately. A family administrator can request deletion of all of the family’s data")}
          {CONTACT ? <>{t(" qua email ", " by emailing ")}<a href={`mailto:${CONTACT}`}>{CONTACT}</a></> : ""}.</p>
      </section>
    </main>
  );
}
