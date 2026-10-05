-- Thêm chỉ số từ đồng hồ (calo, quãng đường, tầng, phút vận động, thanh ngồi yên, căng thẳng 1 giờ)
-- và ba cảnh báo mới: ngồi/nằm im lâu, không đeo đồng hồ, căng thẳng cao kéo dài.
alter table live_status
  add column if not exists calories   int,
  add column if not exists distance_m int,
  add column if not exists floors     int,
  add column if not exists active_min int,
  add column if not exists move_bar   int,
  add column if not exists stress_1h  int;

-- HRV đêm qua (từ Garmin Connect).
alter table daily_metrics add column if not exists hrv_last_night int;

alter table alert_rules drop constraint alert_rules_metric_check;
alter table alert_rules add constraint alert_rules_metric_check check (metric in (
  'resting_hr', 'spo2_min', 'sleep_hours', 'steps', 'body_battery', 'stress_avg',
  'no_sync_hours', 'systolic', 'diastolic', 'glucose',
  'hr_now', 'no_live_minutes', 'watch_battery',
  'inactive_minutes', 'not_worn_minutes', 'stress_1h'));

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
      ('resting_hr',       'gt', 90::numeric, 'high',   null::time, 'family', true,  true),
      ('resting_hr',       'lt', 45,          'high',   null,       'family', true,  true),
      ('spo2_min',         'lt', 90,          'high',   null,       'family', true,  true),
      ('no_sync_hours',    'gt', 12,          'warn',   null,       'family', true,  true),
      ('hr_now',           'gt', 120,         'high',   null,       'family', true,  true),
      ('hr_now',           'lt', 40,          'urgent', null,       'family', true,  true),
      ('no_live_minutes',  'gt', 30,          'warn',   null,       'family', true,  true),
      ('watch_battery',    'lt', 15,          'info',   null,       'elder',  true,  true),
      ('inactive_minutes', 'gt', 180,         'warn',   null,       'family', true,  true),
      ('not_worn_minutes', 'gt', 90,          'info',   null,       'family', true,  true),
      ('stress_1h',        'gt', 80,          'warn',   null,       'family', true,  true),
      ('sleep_hours',      'lt', 5,           'warn',   '10:00',    'family', true,  true),
      ('steps',            'lt', 1000,        'info',   '18:00',    'elder',  true,  true),
      ('body_battery',     'lt', 15,          'warn',   null,       'family', false, true),
      ('stress_avg',       'gt', 60,          'warn',   null,       'family', false, true),
      ('systolic',         'gt', 160,         'high',   null,       'family', true,  heart),
      ('systolic',         'lt', 90,          'high',   null,       'family', true,  heart),
      ('diastolic',        'gt', 100,         'high',   null,       'family', true,  heart),
      ('glucose',          'gt', 13.9,        'high',   null,       'family', true,  diabetes),
      ('glucose',          'lt', 3.9,         'urgent', null,       'family', true,  diabetes)
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

-- Người thân đã có: thêm các ngưỡng mới.
select chamsoc_ensure_default_rules(id, conditions) from elders;
