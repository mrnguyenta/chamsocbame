-- Dữ liệu gần thời gian thực: ứng dụng Connect IQ trên đồng hồ gửi thẳng về mỗi 5 phút
-- (qua Bluetooth tới điện thoại), không chờ Garmin Connect đồng bộ lên đám mây.

-- Mỗi đồng hồ có một mã riêng; chỉ lưu bản băm sha256 của mã.
create table watch_devices (
  id            uuid primary key default gen_random_uuid(),
  elder_id      uuid not null references elders(id) on delete cascade,
  key_hash      text not null unique,
  label         text,
  last_seen_at  timestamptz,
  battery       int,
  charging      boolean,
  created_at    timestamptz not null default now()
);

-- Trạng thái mới nhất của mỗi người (ghi đè mỗi lần đồng hồ gửi).
create table live_status (
  elder_id      uuid primary key references elders(id) on delete cascade,
  measured_at   timestamptz not null,
  received_at   timestamptz not null default now(),
  hr            int,
  resting_hr    int,
  steps         int,
  stress        int,
  body_battery  int,
  spo2          int,
  respiration   int,
  battery       int,
  charging      boolean
);

-- Nhịp tim theo thời gian (vẽ biểu đồ, tính nhịp tim kéo dài).
create table hr_samples (
  elder_id  uuid not null references elders(id) on delete cascade,
  ts        timestamptz not null,
  bpm       int not null check (bpm between 20 and 250),
  source    text not null default 'watch' check (source in ('watch', 'garmin')),
  primary key (elder_id, ts)
);

-- Bước chân theo thời gian, để biết vừa vận động (tránh báo nhịp tim cao khi đang đi bộ).
create table step_samples (
  elder_id  uuid not null references elders(id) on delete cascade,
  ts        timestamptz not null,
  steps     int not null,
  primary key (elder_id, ts)
);

alter table alert_rules drop constraint alert_rules_metric_check;
alter table alert_rules add constraint alert_rules_metric_check check (metric in (
  'resting_hr', 'spo2_min', 'sleep_hours', 'steps', 'body_battery', 'stress_avg',
  'no_sync_hours', 'systolic', 'diastolic', 'glucose',
  'hr_now', 'no_live_minutes', 'watch_battery'));

alter table watch_devices enable row level security;
alter table live_status   enable row level security;
alter table hr_samples    enable row level security;
alter table step_samples  enable row level security;
