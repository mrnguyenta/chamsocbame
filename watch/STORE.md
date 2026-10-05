# Đưa "Chăm Sóc Ba Mẹ" lên Connect IQ Store

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
Sau đó chạy lại workflow **watch-app** (Actions → watch-app → Run workflow), tải `chamsoc.iq`.

## 2. Tải lên

1. Đăng nhập https://apps.developer.garmin.com bằng tài khoản Garmin (miễn phí).
2. **Upload an App** → chọn `chamsoc.iq`.
3. Điền thông tin theo mục 3, thêm ảnh chụp màn hình đồng hồ (chụp từ chính Fenix 7 hoặc trình giả lập).
4. Gửi duyệt. Garmin thường duyệt trong vài ngày làm việc.
5. Khi được duyệt, copy link trang ứng dụng (dạng `https://apps.garmin.com/apps/<id>`) gửi cho
   người quản trị, đặt vào biến `NEXT_PUBLIC_WATCH_APP_URL` của website. Trang **Kết nối đồng hồ**
   sẽ hiện mã QR và nút **Mở trong Connect IQ Store**.

## 3. Nội dung trang Store

**Tên:** Chăm Sóc Ba Mẹ

**Loại:** Device App (watch-app) · **Danh mục:** Health & Fitness

**Mô tả ngắn (VI):** Gửi nhịp tim, bước chân, giấc ngủ của ba mẹ cho con cháu mỗi 5 phút,
cảnh báo qua Telegram khi có chỉ số bất thường.

**Mô tả (VI):**
> Chăm Sóc Ba Mẹ giúp con cháu theo dõi sức khoẻ ba mẹ từ xa.
> - Mỗi 5 phút đồng hồ tự gửi nhịp tim, bước chân, SpO2, mức căng thẳng, Body Battery và pin đồng hồ, kể cả khi ứng dụng đã đóng.
> - Cảnh báo vào nhóm Telegram gia đình khi nhịp tim quá cao/thấp, lâu không cử động, đồng hồ mất kết nối…
> - Kết nối một chạm: mở ứng dụng, bấm thông báo trên điện thoại. Không cần gõ cài đặt.
> - Miễn phí cho gia đình. Cần điện thoại có Garmin Connect ở gần, bật Bluetooth và có mạng.

**Description (EN):**
> Chăm Sóc Ba Mẹ ("Care for Mom & Dad") lets family members check on their elderly parents remotely.
> Every 5 minutes the watch sends heart rate, steps, SpO2, stress, Body Battery and battery level to the
> family dashboard, and alerts are delivered to the family's Telegram group when something looks wrong.
> One-tap pairing: open the app and tap the notification on the phone. Requires the Garmin Connect app
> on a nearby phone with Bluetooth and internet.

**Quyền ứng dụng (giải thích cho người duyệt):**
- Background, Communications: gửi dữ liệu định kỳ lên máy chủ của gia đình qua điện thoại.
- SensorHistory, UserProfile: đọc nhịp tim, SpO2, stress, Body Battery gần nhất.

**Chính sách riêng tư:** dữ liệu chỉ gửi tới máy chủ Chăm Sóc Ba Mẹ của gia đình
(`chamsocbame-api.vercel.app`), chỉ những người được gia đình mời mới xem được.
