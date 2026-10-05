# Chăm Sóc Ba Mẹ

Website giúp con cháu theo dõi sức khoẻ ba mẹ, ông bà qua đồng hồ **Garmin**, và gửi báo cáo, cảnh báo vào **Telegram** cho cả gia đình.

> Trạng thái: giai đoạn ý tưởng. Repo hiện có tài liệu nghiên cứu và kế hoạch, chưa có code.
> Mockup giao diện (riêng tư, chủ tài khoản cần bấm Share để người khác xem): https://claude.ai/artifact/AzgWZm9uc1T6t729DMVdwK
> Gồm 7 màn: web tổng quan, chi tiết một người, cài đặt cảnh báo, Telegram báo cáo sáng, Telegram cảnh báo, thêm người thân, tổng quan trên điện thoại.

## 1. Đọc dữ liệu Garmin Connect: các lựa chọn trên GitHub

| Thư viện | Ngôn ngữ | Tình trạng (10/2026) | Ghi chú |
|---|---|---|---|
| [cyberjunky/python-garminconnect](https://github.com/cyberjunky/python-garminconnect) | Python ≥ 3.12 | **Đang được bảo trì**, ~3.1k sao, bản 0.3.17 | Hơn 150 hàm: nhịp tim, giấc ngủ, stress, Body Battery, SpO2, HRV, nhịp thở, huyết áp, cân nặng, hoạt động, thiết bị. Từ 0.3.0 dùng luồng đăng nhập SSO của app Android + `curl_cffi` (vượt chặn TLS của Cloudflare). **Khuyến nghị dùng cái này.** |
| [matin/garth](https://github.com/matin/garth) | Python | **Đã ngừng (deprecated)** | Garmin đổi cơ chế đăng nhập tháng 3/2026 nên garth không còn chạy. |
| [Pythe1337N/garmin-connect](https://github.com/Pythe1337N/garmin-connect) | TypeScript/Node | Ít cập nhật, 37 issue mở | Dễ bị chặn bởi Cloudflare TLS fingerprinting; không nên dùng cho sản phẩm. |
| [tcgoetz/GarminDB](https://github.com/tcgoetz/GarminDB) | Python | Đang bảo trì | Tải dữ liệu về SQLite để phân tích; hợp cho báo cáo lịch sử, không hợp cho cảnh báo gần thời gian thực. |
| [Nicolasvegam/garmin-connect-mcp](https://github.com/Nicolasvegam/garmin-connect-mcp) | TypeScript | Mới (2026) | MCP server cho trợ lý AI; tham khảo được nếu muốn có chatbot hỏi đáp về sức khoẻ. |
| Garmin Connect Developer Program (Health API) | REST/webhook, chính thức | Cần đăng ký doanh nghiệp và được Garmin duyệt | Garmin **chủ động đẩy** dữ liệu qua webhook, ổn định và hợp pháp. Nên chuyển sang khi sản phẩm có nhiều người dùng. |

Các hàm của `python-garminconnect` sẽ dùng:

```python
from garminconnect import Garmin

g = Garmin(email, password, prompt_mfa=lambda: input("MFA: "))
g.login("~/.garminconnect/<nguoi_than_id>")   # lưu token, lần sau không cần mật khẩu

today = "2026-10-05"
g.get_user_summary(today)       # bước chân, calo, nhịp tim nghỉ, stress TB, Body Battery
g.get_heart_rates(today)        # nhịp tim theo từng thời điểm
g.get_sleep_data(today)         # giấc ngủ: sâu / nhẹ / REM / thức, điểm ngủ
g.get_spo2_data(today)          # SpO2
g.get_stress_data(today)        # stress
g.get_body_battery(today)       # Body Battery
g.get_respiration_data(today)   # nhịp thở
g.get_hrv_data(today)           # HRV
g.get_blood_pressure(today)     # huyết áp (nếu nhập vào Garmin Connect)
g.get_devices()                 # thiết bị, dùng để biết đồng hồ nào
g.get_device_last_used()        # lần đồng bộ cuối, phát hiện "mất kết nối"
```

### Những giới hạn cần biết trước

1. **Không phải thời gian thực.** Đồng hồ → app Garmin Connect trên điện thoại của ba mẹ (Bluetooth) → máy chủ Garmin → hệ thống mình đọc. Thường trễ 10–60 phút, có khi vài giờ nếu điện thoại tắt Bluetooth/mạng.
2. **Không lấy được cảnh báo té ngã / sự cố.** Tính năng Incident Detection của Garmin chỉ gửi SMS tới số liên hệ khẩn cấp cài trong app Garmin; API không trả về. → Hãy cài số của con cái làm liên hệ khẩn cấp trong app Garmin Connect của ba mẹ, song song với hệ thống này.
3. **Thư viện không chính thức.** Garmin có thể đổi đăng nhập bất kỳ lúc nào (như tháng 3/2026). Cần theo dõi bản cập nhật thư viện và có cảnh báo "mất kết nối Garmin" cho quản trị.
4. **MFA.** Nếu tài khoản bật xác thực 2 lớp, lần đầu phải nhập mã; token lưu lại dùng được lâu, khi hết hạn phải đăng nhập lại (giao diện đã có bước này).
5. **Không phải thiết bị y tế.** Mọi cảnh báo chỉ mang tính tham khảo; ghi rõ trên giao diện và tin nhắn.
6. **Đọc vừa phải.** Mỗi tài khoản đọc khoảng 15 phút/lần để tránh bị Garmin chặn.

## 2. Kiến trúc đề xuất

```
Đồng hồ Garmin ──BT──▶ App Garmin Connect (điện thoại ba mẹ) ──▶ Máy chủ Garmin
                                                                    │
                                     (mỗi 15 phút, python-garminconnect)
                                                                    ▼
┌──────────────── Backend (Python, FastAPI) ────────────────────────────────┐
│ Worker đồng bộ  ─▶  PostgreSQL (người thân, chỉ số, cảnh báo, token mã hoá)│
│ Bộ quy tắc cảnh báo ─▶ Telegram Bot API (nhóm gia đình + nhắn riêng)       │
│ Lịch báo cáo (sáng / tối / tuần) · Tóm tắt AI (tuỳ chọn)                   │
└────────────────────────────────────────────────────────────────────────────┘
                                   ▲
                         Website (Next.js) cho con cháu
```

- **Backend:** Python 3.12 + FastAPI, vì thư viện Garmin tốt nhất là Python.
- **Hàng đợi / lịch:** APScheduler (nhỏ) hoặc Celery + Redis (nhiều người dùng).
- **Cơ sở dữ liệu:** PostgreSQL (Supabase cũng được). Token Garmin mã hoá bằng khoá riêng, không lưu mật khẩu.
- **Telegram:** `python-telegram-bot`; bot thêm vào nhóm gia đình, nút bấm inline ("Tôi xử lý", "Tắt 2 giờ", "Biểu đồ").
- **Website:** Next.js, đăng nhập bằng Telegram Login hoặc Google.
- **Triển khai:** một VPS nhỏ (Docker Compose) là đủ cho vài chục gia đình.

## 3. Tính năng

### Bản đầu tiên (MVP)
- Quản lý nhiều người thân, mỗi người một tài khoản Garmin.
- Đồng bộ dữ liệu 15 phút/lần, hiển thị tổng quan và chi tiết.
- Bộ ngưỡng cảnh báo riêng cho từng người: nhịp tim nghỉ cao/thấp, SpO2 thấp, mất kết nối quá X giờ, ngủ quá ít, ít vận động, pin đồng hồ yếu.
- Telegram: báo cáo sáng, cảnh báo tức thì, lệnh `/tongquan`, `/ba`, `/me`.
- Nhiều người chăm sóc cùng lúc, phân quyền (quản trị / nhận cảnh báo / chỉ xem báo cáo).

### Gợi ý thêm
- **Phân công xử lý cảnh báo:** nút "Tôi xử lý" để anh chị em biết ai đang lo, tránh cả nhà cùng gọi hoặc không ai gọi.
- **Leo thang:** sau 10 phút chưa ai nhận thì nhắn riêng người ở gần; sau 20 phút gọi điện tự động (dịch vụ như Twilio/Stringee).
- **Ngưỡng cá nhân hoá:** tính đường nền 14 ngày của từng người, cảnh báo khi lệch bất thường thay vì một con số cố định.
- **Phát hiện "im lặng bất thường":** đồng hồ đang đeo nhưng gần như không có bước chân đến trưa.
- **Nhắc uống thuốc và nhắc sạc pin** gửi thẳng cho ba mẹ qua Telegram, ba mẹ bấm "Đã uống".
- **Nhập tay** huyết áp, đường huyết, cân nặng; ghi chú, lịch tái khám dùng chung.
- **Báo cáo tuần kèm biểu đồ** (ảnh PNG gửi vào Telegram) và **tóm tắt bằng AI** dễ hiểu.
- **Xuất PDF** để mang theo khi đi khám bác sĩ.
- **Giờ yên lặng** ban đêm, chỉ gửi cảnh báo khẩn cấp.
- Giai đoạn sau: hỗ trợ thêm Apple Watch, Xiaomi, Samsung; chuyển sang Garmin Health API chính thức.

## 4. Câu hỏi cần chủ dự án trả lời

1. Dùng cho riêng gia đình mình hay làm thành dịch vụ cho nhiều gia đình (có thu phí)? Quyết định việc đi đường thư viện không chính thức hay đăng ký Garmin Health API.
2. Ba mẹ đang đeo dòng đồng hồ Garmin nào? (Venu, vívoactive, Forerunner, vívosmart… mỗi dòng đo được chỉ số khác nhau, ví dụ SpO2 ban đêm, ECG.)
3. Ba mẹ có dùng điện thoại thông minh luôn bật Bluetooth và mạng không? Nếu không, dữ liệu sẽ trễ nhiều.
4. Tài khoản Garmin của ba mẹ có bật xác thực 2 lớp (MFA) không? Ai giữ email nhận mã?
5. Ba mẹ có tự dùng Telegram không, hay chỉ con cháu dùng? (Quyết định có gửi nhắc thuốc / nhắc sạc pin thẳng cho ba mẹ hay không.)
6. Cảnh báo quan trọng nhất với gia đình là gì? Ví dụ bệnh nền: tim mạch, huyết áp, tiểu đường, COPD.
7. Có cần gọi điện tự động khi không ai phản hồi cảnh báo không? (Tốn phí dịch vụ gọi.)
8. Bạn muốn tự host trên VPS hay dùng dịch vụ đám mây (Vercel + Supabase…)? Bạn quen ngôn ngữ lập trình nào?
9. Có cần tóm tắt bằng AI không?
10. Ngoài Garmin, có thiết bị nào khác cần nối vào (máy đo huyết áp Omron, cân Xiaomi…)?
