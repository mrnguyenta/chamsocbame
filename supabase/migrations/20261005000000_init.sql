-- Chăm Sóc Ba Mẹ: lược đồ ban đầu.
-- Backend (Vercel) kết nối bằng chuỗi DATABASE_URL của Supabase với quyền postgres,
-- nên bỏ qua RLS. Bật RLS và không tạo policy => khoá API công khai (anon) không đọc được gì.

create extension if not exists pgcrypto;

-- Một gia đình = một nhóm Telegram chung.
create table families (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  telegram_chat_id  bigint unique,
  timezone          text not null default 'Asia/Ho_Chi_Minh',
  quiet_start       time not null default '22:00',
  quiet_end         time not null default '06:00',
  morning_report_at time not null default '07:30',
  evening_report_at time default '21:00',
  last_morning_report_on date,
  last_evening_report_on date,
  created_at        timestamptz not null default now()
);

-- Con cháu / người chăm sóc.
create table caregivers (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references families(id) on delete cascade,
  display_name      text not null,
  telegram_user_id  bigint,
  phone             text,
  role              text not null default 'alerts'
                    check (role in ('admin', 'alerts', 'reports')),
  -- Thứ tự liên hệ khi leo thang (1 = người ở gần nhất).
  escalation_order  int,
  created_at        timestamptz not null default now(),
  unique (family_id, telegram_user_id)
);

-- Ba mẹ / người thân được theo dõi.
create table elders (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references families(id) on delete cascade,
  display_name      text not null,          -- "Ba Hùng", "Mẹ Lan"
  command           text,                   -- lệnh Telegram, ví dụ "ba" => /ba
  birth_year        int,
  conditions        text[] not null default '{}',  -- {'tang_huyet_ap','tieu_duong','tim_mach'}
  telegram_user_id  bigint,                 -- ba mẹ cũng dùng Telegram
  created_at        timestamptz not null default now(),
  unique (family_id, command)
);

-- Token Garmin (đã mã hoá). Không bao giờ lưu mật khẩu.
create table garmin_accounts (
  elder_id              uuid primary key references elders(id) on delete cascade,
  token_ciphertext      text not null,
  status                text not null default 'ok'
                        check (status in ('ok', 'needs_relogin', 'error')),
  last_sync_at          timestamptz,
  last_device_upload_at timestamptz,
  last_error            text,
  updated_at            timestamptz not null default now()
);

-- Tổng hợp theo ngày, cập nhật mỗi lần đồng bộ.
create table daily_metrics (
  elder_id           uuid not null references elders(id) on delete cascade,
  day                date not null,
  resting_hr         int,
  max_hr             int,
  min_hr             int,
  steps              int,
  sleep_seconds      int,
  deep_sleep_seconds int,
  sleep_score        int,
  spo2_avg           int,
  spo2_min           int,
  body_battery       int,
  stress_avg         int,
  respiration_avg    numeric(4,1),
  raw                jsonb not null default '{}',
  updated_at         timestamptz not null default now(),
  primary key (elder_id, day)
);

-- Chỉ số nhập tay hoặc từ thiết bị khác: huyết áp, đường huyết, cân nặng.
create table readings (
  id          uuid primary key default gen_random_uuid(),
  elder_id    uuid not null references elders(id) on delete cascade,
  kind        text not null check (kind in ('blood_pressure', 'glucose', 'weight')),
  systolic    int,
  diastolic   int,
  pulse       int,
  value       numeric(6,2),         -- đường huyết (mmol/L) hoặc cân nặng (kg)
  measured_at timestamptz not null default now(),
  source      text not null default 'telegram'
              check (source in ('telegram', 'web', 'garmin', 'import')),
  external_id text,                 -- chống trùng khi nhập từ Garmin
  note        text,
  unique (elder_id, source, external_id)
);
create index readings_elder_time on readings (elder_id, kind, measured_at desc);

-- Ngưỡng cảnh báo riêng cho từng người.
create table alert_rules (
  id           uuid primary key default gen_random_uuid(),
  elder_id     uuid not null references elders(id) on delete cascade,
  metric       text not null check (metric in (
                 'resting_hr', 'spo2_min', 'sleep_hours', 'steps', 'body_battery',
                 'stress_avg', 'no_sync_hours', 'systolic', 'diastolic', 'glucose')),
  comparator   text not null check (comparator in ('gt', 'lt')),
  threshold    numeric not null,
  severity     text not null default 'warn'
               check (severity in ('info', 'warn', 'high', 'urgent')),
  -- Chỉ kiểm tra sau giờ này (giờ địa phương), ví dụ "ít bước chân" sau 18:00.
  active_after time,
  -- 'family' = nhóm Telegram, 'elder' = nhắn riêng ba mẹ (nhắc nhở nhẹ).
  notify       text not null default 'family' check (notify in ('family', 'elder')),
  enabled      boolean not null default true,
  created_at   timestamptz not null default now()
);

create table alerts (
  id               uuid primary key default gen_random_uuid(),
  elder_id         uuid not null references elders(id) on delete cascade,
  rule_id          uuid references alert_rules(id) on delete set null,
  dedupe_key       text not null,
  metric           text not null,
  value            numeric,
  severity         text not null,
  message          text not null,
  opened_at        timestamptz not null default now(),
  notified_at      timestamptz,
  acked_by         uuid references caregivers(id) on delete set null,
  acked_at         timestamptz,
  snoozed_until    timestamptz,
  resolved_at      timestamptz,
  escalation_step  int not null default 0
);
-- Mỗi điều kiện chỉ có một cảnh báo đang mở.
create unique index alerts_one_open on alerts (dedupe_key) where resolved_at is null;
create index alerts_elder_time on alerts (elder_id, opened_at desc);

-- Lịch uống thuốc và nhật ký.
create table med_schedules (
  id         uuid primary key default gen_random_uuid(),
  elder_id   uuid not null references elders(id) on delete cascade,
  name       text not null,       -- "Amlodipine 5mg"
  note       text,                -- "sau ăn sáng"
  times      time[] not null,     -- {07:00, 19:00}
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table med_logs (
  id           uuid primary key default gen_random_uuid(),
  schedule_id  uuid not null references med_schedules(id) on delete cascade,
  due_at       timestamptz not null,
  reminded_at  timestamptz,
  taken_at     timestamptz,
  unique (schedule_id, due_at)
);

-- Nhật ký cuộc gọi tự động (khi tích hợp nhà cung cấp gọi điện).
create table call_logs (
  id           uuid primary key default gen_random_uuid(),
  alert_id     uuid references alerts(id) on delete cascade,
  caregiver_id uuid references caregivers(id) on delete set null,
  provider     text not null,
  status       text not null,
  detail       text,
  created_at   timestamptz not null default now()
);

alter table families        enable row level security;
alter table caregivers      enable row level security;
alter table elders          enable row level security;
alter table garmin_accounts enable row level security;
alter table daily_metrics   enable row level security;
alter table readings        enable row level security;
alter table alert_rules     enable row level security;
alter table alerts          enable row level security;
alter table med_schedules   enable row level security;
alter table med_logs        enable row level security;
alter table call_logs       enable row level security;
