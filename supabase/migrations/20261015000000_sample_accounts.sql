-- Tài khoản mẫu: nút "Xem tài khoản mẫu" ở trang đăng nhập (cho người duyệt Garmin và người muốn xem thử).
-- Mỗi lần bấm tạo một gia đình riêng có dữ liệu mẫu, tự xoá sau 24 giờ.
-- Người xem có thể nhập mã đồng hồ thật vào đó; không ai khác thấy gia đình này.
-- Xoá khi hết hạn: website (lúc tạo mẫu mới, lúc thoát) và backend (mỗi lần /api/cron/tick).
alter table accounts add column if not exists is_sample boolean not null default false;
alter table accounts add column if not exists expires_at timestamptz;
alter table families add column if not exists expires_at timestamptz;

create or replace function chamsoc_create_sample(p_name text default 'Khách')
returns uuid
language plpgsql
set search_path = public
as $$
declare
  tz constant text := 'Asia/Ho_Chi_Minh';
  exp constant timestamptz := now() + interval '24 hours';
  today date := (now() at time zone tz)::date;
  -- Phần ngày đã qua (6 giờ sáng → 21 giờ tối), để bước chân, calo hợp với giờ xem.
  frac numeric := least(1, greatest(0.05, (extract(epoch from (now() at time zone tz)::time) / 3600 - 6) / 15));
  acc uuid; fam uuid; me uuid; hanh uuid; ba uuid; lan uuid; tu uuid;
  s_amlo uuid; s_met uuid; s_biso uuid;
  ba_steps int; lan_steps int;
  sleep_dto jsonb;
  i int;
begin
  if (select count(*) from families where expires_at > now()) >= 300 then
    raise exception 'too_many_samples';
  end if;

  insert into accounts (name, email, password_hash, is_sample, expires_at, last_login_at)
  values (coalesce(nullif(trim(p_name), ''), 'Khách'), 'mau-' || md5(random()::text || clock_timestamp()::text) || '@mau.invalid',
          '!', true, exp, now())
  returning id into acc;

  insert into families (name, expires_at) values ('Gia đình mẫu', exp) returning id into fam;
  insert into caregivers (family_id, display_name, account_id, role, escalation_order)
  values (fam, coalesce(nullif(trim(p_name), ''), 'Khách'), acc, 'admin', 1) returning id into me;
  insert into caregivers (family_id, display_name, role, escalation_order)
  values (fam, 'Chị Hạnh', 'alerts', 2) returning id into hanh;
  insert into caregivers (family_id, display_name, role, escalation_order) values (fam, 'Anh Tú', 'reports', 3);

  insert into elders (family_id, display_name, command, birth_year, conditions)
  values (fam, 'Ba Hùng', 'ba', 1955, '{tang_huyet_ap,tieu_duong}') returning id into ba;
  insert into elders (family_id, display_name, command, birth_year, conditions)
  values (fam, 'Mẹ Lan', 'me', 1959, '{tim_mach}') returning id into lan;
  insert into elders (family_id, display_name, command, birth_year, conditions)
  values (fam, 'Bà ngoại Tư', 'ngoai', 1942, '{tang_huyet_ap}') returning id into tu;
  perform chamsoc_ensure_default_rules(ba, '{tang_huyet_ap,tieu_duong}');
  perform chamsoc_ensure_default_rules(lan, '{tim_mach}');
  perform chamsoc_ensure_default_rules(tu, '{tang_huyet_ap}');

  -- Đồng hồ (mã giả, không đồng hồ thật nào dùng được).
  insert into watch_devices (elder_id, key_hash, label, last_seen_at, battery, charging) values
    (ba,  'sample-' || md5(random()::text || ba::text),  'Venu 3',       now() - interval '4 minutes', 64, false),
    (lan, 'sample-' || md5(random()::text || lan::text), 'vívoactive 5', now() - interval '2 minutes', 38, false);

  ba_steps := round(6800 * frac);
  lan_steps := round(2900 * frac);
  insert into live_status (elder_id, measured_at, received_at, hr, resting_hr, steps, stress, body_battery, spo2,
                           respiration, battery, charging, calories, distance_m, floors, active_min, move_bar, stress_1h) values
    (ba,  now() - interval '4 minutes', now() - interval '4 minutes', 68, 62, ba_steps, 28, 45, 95, 15, 64, false,
     round(1100 + 700 * frac), round(ba_steps * 0.62), 4, round(32 * frac), 0, 30),
    (lan, now() - interval '2 minutes', now() - interval '2 minutes', 96, 98, lan_steps, 52, 18, 93, 17, 38, false,
     round(950 + 350 * frac), round(lan_steps * 0.55), 1, round(9 * frac), 2, 55);

  -- Nhịp tim 24 giờ, mỗi 5 phút: ngủ thấp hơn, đi bộ 17–18 giờ, Mẹ Lan có một lần tim nhanh khoảng 90 phút trước.
  insert into hr_samples (elder_id, ts, bpm)
  select v.e, g.ts, greatest(40, least(170, round(
           case when g.h < 6 or g.h >= 22 then v.base - 8 + 3 * sin(g.k / 7.0) else v.base + 8 * sin(g.k / 11.0) end
           + case when g.h >= 17 and g.h < 18 then 28 else 0 end
           + case when v.spike and g.ts between now() - interval '110 minutes' and now() - interval '70 minutes' then 24 else 0 end)))::int
  from (values (ba, 66, false), (lan, 86, true)) v(e, base, spike)
  cross join lateral (
    select ts, extract(epoch from ts) / 300 as k, extract(epoch from (ts at time zone tz)::time) / 3600 as h
    from generate_series(now() - interval '24 hours', now() - interval '3 minutes', interval '5 minutes') ts) g;

  -- Bước chân cộng dồn trong ngày, mỗi 15 phút.
  insert into step_samples (elder_id, ts, steps)
  select v.e, ts, round(v.total * least(1, greatest(0, (extract(epoch from (ts at time zone tz)::time) / 3600 - 6) / 15)))::int
  from (values (ba, 6800), (lan, 2900)) v(e, total)
  cross join generate_series(now() - interval '24 hours', now() - interval '4 minutes', interval '15 minutes') ts;

  -- 14 ngày tổng hợp. Bà ngoại Tư ngừng đồng bộ từ 2 ngày trước.
  for i in 0..13 loop
    sleep_dto := jsonb_build_object('sleep', jsonb_build_object('dailySleepDTO', jsonb_build_object(
      'sleepTimeSeconds', 24000 + round(1500 * sin(i)), 'deepSleepSeconds', 4200, 'lightSleepSeconds', 12300 + round(1500 * sin(i)),
      'remSleepSeconds', 5100, 'awakeSleepSeconds', 2400)));
    insert into daily_metrics (elder_id, day, resting_hr, max_hr, min_hr, steps, sleep_seconds, deep_sleep_seconds, sleep_score,
                               spo2_avg, spo2_min, body_battery, stress_avg, respiration_avg, hrv_last_night, raw)
    values (ba, today - i, 60 + i % 4, 118 + i % 7, 52, case when i = 0 then ba_steps when i = 5 then 860 else round(5600 + 1500 * sin(i * 1.3)) end,
            24000 + round(1500 * sin(i)), 4200, 72 - i % 6, 95, 92 + i % 3, 45 + round(10 * sin(i)), 31 + round(5 * sin(i)), 14.5,
            38 + round(3 * sin(i)), sleep_dto);
    sleep_dto := jsonb_build_object('sleep', jsonb_build_object('dailySleepDTO', jsonb_build_object(
      'sleepTimeSeconds', case when i = 0 then 17700 else 22000 + round(1200 * sin(i)) end, 'deepSleepSeconds', 2400,
      'lightSleepSeconds', case when i = 0 then 10500 else 14000 + round(1200 * sin(i)) end, 'remSleepSeconds', 4800,
      'awakeSleepSeconds', 3000)));
    insert into daily_metrics (elder_id, day, resting_hr, max_hr, min_hr, steps, sleep_seconds, deep_sleep_seconds, sleep_score,
                               spo2_avg, spo2_min, body_battery, stress_avg, respiration_avg, hrv_last_night, raw)
    values (lan, today - i, case when i = 0 then 98 else 74 + i % 5 end, 126, 60,
            case when i = 0 then lan_steps else round(2800 + 1000 * sin(i * 1.7)) end,
            case when i = 0 then 17700 else 22000 + round(1200 * sin(i)) end, 2400, case when i = 0 then 51 else 66 - i % 5 end,
            95, 93, case when i = 0 then 18 else 40 + round(8 * sin(i)) end, case when i = 0 then 48 else 35 + i % 4 end, 16.0,
            case when i = 0 then 24 else 32 + i % 3 end, sleep_dto);
    if i >= 2 then
      insert into daily_metrics (elder_id, day, resting_hr, steps, sleep_seconds, deep_sleep_seconds, sleep_score,
                                 spo2_min, body_battery, stress_avg)
      values (tu, today - i, 70 + i % 3, round(3000 + 800 * sin(i)), 25000, 3600, 68, 93, 50, 30);
    end if;
  end loop;

  insert into readings (elder_id, kind, systolic, diastolic, pulse, value, measured_at, source) values
    (ba,  'blood_pressure', 132, 84, 70,   null, now() - interval '60 minutes', 'web'),
    (ba,  'glucose',        null, null, null, 7.2, now() - interval '58 minutes', 'telegram'),
    (ba,  'blood_pressure', 145, 90, 74,   null, now() - interval '25 hours', 'telegram'),
    (ba,  'blood_pressure', 165, 101, 78,  null, now() - interval '3 days', 'telegram'),
    (lan, 'blood_pressure', 128, 80, 92,   null, now() - interval '3 hours', 'web');

  insert into med_schedules (elder_id, name, note, times) values (ba, 'Amlodipine 5mg', 'huyết áp, sau ăn sáng', '{07:00}')
    returning id into s_amlo;
  insert into med_schedules (elder_id, name, note, times) values (ba, 'Metformin 500mg', 'sau ăn', '{07:00,19:00}')
    returning id into s_met;
  insert into med_schedules (elder_id, name, note, times) values (lan, 'Bisoprolol 2.5mg', 'tim mạch, buổi sáng', '{08:00}')
    returning id into s_biso;
  -- Hôm nay: Amlodipine và Bisoprolol đã uống, Metformin sáng chưa uống.
  insert into med_logs (schedule_id, due_at, reminded_at, taken_at)
  select s, d, d, d + interval '4 minutes'
  from (values (s_amlo, (today + time '07:00') at time zone tz), (s_biso, (today + time '08:00') at time zone tz)) v(s, d)
  where d < now();
  insert into med_logs (schedule_id, due_at, reminded_at)
  select s_met, d, d from (values ((today + time '07:00') at time zone tz)) v(d) where d < now();

  -- Cảnh báo: khoá trùng giống backend (id quy tắc:ngày) để lần kiểm tra tự động không tạo thêm bản sao.
  insert into alerts (elder_id, rule_id, dedupe_key, metric, value, severity, message, opened_at, notified_at, acked_by, acked_at)
  select lan, r.id, r.id::text || ':' || today, 'resting_hr', 98, 'high', 'Nhịp tim nghỉ 98 bpm (ngưỡng > 90 bpm)',
         now() - interval '90 minutes', now() - interval '90 minutes', hanh, now() - interval '84 minutes'
  from alert_rules r where r.elder_id = lan and r.metric = 'resting_hr' and r.comparator = 'gt';
  insert into alerts (elder_id, rule_id, dedupe_key, metric, value, severity, message, opened_at, notified_at)
  select tu, r.id, r.id::text || ':' || today, 'no_sync_hours', 50, 'warn', 'Garmin Connect chưa đồng bộ 50 giờ (ngưỡng > 12 giờ)',
         now() - interval '14 hours', now() - interval '14 hours'
  from alert_rules r where r.elder_id = tu and r.metric = 'no_sync_hours';
  insert into alerts (elder_id, rule_id, dedupe_key, metric, value, severity, message, opened_at, notified_at, acked_by, acked_at, resolved_at)
  select ba, r.id, r.id::text || ':' || (today - 3), 'systolic', 165, 'high', 'Huyết áp tâm thu 165 mmHg (ngưỡng > 160 mmHg)',
         now() - interval '3 days', now() - interval '3 days', me, now() - interval '3 days' + interval '6 minutes',
         now() - interval '3 days' + interval '2 hours'
  from alert_rules r where r.elder_id = ba and r.metric = 'systolic' and r.comparator = 'gt';
  insert into alerts (elder_id, rule_id, dedupe_key, metric, value, severity, message, opened_at, notified_at, resolved_at)
  select ba, r.id, r.id::text || ':' || (today - 5), 'steps', 860, 'info', 'Bước chân 860 bước (ngưỡng < 1.000 bước)',
         now() - interval '5 days', now() - interval '5 days', now() - interval '4 days' - interval '14 hours'
  from alert_rules r where r.elder_id = ba and r.metric = 'steps';
  insert into alerts (elder_id, rule_id, dedupe_key, metric, value, severity, message, opened_at, notified_at, acked_by, acked_at, resolved_at)
  select lan, r.id, r.id::text || ':sample', 'stress_1h', 84, 'warn', 'Căng thẳng 1 giờ qua 84 (ngưỡng > 80)',
         now() - interval '26 hours', now() - interval '26 hours', hanh, now() - interval '25 hours', now() - interval '24 hours'
  from alert_rules r where r.elder_id = lan and r.metric = 'stress_1h';

  return acc;
end $$;

revoke all on function chamsoc_create_sample(text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function chamsoc_create_sample(text) from anon, authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'chamsoc_app') then
    grant execute on function chamsoc_create_sample(text) to chamsoc_app;
  end if;
end $$;
