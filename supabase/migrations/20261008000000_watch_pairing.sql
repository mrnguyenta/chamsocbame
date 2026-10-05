-- Ghép đồng hồ bằng mã 6 số (giống ghép TV với tài khoản):
-- 1. Ứng dụng trên đồng hồ gọi /api/watch/pair/start, nhận mã 6 số + khoá bí mật (chỉ lưu bản băm).
-- 2. Đồng hồ hiện mã; con cháu nhập mã trên website và chọn người thân.
-- 3. Website tạo watch_devices với đúng bản băm khoá đó; đồng hồ hỏi /api/watch/pair/status,
--    thấy "paired" thì bắt đầu gửi dữ liệu bằng khoá của mình.
create table watch_pairings (
  id          uuid primary key default gen_random_uuid(),
  code        text not null check (code ~ '^[0-9]{6}$'),
  key_hash    text not null unique,
  device      text,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '15 minutes',
  claimed_at  timestamptz,
  device_id   uuid references watch_devices(id) on delete set null
);
-- Một mã chỉ thuộc về một lần ghép đang chờ.
create unique index watch_pairings_open_code on watch_pairings (code) where claimed_at is null;

alter table watch_pairings enable row level security;
