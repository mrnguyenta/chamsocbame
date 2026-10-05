-- Cấu hình chung của hệ thống, sửa từ trang /quan-tri (ví dụ token và username bot Telegram).
-- Không mở cho API công khai: RLS bật, không có policy; chỉ vai trò chamsoc_app đọc/ghi.
create table app_settings (
  key         text primary key check (key ~ '^[a-z_]{1,64}$'),
  value       text not null,
  updated_at  timestamptz not null default now()
);
alter table app_settings enable row level security;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'chamsoc_app') then
    grant select, insert, update, delete on app_settings to chamsoc_app;
  end if;
end $$;
revoke all on app_settings from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on app_settings from anon, authenticated;
  end if;
end $$;
