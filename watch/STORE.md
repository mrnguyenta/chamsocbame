# Đưa "Chăm Sóc Người Thân" lên Connect IQ Store

Cài qua Store là cách gọn nhất cho người dùng: không cáp, không máy tính, tự cập nhật.
Việc dưới đây chỉ làm **một lần** (người phát triển).

## 1. Khoá ký cố định (bắt buộc trước lần tải lên đầu tiên)

Store chỉ nhận bản cập nhật ký cùng một khoá. Tạo trên máy của bạn:

```bash
openssl genrsa -out developer_key.pem 4096
openssl pkcs8 -topk8 -inform PEM -outform DER -in developer_key.pem -out developer_key.der -nocrypt
base64 -w0 developer_key.der    # macOS: base64 -i developer_key.der
```

Dán chuỗi base64 vào GitHub → repo → Settings → Secrets and variables → Actions →
**New repository secret**, tên `CIQ_DEVELOPER_KEY`. Cất file `.der` ở nơi an toàn, không commit.
Sau đó chạy lại workflow **watch-app** (Actions → watch-app → Run workflow). File mới có ở
https://github.com/mrnguyenta/chamsocbame/releases/tag/watch-latest

## 2a. Bản Beta (thử ngay trên đồng hồ của chính bạn, làm được hoàn toàn trên iPhone)

Beta chỉ cài được lên đồng hồ thuộc **tài khoản Garmin của người tải lên**. Đồng hồ của người khác
cần bản chính thức (mục 2).

1. Tải `chamsoc-beta.iq`:
   https://github.com/mrnguyenta/chamsocbame/releases/download/watch-latest/chamsoc-beta.iq
   (Safari → Tải về → nằm trong app Tệp, thư mục Tải về).
2. Mở https://apps-developer.garmin.com, đăng nhập tài khoản Garmin (cùng tài khoản đang dùng Garmin Connect).
   Lần đầu: đồng ý điều khoản nhà phát triển.
3. **Upload an App** → chọn file `chamsoc-beta.iq` → **đánh dấu "Beta App"** → điền tên
   "Chăm Sóc Người Thân", mô tả (mục 3), danh mục Health & Fitness → gửi.
4. Cài xuống đồng hồ: trên trang quản lý (apps-developer.garmin.com) mở app Beta vừa tải lên → nút
   **Download** → chọn đồng hồ. App được cài ở lần đồng bộ kế tiếp của Garmin Connect trên điện thoại
   (mở Garmin Connect, kéo xuống để đồng bộ).
5. Bản mới: tải `chamsoc-beta.iq` mới về, vào trang ứng dụng trên apps-developer.garmin.com →
   **Upload a new version**. Đồng hồ tự cập nhật qua Garmin Connect.

## 2. Tải lên bản chính thức (cho mọi người)

1. Đăng nhập https://apps-developer.garmin.com bằng tài khoản Garmin (miễn phí).
2. **Upload an App** → chọn `chamsoc.iq` (không đánh dấu Beta).
3. Điền thông tin theo mục 3, thêm ảnh chụp màn hình đồng hồ (chụp từ chính Fenix 7 hoặc trình giả lập).
4. Gửi duyệt. Garmin thường duyệt trong vài ngày làm việc.
5. Khi được duyệt, copy link trang ứng dụng (dạng `https://apps.garmin.com/apps/<id>`) gửi cho
   người quản trị, đặt vào biến `NEXT_PUBLIC_WATCH_APP_URL` của website. Trang **Kết nối đồng hồ**
   sẽ hiện mã QR và nút **Mở trong Connect IQ Store**.

## 3. Nội dung trang Store

**Tên:** Chăm Sóc Người Thân

**Loại:** Device App (watch-app) · **Danh mục:** Health & Fitness

**Mô tả ngắn (VI):** Theo dõi sức khoẻ người thân từ xa: đồng hồ gửi nhịp tim, vận động, căng thẳng mỗi 5 phút,
cả nhà nhận cảnh báo qua Telegram khi có bất thường.

**Short description (EN):** Check on your loved ones from afar: the watch sends heart rate, activity and stress
every 5 minutes, and the whole family gets Telegram alerts when something looks wrong.

**Mô tả (VI):**
> Chăm Sóc Người Thân giúp cả nhà theo dõi sức khoẻ ông bà, ba mẹ và người thân từ xa.
> - Mỗi 5 phút đồng hồ tự gửi nhịp tim, bước chân, calo, quãng đường, căng thẳng, Body Battery, nhịp thở, SpO2 và pin đồng hồ, kể cả khi ứng dụng đã đóng.
> - Cảnh báo vào nhóm Telegram gia đình khi nhịp tim quá cao/thấp, ngồi/nằm im quá lâu, căng thẳng cao kéo dài, không đeo đồng hồ hoặc đồng hồ mất kết nối.
> - Website cho cả nhà: mỗi người thân một trang, ngưỡng cảnh báo theo bệnh nền, nhắc uống thuốc, báo cáo sáng/tối.
> - Kết nối một chạm: mở ứng dụng, bấm thông báo trên điện thoại. Không cần gõ cài đặt.
> - Miễn phí cho gia đình. Cần điện thoại có Garmin Connect ở gần, bật Bluetooth và có mạng.
> - Không phải thiết bị y tế, không thay thế bác sĩ hay dịch vụ cấp cứu.

**Description (EN):**
> Chăm Sóc Người Thân ("Care for Loved Ones") lets a family check on grandparents, parents and other loved ones remotely.
> Every 5 minutes the watch sends heart rate, steps, calories, distance, stress, Body Battery, respiration, SpO2 and
> battery level to the family dashboard, even when the app is closed. Alerts go to the family's Telegram group when
> heart rate is too high or low, someone has been inactive for hours, stress stays high, the watch is not worn or
> it stops sending.
> One-tap pairing: open the app and tap the notification on the phone. Requires the Garmin Connect app
> on a nearby phone with Bluetooth and internet.
> Not a medical device; it does not diagnose anything and does not replace a doctor or emergency services.

**Quyền ứng dụng (giải thích cho người duyệt):**
- Background, Communications: gửi dữ liệu định kỳ lên máy chủ của gia đình qua điện thoại.
- SensorHistory, UserProfile: đọc nhịp tim, SpO2, stress, Body Battery gần nhất, nhịp tim nghỉ.

**Chính sách riêng tư (Privacy policy URL):** https://chamsocnguoithan.vercel.app/quyen-rieng-tu

**Ngôn ngữ:** đồng hồ để Tiếng Việt thì giao diện tiếng Việt, ngôn ngữ khác thì tiếng Anh.

## 4. Ghi chú cho người duyệt (dán vào ô "Notes to reviewer", tiếng Anh)

```
This is a companion app for a family health dashboard (https://chamsocnguoithan.vercel.app).

How it works:
1. On first launch the watch requests a 6-digit pairing code from our server
   (chamsocnguoithan-api.vercel.app) through the phone and shows it on screen. The phone also
   receives a notification (Communications.openWebPage) that opens the pairing page.
2. A family member signs in on the website (email and password) and enters the code.
   The watch then shows "Connected" with the current heart rate.
3. A background temporal event (every 5 minutes, the minimum) sends heart rate, steps,
   calories, distance, floors, active minutes, stress, Body Battery, respiration, SpO2
   and battery level to the family's server. Alerts are sent to the family's Telegram group.
   Pressing START sends immediately.

Without a family account the app stays on the pairing screen; this is expected.
The pairing code refreshes every 15 minutes. All sensor APIs are guarded with `has`,
so devices without a sensor send null.

Permissions: Background + Communications (periodic upload via the phone),
SensorHistory + UserProfile (read recent heart rate, SpO2, stress, Body Battery).

Not a medical device. Privacy policy: https://chamsocnguoithan.vercel.app/quyen-rieng-tu
```

## 5. Trước khi nộp, kiểm tra

- [ ] Đã có secret `CIQ_DEVELOPER_KEY` và build lại (file trên Release là bản ký bằng khoá cố định).
- [ ] Website công khai (không bị Vercel bắt đăng nhập) và đã có bot Telegram để đăng nhập.
- [ ] Đã thử bản Beta trên Fenix 7: ghép mã, thấy "Đã kết nối", dữ liệu lên website.
- [ ] 3–5 ảnh chụp màn hình đồng hồ (màn hình mã kết nối, màn hình nhịp tim) và 1–2 ảnh website.
