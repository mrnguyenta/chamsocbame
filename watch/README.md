# Ứng dụng đồng hồ Garmin "Chăm Sóc Ba Mẹ"

> **Lưu ý quan trọng:** mã nguồn trong thư mục này **CHƯA được biên dịch** (môi trường
> phát triển lúc viết không có Connect IQ SDK). Lần build đầu tiên có thể cần sửa vài lỗi
> nhỏ (cú pháp, kiểu dữ liệu, tên API). Hãy build và chạy thử trên trình giả lập trước khi
> cài cho ba mẹ.

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

1. Cài **Connect IQ SDK** (SDK Manager): https://developer.garmin.com/connect-iq/sdk/ —
   tải SDK mới nhất và thiết bị Venu 3/3S, Venu 4, vívoactive 5/6.
2. Cài **Visual Studio Code** + extension **Monkey C** (Garmin).
3. Tạo developer key (một lần): VS Code → `Monkey C: Generate a Developer Key`, hoặc:
   ```
   openssl genrsa -out developer_key.pem 4096
   openssl pkcs8 -topk8 -inform PEM -outform DER -in developer_key.pem -out developer_key -nocrypt
   ```
   **Không** commit file key vào git.
4. Build từ thư mục `watch/`:
   ```
   monkeyc -d venu3 -f monkey.jungle -o bin/chamsoc.prg -y developer_key
   ```
   Thay `venu3` bằng `venu3s`, `venu441mm`, `venu445mm`, `vivoactive5`, `vivoactive6`.
5. Chạy thử trên trình giả lập: `connectiq` rồi `monkeydo bin/chamsoc.prg venu3`.
   Trong simulator: *File → Edit Persistent Storage / Application Settings* để nhập
   `server_url`, `device_key`; *Simulation → Background Events → Trigger* để giả lập
   sự kiện nền.

Ghi chú build:
- Biểu tượng `resources/drawables/launcher_icon.png` là 40×40; trình biên dịch sẽ tự co giãn
  (có thể in cảnh báo). Có thể thay bằng icon đúng kích thước từng máy sau.
- Font hệ thống của đồng hồ cần hiển thị được tiếng Việt có dấu. Nếu chữ hiển thị thiếu dấu,
  hãy đặt ngôn ngữ đồng hồ sang Tiếng Việt, hoặc đổi chuỗi trong
  `resources/strings/strings.xml` sang không dấu.

## Cài lên đồng hồ

**Cách 1 — Sideload (nhanh, cho gia đình):**
1. Cắm đồng hồ vào máy tính bằng cáp USB.
2. Chép `bin/chamsoc.prg` vào thư mục `GARMIN/APPS/` trên đồng hồ.
   (Trên macOS cần ứng dụng *Android File Transfer* hoặc *OpenMTP* vì đồng hồ đời mới dùng MTP.)
3. Rút cáp. Ứng dụng xuất hiện trong danh sách ứng dụng.
   Lưu ý: ứng dụng sideload **không có trang Cài đặt trong Garmin Connect**. Cách đơn giản
   để có cài đặt là dùng Cách 2. (Nếu buộc phải sideload, có thể tạm điền sẵn giá trị mặc định
   cho `server_url`/`device_key` trong `resources/properties.xml` trước khi build — không commit.)

**Cách 2 — Connect IQ Store (beta/riêng tư, khuyên dùng):**
1. Xuất gói: VS Code → `Monkey C: Export Project` (tạo file `.iq`).
2. Đăng nhập https://apps.developer.garmin.com → Upload app, chọn **Beta App**
   (chỉ tài khoản developer thấy) hoặc phát hành với mô tả riêng tư/không công khai.
3. Cài từ ứng dụng Connect IQ Store trên điện thoại của ba mẹ, rồi điền cài đặt như trên.

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
