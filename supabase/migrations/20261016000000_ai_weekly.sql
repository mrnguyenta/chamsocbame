-- AI hỏi đáp và báo cáo tuần (sáng Chủ nhật).
-- Khoá API Claude nhập ở trang /quan-tri, lưu trong app_settings (key 'anthropic_api_key').

alter table families add column if not exists last_weekly_report_on date;

-- Báo cáo tuần đã tạo: số liệu tổng hợp (data) và nhận xét của AI (ai, có thể trống nếu chưa có khoá).
create table if not exists weekly_reports (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  week_start  date not null,
  week_end    date not null,
  data        jsonb not null,
  ai          jsonb,
  created_at  timestamptz not null default now(),
  unique (family_id, week_end)
);
create index if not exists weekly_reports_family on weekly_reports (family_id, week_end desc);

-- Đếm câu hỏi AI mỗi ngày của từng gia đình, để chặn dùng quá tay (tốn phí API).
create table if not exists ai_usage (
  family_id  uuid not null references families(id) on delete cascade,
  day        date not null,
  questions  int not null default 0,
  primary key (family_id, day)
);

alter table weekly_reports enable row level security;
alter table ai_usage enable row level security;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'chamsoc_app') then
    grant select, insert, update, delete on weekly_reports, ai_usage to chamsoc_app;
  end if;
end $$;
revoke all on weekly_reports, ai_usage from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on weekly_reports, ai_usage from anon, authenticated;
  end if;
end $$;
