-- Liên kết Garmin Connect ngay trên website. Máy chủ đăng nhập Garmin; nếu Garmin hỏi mã xác thực (MFA),
-- website ghi mã người dùng nhập vào đây và máy chủ (đang chờ trong cùng lượt đăng nhập) đọc ra.
-- Mật khẩu Garmin không được lưu; chỉ lưu token đã mã hoá trong garmin_accounts.
create table garmin_link_requests (
  id          uuid primary key default gen_random_uuid(),
  elder_id    uuid not null references elders(id) on delete cascade,
  status      text not null default 'starting'
              check (status in ('starting', 'awaiting_mfa', 'checking_code', 'wrong_code', 'done', 'failed', 'expired')),
  mfa_code    text,
  message     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table garmin_link_requests enable row level security;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'chamsoc_app') then
    grant select, insert, update, delete on garmin_link_requests to chamsoc_app;
  end if;
end $$;
revoke all on garmin_link_requests from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on garmin_link_requests from anon, authenticated;
  end if;
end $$;
