-- Đăng nhập website bằng email + mật khẩu. Telegram chỉ còn để bot gửi thông báo.
-- Một tài khoản có thể ở nhiều gia đình (mỗi gia đình một dòng caregivers trỏ về account_id).
create table accounts (
  id               uuid primary key default gen_random_uuid(),
  email            text not null unique check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  name             text not null,
  password_hash    text not null,
  -- Quản trị hệ thống: trang /quan-tri (bot Telegram, link Store, danh sách tài khoản).
  is_system_admin  boolean not null default false,
  created_at       timestamptz not null default now(),
  last_login_at    timestamptz
);
alter table accounts enable row level security;

alter table caregivers add column account_id uuid references accounts(id) on delete cascade;
alter table caregivers add column email text;
create unique index caregivers_family_account on caregivers (family_id, account_id);

-- Mã 6 số để mỗi người chăm sóc nối Telegram riêng (nhận leo thang cảnh báo, bấm "Tôi xử lý").
alter table link_codes add column caregiver_id uuid references caregivers(id) on delete cascade;
alter table link_codes drop constraint link_codes_kind_check;
alter table link_codes drop constraint link_codes_check;
alter table link_codes add constraint link_codes_kind_check check (kind in ('group', 'elder', 'caregiver'));
alter table link_codes add constraint link_codes_target_check check (
  kind = 'group' or (kind = 'elder' and elder_id is not null) or (kind = 'caregiver' and caregiver_id is not null));

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'chamsoc_app') then
    grant select, insert, update, delete on accounts to chamsoc_app;
  end if;
end $$;
revoke all on accounts from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on accounts from anon, authenticated;
  end if;
end $$;
