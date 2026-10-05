# Chăm Sóc Ba Mẹ

Theo dõi sức khoẻ ba mẹ, ông bà qua đồng hồ **Garmin**, gửi báo cáo, cảnh báo và nhắc thuốc qua **Telegram** cho cả gia đình.

Mockup giao diện (riêng tư, chủ tài khoản bấm Share để người khác xem): https://claude.ai/artifact/AzgWZm9uc1T6t729DMVdwK

## Đã chốt

| Câu hỏi | Quyết định |
|---|---|
| Phạm vi | Dùng cho gia đình mình trước, mở cho người khác sau, chưa thu phí → dùng thư viện không chính thức `python-garminconnect`. Khi mở rộng thì đăng ký Garmin Health API. |
| Điện thoại ba mẹ | Luôn bật Bluetooth và mạng → dữ liệu trễ khoảng 15–30 phút. |
| Telegram | Cả ba mẹ và con cháu đều dùng → ba mẹ nhận nhắc thuốc và tự nhắn chỉ số (`130/85`, `đường 7.2`). |
| Bệnh nền | Có → bật sẵn ngưỡng huyết áp, đường huyết, tim mạch theo bệnh của từng người. |
| Gọi điện tự động | Để sẵn giao diện (`backend/chamsoc/calls.py`), bật khi cần. |
| Email nhận mã MFA Garmin | Con cháu giữ. |
| Ngưỡng theo bệnh | Gia đình tự chỉnh trên trang **Cài đặt** của website (bệnh nền, ngưỡng, mức độ, giờ kiểm tra). |
| Dữ liệu nhanh | Garmin Connect trễ 10–60 phút (đồng hồ → điện thoại → máy chủ Garmin; API chính thức cũng vậy). Để có dữ liệu **~5 phút** và **đầy đủ**, dùng **ứng dụng Connect IQ riêng** trên đồng hồ (`watch/`). |
| Thứ tự làm | Website theo mockup trước (để trình bày, kể cả với Garmin), API chính thức Garmin cắm vào sau. |
| Hạ tầng | Đám mây: **Vercel** (backend Python, sau này web Next.js) + **Supabase** (PostgreSQL, lịch chạy pg_cron). |

## Tư vấn thiết bị

### Đồng hồ (chưa mua)

| Mẫu | Phù hợp khi | Điểm chính |
|---|---|---|
| **Garmin Venu 4** (khoảng 549 USD) | Ba/mẹ có bệnh tim mạch, cần đầy đủ nhất | Có **ECG** (đo điện tim; tuỳ quốc gia có được bật hay không), nhiệt độ da, **phát hiện té ngã cả ngày** (Garmin tự nhắn vị trí cho người thân), màn hình lớn, pin ~11 ngày, có cỡ 41 mm và 45 mm. |
| **Garmin vívoactive 6** (khoảng 299 USD) | Tiết kiệm hơn, nhẹ (36 g) | Đủ nhịp tim, SpO2, giấc ngủ, stress, Body Battery, pin ~11 ngày. **Không có ECG và nhiệt độ da.** |

Gợi ý: người có bệnh tim mạch dùng Venu 4; người còn lại có thể dùng vívoactive 6. Chọn cỡ mặt lớn cho dễ đọc.

Lưu ý: **cảnh báo té ngã của Garmin không đi qua API**. Hãy cài số điện thoại của con cháu làm liên hệ khẩn cấp ngay trong app Garmin Connect của ba mẹ. ECG cũng chỉ xem trong app Garmin, hệ thống này không đọc được.

### Máy đo huyết áp: Omron có kết nối được không?

- **Omron không gửi được trực tiếp vào Garmin Connect.** App OMRON connect chỉ đồng bộ với Apple Health / Google Health Connect, không có API mở cho mình đọc.
- Có các dự án cộng đồng như [export2garmin](https://github.com/RobertWojtowicz/export2garmin), nhưng cần một máy Raspberry Pi đặt cạnh máy đo, đọc qua Bluetooth rồi đẩy lên Garmin. Hơi phức tạp với ba mẹ.
- **Phương án 1 (khuyên dùng, rẻ):** máy Omron nào cũng được. Đo xong ba mẹ **nhắn số vào Telegram** (ví dụ `132/84`), hệ thống đã làm sẵn phần này.
- **Phương án 2 (tự động):** **Garmin Index BPM** (khoảng 150 USD). Máy tự đồng bộ qua Wi‑Fi vào Garmin Connect, hệ thống đọc được bằng `get_blood_pressure` mà không cần nhắn tay. Cần kiểm tra nơi bán ở Việt Nam.

### Đường huyết (tiểu đường)

- Máy đo đầu ngón tay thông thường: ba mẹ nhắn `đường 7.2` vào Telegram.
- Nếu sau này dùng cảm biến liên tục (Libre/Dexcom), có thể tích hợp riêng ở giai đoạn sau.

### Cân

- **Garmin Index S2** đồng bộ thẳng vào Garmin Connect (có bán ở Việt Nam, ví dụ FPT Shop).
- Cân Xiaomi cần cầu nối như [ble-scale-sync](https://github.com/KristianP26/ble-scale-sync). Đơn giản nhất là nhắn `cân 58` vào Telegram.

## Thư viện Garmin đã chọn

[cyberjunky/python-garminconnect](https://github.com/cyberjunky/python-garminconnect) bản ≥ 0.3.17 (Python ≥ 3.12). Đây là thư viện đang được bảo trì, đã chuyển sang cách đăng nhập mới sau khi Garmin đổi hồi 3/2026. `garth` đã ngừng phát triển, đừng dùng.

Giới hạn:
- Dữ liệu không đến ngay lập tức. Đường đi là đồng hồ → điện thoại → máy chủ Garmin → hệ thống này.
- Đây là thư viện không chính thức, Garmin có thể đổi cách đăng nhập bất cứ lúc nào. Khi đó hệ thống báo "Mất kết nối Garmin" vào nhóm, và việc cần làm là cập nhật thư viện rồi kết nối lại.
- Đăng nhập lần đầu cần mã MFA, nên chạy script `link_garmin` trên máy tính cá nhân. Sau đó token được mã hoá lưu trong Supabase và tự làm mới.
- Hệ thống không phải thiết bị y tế; mọi cảnh báo chỉ để tham khảo.

## Hai đường lấy dữ liệu

| Đường | Nhanh | Dữ liệu | Cần cài |
|---|---|---|---|
| **Ứng dụng đồng hồ** (`watch/`, Connect IQ) | ~5 phút | nhịp tim (chuỗi), bước, stress, Body Battery, SpO2, nhịp thở, pin | ứng dụng trên đồng hồ ba mẹ |
| **Garmin Connect** (`python-garminconnect`) | 10–60 phút | thêm giấc ngủ, SpO2 ban đêm, huyết áp máy Garmin, nhịp tim nghỉ | không, chỉ cần tài khoản |
| *Sau này:* ứng dụng điện thoại đọc Apple Health / Health Connect | 15–60 phút | cơ bản (bước, nhịp tim, giấc ngủ); dùng được cho **mọi hãng đồng hồ** | ứng dụng trên điện thoại |

Hai đường đầu chạy song song. Ứng dụng đồng hồ cho cảnh báo nhanh: nhịp tim cao/thấp kéo dài 10 phút (bỏ qua khi đang đi lại), đồng hồ ngừng gửi quá 30 phút, pin yếu. Garmin Connect bổ sung phần Garmin tính trên máy chủ. Đường thứ ba gửi vào cùng địa chỉ `/api/watch/push`, nên không phải làm lại phần máy chủ.

## Kiến trúc

```
Đồng hồ ─(ứng dụng Connect IQ, mỗi 5 phút, qua Bluetooth + điện thoại)─▶ POST /api/watch/push
Đồng hồ ─BT─▶ App Garmin Connect (điện thoại ba mẹ) ─▶ Máy chủ Garmin
                                                                  ▲
Supabase pg_cron ── mỗi 15 phút ─▶ POST /api/cron/sync ───────────┘ (python-garminconnect)
                 ── mỗi 5 phút  ─▶ POST /api/cron/tick: gửi/leo thang cảnh báo,
                                   nhắc thuốc, báo cáo sáng/tối
Telegram ──────── webhook ──────▶ POST /api/telegram/webhook: nút "Tôi xử lý",
                                   "Đã uống", lệnh /ba /me /tongquan, ba mẹ nhắn chỉ số
                 Vercel (Python, FastAPI)  ◀──▶  Supabase PostgreSQL  ◀──▶  Website (Next.js, Vercel)
```

Vì sao không dùng cron của Vercel: gói miễn phí (Hobby) chỉ chạy cron 1 lần/ngày, nên dùng pg_cron của Supabase gọi sang Vercel.

Leo thang cảnh báo (mức Cao/Khẩn cấp): gửi nhóm ngay → sau 10 phút chưa ai bấm "Tôi xử lý" thì nhắn riêng người ở gần nhất → sau 20 phút thì gọi điện (khi đã bật nhà cung cấp gọi). Giờ yên lặng 22:00–06:00 chỉ gửi cảnh báo Khẩn cấp.

## Cấu trúc mã nguồn

```
web/                      Website Next.js theo mockup
  app/page.tsx            Tổng quan gia đình
  app/nguoi-than/[id]/    Chi tiết một người: biểu đồ nhịp tim 24 giờ, giấc ngủ, bước chân, thuốc, cảnh báo
  app/cai-dat/            Cài đặt: bệnh nền, ngưỡng, thuốc, giờ báo cáo, tạo mã đồng hồ
  app/dang-nhap/          Đăng nhập bằng Telegram
  lib/demo.ts             Dữ liệu mẫu khi chưa có DATABASE_URL (chế độ demo để trình bày)
watch/                    Ứng dụng Connect IQ (Monkey C) gửi dữ liệu mỗi 5 phút — GitHub Actions tự build, xem watch/README.md
backend/
  api/index.py            FastAPI cho Vercel (cron + webhook Telegram)
  chamsoc/
    garmin_sync.py        đọc Garmin → Snapshot
    rules.py              ngưỡng cảnh báo + bộ ngưỡng mặc định theo bệnh nền
    escalation.py         giờ yên lặng, leo thang
    telegram.py           gửi tin, định dạng, đọc "130/85", "đường 7.2", "cân 58"
    calls.py              giao diện gọi điện (chưa bật)
    jobs.py               đồng bộ, tick, xử lý tin nhắn
    db.py                 truy vấn PostgreSQL
    link_garmin.py        CLI kết nối tài khoản Garmin (nhập MFA)
    watch_key.py          CLI tạo mã cho ứng dụng đồng hồ (hoặc tạo trên web)
    setup_family.py       CLI tạo gia đình từ file JSON
  tests/                  kiểm thử (logic + luồng đầy đủ trên PostgreSQL thật)
supabase/
  migrations/             lược đồ (chạy theo thứ tự tên file)
  cron.sql                lịch pg_cron
```

## Cài đặt (khi đã có đồng hồ)

1. **Supabase:** tạo project (chọn vùng Singapore), chạy lần lượt các file trong `supabase/migrations/` trong SQL Editor.
2. **Telegram:** tạo bot với @BotFather, thêm bot vào nhóm gia đình. Gõ `/id` trong nhóm và trong tin riêng với bot để lấy `chat_id`/`user_id` của từng người. Ba mẹ cần bấm Start với bot một lần.
3. **Vercel:** tạo **2 project** từ cùng repo:
   - Root Directory `backend` (máy chủ Python), biến môi trường theo `backend/.env.example`.
   - Root Directory `web` (website), biến môi trường theo `web/.env.example`. Để trống `DATABASE_URL` thì website chạy **chế độ demo** với dữ liệu mẫu, tiện để trình bày.
   - Đặt domain website cho bot: @BotFather → `/setdomain` (cần cho nút "Đăng nhập bằng Telegram").
4. **Webhook Telegram:**
   `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<app>.vercel.app/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>`
5. **Gia đình:** sao chép `backend/family.example.json` thành `family.json`, sửa lại cho đúng, rồi chạy:
   ```bash
   cd backend && pip install -e . && export DATABASE_URL=...
   python -m chamsoc.setup_family ../family.json
   TOKEN_ENCRYPTION_KEY=... python -m chamsoc.link_garmin --elder <id in ra ở bước trên>
   ```
6. **Lịch chạy:** làm theo `supabase/cron.sql`.
7. **Ứng dụng đồng hồ:** trên website vào Cài đặt → "Tạo mã cho đồng hồ", rồi làm theo `watch/README.md` để build, cài và nhập địa chỉ máy chủ + mã.

## Chạy kiểm thử

```bash
uv venv -p 3.12 .venv && uv pip install -p .venv -e "backend[dev]"
cd backend && ../.venv/bin/pytest                                   # kiểm thử logic
TEST_DATABASE_URL=postgresql://localhost/chamsoc_test ../.venv/bin/pytest   # thêm luồng DB (xoá sạch DB đó)
cd ../web && npm install && npm run typecheck && npm run build              # website
npm run dev                                                                 # xem ở chế độ demo: http://localhost:3000
```

## Việc tiếp theo

- [x] Build ứng dụng đồng hồ (GitHub Actions, 6 dòng máy).
- [ ] Chạy thử ứng dụng đồng hồ trên đồng hồ thật.
- [ ] Đưa ứng dụng đồng hồ lên Connect IQ Store dạng beta để chỉnh cài đặt từ điện thoại.
- [ ] Thử với tài khoản Garmin thật, chỉnh lại tên trường dữ liệu nếu khác.
- [ ] Báo cáo tuần kèm ảnh biểu đồ, tóm tắt bằng AI.
- [ ] Ngưỡng cá nhân hoá theo đường nền 14 ngày.
- [ ] Tích hợp nhà cung cấp gọi điện (Stringee hoặc Twilio) vào `calls.py`.
- [ ] Đăng ký Garmin Connect Developer Program (Health API chính thức) khi mở cho người khác.
- [ ] Ứng dụng điện thoại đọc Apple Health / Health Connect cho người dùng đồng hồ hãng khác.
