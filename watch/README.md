# Ứng dụng đồng hồ Garmin "Chăm Sóc Ba Mẹ"

> **Tình trạng:** đã **biên dịch thành công** cho Venu 3/3S, Venu 4 (41/45 mm), vívoactive 5/6
> bằng GitHub Actions (`.github/workflows/watch-app.yml`). **Chưa chạy thử trên đồng hồ thật.**

## Ứng dụng làm gì

Garmin Connect thường đồng bộ dữ liệu lên đám mây chậm 10–60 phút. Ứng dụng này chạy một
**dịch vụ nền (background service) mỗi 5 phút** ngay trên đồng hồ, đọc dữ liệu cảm biến và
gửi thẳng tới máy chủ của gia đình, đi qua ứng dụng Garmin Connect trên điện thoại đã ghép
nối (Bluetooth). Dịch vụ nền **vẫn chạy khi đã thoát ứng dụng**, chỉ cần mở ứng dụng một lần
sau khi cài đặt.

Dữ liệu gửi đi (`POST {server_url}/api/watch/push`, header
`Authorization: Bearer {device_key}`, JSON):

| Trường | Ý nghĩa | Nguồn trên đồng hồ |
|---|---|---|
| `v` | phiên bản giao thức, luôn `1` | |
| `ts` | thời điểm gửi (epoch giây, UTC) | `Time.now().value()` |
| `hr` | nhịp tim hiện tại | `Activity.getActivityInfo().currentHeartRate`, nếu không có thì mẫu gần nhất trong `SensorHistory` (30 phút) |
| `hr_samples` | `[[epoch, bpm], ...]` trong khoảng `interval_min` phút gần nhất, tối đa 30, cũ → mới | `SensorHistory.getHeartRateHistory` |
| `resting_hr` | nhịp tim nghỉ | `UserProfile.getProfile().restingHeartRate` |
| `steps` | số bước hôm nay | `ActivityMonitor.getInfo().steps` |
| `stress` | chỉ số căng thẳng gần nhất (1 giờ) | `SensorHistory.getStressHistory` |
| `body_battery` | Body Battery gần nhất (1 giờ) | `SensorHistory.getBodyBatteryHistory` |
| `spo2` | SpO2 gần nhất (4 giờ) | `SensorHistory.getOxygenSaturationHistory` |
| `respiration` | nhịp thở | `ActivityMonitor.Info.respirationRate` |
| `battery` | pin đồng hồ (%) | `System.getSystemStats().battery` |
| `charging` | đang sạc | `System.getSystemStats().charging` |
| `device` | mã part number đồng hồ (nếu có) | `System.getDeviceSettings().partNumber` |

Trường không đọc được sẽ là `null`. Máy chủ nên coi trường bị thiếu giống như `null`.

Màn hình đồng hồ (chữ to, tiếng Việt):

- "Chăm Sóc Ba Mẹ"
- Nhịp tim hiện tại (cập nhật mỗi 5 giây khi đang mở app)
- Trạng thái: "Đã kết nối" / "Chưa cài đặt" / "Sai mã thiết bị" (HTTP 401) /
  "Không thấy điện thoại" (mã -104) / "Lỗi gửi: <mã>"
- "Gửi lúc 07:35" — lần gửi thành công gần nhất
- **Bấm nút chọn (hoặc chạm màn hình) để gửi ngay.** Nút Back để thoát (dịch vụ nền vẫn chạy).

## Pin

Mỗi 5 phút đồng hồ chỉ thức dậy vài giây và gửi một yêu cầu nhỏ (~1 KB) qua Bluetooth.
Mức hao pin thêm là **nhỏ** (thường vài phần trăm mỗi ngày). Có thể tăng `interval_min`
(ví dụ 10 hoặc 15 phút) để tiết kiệm pin hơn.

## Điều kiện để dữ liệu được gửi

- Điện thoại ở **gần** đồng hồ (trong tầm Bluetooth), **Bluetooth bật**.
- Ứng dụng **Garmin Connect** trên điện thoại đang chạy (không bị hệ điều hành tắt; trên
  Android nên tắt tối ưu hóa pin cho Garmin Connect).
- Điện thoại có Internet.
- Nếu điện thoại không ở gần, màn hình sẽ báo "Không thấy điện thoại" và lần sau sẽ tự gửi lại.

## Cài đặt từ điện thoại (server_url, device_key)

1. Mở ứng dụng **Garmin Connect** trên điện thoại → chọn đồng hồ → **Hoạt động & Ứng dụng**
   (hoặc **Connect IQ Apps / Ứng dụng Connect IQ**) → **Chăm Sóc Ba Mẹ** → **Cài đặt**.
   (Hoặc dùng ứng dụng **Connect IQ Store** → Thiết bị của tôi → Chăm Sóc Ba Mẹ → Cài đặt.)
2. Điền:
   - **Địa chỉ máy chủ (server_url)**: ví dụ `https://xxx.vercel.app` (không cần dấu `/` ở cuối).
   - **Mã thiết bị (device_key)**: mã lấy từ trang web gia đình.
   - **Chu kỳ gửi (phút)**: mặc định 5, tối thiểu 5 (giới hạn của Garmin).
3. Lưu. Sau đó **mở ứng dụng trên đồng hồ một lần** để đăng ký dịch vụ nền (nếu đang mở sẵn
   thì ứng dụng tự đăng ký lại khi cài đặt thay đổi).

## Build

Không cần cài gì trên máy: mỗi lần sửa thư mục `watch/` và đẩy lên GitHub, workflow **watch-app**
tự build (dùng image Docker `ghcr.io/matco/connectiq-tester` có sẵn Connect IQ SDK). Tải kết quả ở
GitHub → Actions → watch-app → lần chạy mới nhất → Artifacts → `chamsoc-watch-app`:
- `chamsoc-<máy>.prg`: cài trực tiếp qua USB.
- `chamsoc.iq`: gói để đưa lên Connect IQ Store.

**Khoá ký:** nếu chưa có secret `CIQ_DEVELOPER_KEY`, workflow tạo khoá tạm mỗi lần (đủ để cài thử
qua USB). Để đưa lên Store và cập nhật về sau phải dùng **một khoá cố định**:
```
openssl genrsa -out developer_key.pem 4096
openssl pkcs8 -topk8 -inform PEM -outform DER -in developer_key.pem -out developer_key.der -nocrypt
base64 -w0 developer_key.der   # dán vào GitHub → Settings → Secrets → Actions → CIQ_DEVELOPER_KEY
```
Giữ file khoá cẩn thận, **không** commit vào git. Mất khoá thì không cập nhật được ứng dụng trên Store.

Build trên máy riêng (nếu muốn): cài Connect IQ SDK + VS Code extension Monkey C, rồi
`monkeyc -d venu441mm -f monkey.jungle -o bin/chamsoc.prg -y developer_key.der`.
Font đồng hồ cần hiển thị được tiếng Việt có dấu; nếu thiếu dấu, đặt ngôn ngữ đồng hồ sang Tiếng Việt.

## Cài lên đồng hồ

**Cách 1 — Connect IQ Store (khuyên dùng, gọn nhất cho người dùng):**
1. Một lần, người phát triển: đăng ký tài khoản miễn phí ở https://apps.developer.garmin.com,
   tải `chamsoc.iq` lên, điền mô tả và ảnh, gửi duyệt. Ứng dụng **Beta** chỉ cài được lên đồng hồ
   của chính tài khoản phát triển, nên để cài cho ba mẹ (tài khoản Garmin khác) cần **phát hành**.
2. Người dùng (con cháu làm giúp, khoảng 3 phút), theo trang **Kết nối đồng hồ** trên website:
   - Quét mã QR trên website bằng điện thoại của ba mẹ → app Garmin Connect mở trang ứng dụng → **Cài đặt**.
   - Mở ứng dụng trên đồng hồ: màn hình hiện **mã 6 số** (hiệu lực 15 phút).
   - Trên website chọn người thân, gõ mã 6 số → đồng hồ báo "Đã kết nối" và bắt đầu gửi dữ liệu.
   Không phải gõ gì trên Garmin Connect, vì địa chỉ máy chủ được điền sẵn lúc build
   (biến GitHub `CHAMSOC_SERVER_URL`, xem workflow).
3. Cập nhật về sau tự đến qua Store.

**Cách 2 — chép qua USB (để thử nhanh):**
1. Cắm đồng hồ vào máy tính, chép `chamsoc-<máy>.prg` vào thư mục `GARMIN/APPS/`
   (macOS cần OpenMTP hoặc Android File Transfer).
2. Ứng dụng chép tay **không có trang Cài đặt trong Garmin Connect**, nhưng vẫn ghép bằng mã 6 số được,
   miễn là bản build đã điền sẵn địa chỉ máy chủ (biến `CHAMSOC_SERVER_URL`).

## Thiết bị hỗ trợ (product id trong `manifest.xml`)

`venu3`, `venu3s`, `venu441mm`, `venu445mm`, `vivoactive5`, `vivoactive6` — tất cả đã được
đối chiếu với manifest của GarminHomeAssistant. Muốn thêm máy khác, dùng
`Monkey C: Edit Products` trong VS Code.

## Ghi chú kỹ thuật

- Kiểu ứng dụng: `watch-app`, `minApiLevel` 3.1.0. Quyền: `Background`, `Communications`,
  `SensorHistory`, `UserProfile`.
- Các API tùy chọn (stress, Body Battery, SpO2, nhịp thở, sạc pin) đều được kiểm tra bằng
  `has` nên máy không hỗ trợ sẽ gửi `null`.
- Kết quả lần gửi nền được chuyển về giao diện qua `Background.exit({"code", "ts"})` →
  `onBackgroundData()` → lưu `Application.Storage` (`last_status`, `last_try`, `last_sent`).
  Nếu ứng dụng đang đóng, Garmin giao dữ liệu này vào lần mở ứng dụng tiếp theo (chỉ giữ
  kết quả mới nhất).
- Mã lỗi âm thường gặp: `-104` không có điện thoại/Bluetooth, `-2` hết thời gian chờ BLE,
  `-300` hết thời gian chờ mạng, `-400` phản hồi không phải JSON hợp lệ (máy chủ nên luôn trả
  JSON, kể cả khi lỗi 401).

## Ghi công

Cấu trúc dịch vụ nền, cách đăng ký sự kiện định kỳ, manifest và product id tham khảo từ
dự án **GarminHomeAssistant** (house-of-abbey, giấy phép MIT):
https://github.com/house-of-abbey/GarminHomeAssistant
