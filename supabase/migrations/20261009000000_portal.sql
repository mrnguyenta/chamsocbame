-- Cổng tự phục vụ: ai cũng tạo được gia đình, mời anh chị em, thêm ba mẹ, nối Telegram.

-- Link mời người chăm sóc vào gia đình (dùng nhiều lần đến khi hết hạn hoặc bị thu hồi).
create table invites (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  code        text not null unique check (code ~ '^[a-z0-9]{10}$'),
  role        text not null default 'alerts' check (role in ('admin', 'alerts', 'reports')),
  created_by  uuid references caregivers(id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '7 days',
  revoked_at  timestamptz
);

-- Mã 6 số để nối Telegram: nhóm gia đình (/ketnoi) hoặc tài khoản của ba mẹ (/toi).
create table link_codes (
  code        text primary key check (code ~ '^[0-9]{6}$'),
  family_id   uuid not null references families(id) on delete cascade,
  kind        text not null check (kind in ('group', 'elder')),
  elder_id    uuid references elders(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '30 minutes',
  used_at     timestamptz,
  check (kind = 'group' or elder_id is not null)
);

alter table caregivers add column telegram_name text;

alter table invites    enable row level security;
alter table link_codes enable row level security;

-- Bộ ngưỡng gợi ý cho người cao tuổi; chỉ thêm ngưỡng còn thiếu (gọi lại khi đổi bệnh nền).
-- Giữ khớp với backend/chamsoc/rules.py default_rules().
create or replace function chamsoc_ensure_default_rules(p_elder uuid, p_conditions text[])
returns integer
language plpgsql
set search_path = public
as $$
declare
  n integer := 0;
  r record;
  heart boolean := p_conditions && array['tang_huyet_ap', 'tim_mach'];
  diabetes boolean := p_conditions && array['tieu_duong'];
begin
  for r in
    select * from (values
      ('resting_hr',      'gt', 90::numeric, 'high',   null::time, 'family', true,  true),
      ('resting_hr',      'lt', 45,          'high',   null,       'family', true,  true),
      ('spo2_min',        'lt', 90,          'high',   null,       'family', true,  true),
      ('no_sync_hours',   'gt', 12,          'warn',   null,       'family', true,  true),
      ('hr_now',          'gt', 120,         'high',   null,       'family', true,  true),
      ('hr_now',          'lt', 40,          'urgent', null,       'family', true,  true),
      ('no_live_minutes', 'gt', 30,          'warn',   null,       'family', true,  true),
      ('watch_battery',   'lt', 15,          'info',   null,       'elder',  true,  true),
      ('sleep_hours',     'lt', 5,           'warn',   '10:00',    'family', true,  true),
      ('steps',           'lt', 1000,        'info',   '18:00',    'elder',  true,  true),
      ('body_battery',    'lt', 15,          'warn',   null,       'family', false, true),
      ('stress_avg',      'gt', 60,          'warn',   null,       'family', false, true),
      ('systolic',        'gt', 160,         'high',   null,       'family', true,  heart),
      ('systolic',        'lt', 90,          'high',   null,       'family', true,  heart),
      ('diastolic',       'gt', 100,         'high',   null,       'family', true,  heart),
      ('glucose',         'gt', 13.9,        'high',   null,       'family', true,  diabetes),
      ('glucose',         'lt', 3.9,         'urgent', null,       'family', true,  diabetes)
    ) as v(metric, comparator, threshold, severity, active_after, notify, enabled, applies)
  loop
    if r.applies and not exists (
      select 1 from alert_rules a
      where a.elder_id = p_elder and a.metric = r.metric and a.comparator = r.comparator
    ) then
      insert into alert_rules (elder_id, metric, comparator, threshold, severity, active_after, notify, enabled)
      values (p_elder, r.metric, r.comparator, r.threshold, r.severity, r.active_after, r.notify, r.enabled);
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;
