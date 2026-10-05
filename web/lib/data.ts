import "server-only";
import { isDemo, sql } from "./db";
import { demoDetail, demoOverview, demoSettings } from "./demo";
import type {
  AlertRow, FamilyAdmin, Carer, ElderDetail, ElderSummary, Overview, Reading, RuleRow, SettingsData, Status,
} from "./types";

const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null);

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function toAlert(r: Row): AlertRow {
  return {
    id: r.id, elderId: r.elder_id, elderName: r.elder_name, metric: r.metric, severity: r.severity,
    message: r.message, openedAt: iso(r.opened_at)!, ackedBy: r.acked_name ?? null,
    ackedAt: iso(r.acked_at), resolvedAt: iso(r.resolved_at),
  };
}

function statusOf(e: Row, open: AlertRow[]): Status {
  const mine = open.filter((a) => a.elderId === e.id);
  if (mine.some((a) => a.metric === "no_sync_hours" || a.metric === "no_live_minutes")) return "offline";
  if (mine.some((a) => a.severity !== "info")) return "attention";
  if (!e.last_data_at) return "nodata";
  return "ok";
}

async function elderRows(familyId: string, elderId?: string): Promise<Row[]> {
  const db = sql();
  return db`
    select e.id, e.display_name, e.birth_year, e.conditions,
           dm.resting_hr, dm.steps, dm.sleep_seconds, dm.deep_sleep_seconds, dm.sleep_score,
           dm.body_battery, dm.spo2_min, dm.stress_avg,
           ls.hr as live_hr, ls.measured_at as live_at, ls.steps as live_steps,
           ls.body_battery as live_bb, ls.resting_hr as live_rhr,
           ls.stress as live_stress, ls.stress_1h, ls.respiration, ls.calories, ls.distance_m, ls.floors,
           ls.active_min, ls.charging, dm.hrv_last_night,
           (select max(ts) from hr_samples h where h.elder_id = e.id) as last_hr_at, mv.last_move_at,
           extract(hour from now() at time zone f.timezone)::int as local_hour,
           w.label as watch_label, w.battery as watch_battery,
           greatest(ls.measured_at, g.last_device_upload_at) as last_data_at
    from elders e
    join families f on f.id = e.family_id
    left join daily_metrics dm on dm.elder_id = e.id and dm.day = (now() at time zone f.timezone)::date
    left join live_status ls on ls.elder_id = e.id
    left join garmin_accounts g on g.elder_id = e.id
    left join lateral (
      select coalesce(max(ts) filter (where d > 0), min(ts)) as last_move_at
      from (select ts, steps - lag(steps) over (order by ts) as d from step_samples
            where elder_id = e.id and ts > now() - interval '24 hours') x) mv on true
    left join lateral (select label, battery from watch_devices
                       where elder_id = e.id order by last_seen_at desc nulls last limit 1) w on true
    where e.family_id = ${familyId} ${elderId ? db`and e.id = ${elderId}` : db``}
    order by e.created_at`;
}

async function hrSeries(elderIds: string[]): Promise<Map<string, { ts: string; bpm: number }[]>> {
  const out = new Map<string, { ts: string; bpm: number }[]>();
  if (!elderIds.length) return out;
  const rows = await sql()`
    select elder_id, date_bin('10 minutes', ts, timestamptz '2000-01-01') as bucket, round(avg(bpm))::int as bpm
    from hr_samples where elder_id = any(${elderIds}::uuid[]) and ts > now() - interval '24 hours'
    group by 1, 2 order by 2`;
  for (const r of rows) {
    const list = out.get(r.elder_id) ?? [];
    list.push({ ts: iso(r.bucket)!, bpm: r.bpm });
    out.set(r.elder_id, list);
  }
  return out;
}

async function openAlerts(familyId: string): Promise<AlertRow[]> {
  const rows = await sql()`
    select a.*, e.display_name as elder_name, c.display_name as acked_name
    from alerts a join elders e on e.id = a.elder_id left join caregivers c on c.id = a.acked_by
    where e.family_id = ${familyId} and a.resolved_at is null order by a.opened_at desc`;
  return rows.map(toAlert);
}

const minsSince = (t: unknown) => (t ? Math.max(0, Math.floor((Date.now() - new Date(t as string).getTime()) / 60_000)) : null);

function toSummary(e: Row, open: AlertRow[], hr: Map<string, { ts: string; bpm: number }[]>): ElderSummary {
  const liveFresh = e.live_at && Date.now() - new Date(e.live_at).getTime() < 15 * 60_000;
  // Giống backend/chamsoc/rules.py: đồng hồ vẫn gửi mà 30 phút không có nhịp tim là đang không đeo.
  const hrAgo = minsSince(e.last_hr_at);
  const wear = !liveFresh ? null : e.charging ? "charging" : hrAgo == null || hrAgo > 30 ? "not_worn" : "worn";
  const daytime = e.local_hour >= 7 && e.local_hour < 21;
  const inactive = wear === "worn" && daytime ? Math.min(minsSince(e.last_move_at) ?? 0, (e.local_hour - 7) * 60 + new Date().getMinutes()) : null;
  return {
    id: e.id, name: e.display_name, birthYear: e.birth_year, conditions: e.conditions ?? [],
    status: statusOf(e, open),
    hrNow: liveFresh ? e.live_hr : null,
    lastDataAt: iso(e.last_data_at),
    liveSource: !!e.live_at,
    watchLabel: e.watch_label ?? null,
    watchBattery: e.watch_battery ?? null,
    hr24h: hr.get(e.id) ?? [],
    wear, inactiveMin: inactive,
    today: {
      restingHr: e.resting_hr ?? e.live_rhr ?? null,
      steps: e.live_steps != null ? Math.max(e.steps ?? 0, e.live_steps) : e.steps,
      sleepSeconds: e.sleep_seconds, deepSleepSeconds: e.deep_sleep_seconds, sleepScore: e.sleep_score,
      bodyBattery: e.live_bb ?? e.body_battery, spo2Min: e.spo2_min, stressAvg: e.stress_avg,
      stressNow: liveFresh ? e.live_stress : null, stress1h: liveFresh ? e.stress_1h : null,
      respiration: liveFresh ? e.respiration : null, calories: e.calories, distanceM: e.distance_m,
      floors: e.floors, activeMin: e.active_min, hrv: e.hrv_last_night,
    },
  };
}

export async function getOverview(familyId: string): Promise<Overview> {
  if (isDemo) return demoOverview();
  const db = sql();
  const [fam] = await db`select name from families where id = ${familyId}`;
  const [rows, open] = await Promise.all([elderRows(familyId), openAlerts(familyId)]);
  const hr = await hrSeries(rows.map((r) => r.id));
  const recent = await db`
    select a.*, e.display_name as elder_name, c.display_name as acked_name
    from alerts a join elders e on e.id = a.elder_id left join caregivers c on c.id = a.acked_by
    where e.family_id = ${familyId} and a.opened_at > now() - interval '7 days'
    order by a.opened_at desc limit 8`;
  const carers = await db`
    select id, display_name, role, telegram_user_id, phone from caregivers
    where family_id = ${familyId} order by escalation_order nulls last, created_at`;
  return {
    familyName: fam?.name ?? "Gia đình",
    elders: rows.map((r) => toSummary(r, open, hr)),
    openAlerts: open,
    recentAlerts: recent.map(toAlert),
    carers: carers.map((c): Carer => ({
      id: c.id, name: c.display_name, role: c.role, hasTelegram: c.telegram_user_id != null, phone: c.phone,
    })),
  };
}

export async function getElderDetail(familyId: string, elderId: string): Promise<ElderDetail | null> {
  if (isDemo) return demoDetail(elderId);
  if (!/^[0-9a-f-]{36}$/.test(elderId)) return null;
  const db = sql();
  const [rows, open] = await Promise.all([elderRows(familyId, elderId), openAlerts(familyId)]);
  if (!rows.length) return null;
  const hr = await hrSeries([elderId]);
  const elder = toSummary(rows[0], open, hr);

  const steps = await db`
    select d::date as day, dm.steps
    from families f
    cross join generate_series((now() at time zone f.timezone)::date - 6,
                               (now() at time zone f.timezone)::date, interval '1 day') d
    left join daily_metrics dm on dm.elder_id = ${elderId} and dm.day = d::date
    where f.id = ${familyId} order by d`;
  const [sleepRow] = await db`
    select dm.raw -> 'sleep' -> 'dailySleepDTO' as dto
    from daily_metrics dm join elders e on e.id = dm.elder_id join families f on f.id = e.family_id
    where dm.elder_id = ${elderId} and dm.day = (now() at time zone f.timezone)::date`;
  const dto = sleepRow?.dto;
  const alerts = await db`
    select a.*, e.display_name as elder_name, c.display_name as acked_name
    from alerts a join elders e on e.id = a.elder_id left join caregivers c on c.id = a.acked_by
    where a.elder_id = ${elderId} and a.opened_at > now() - interval '30 days'
    order by a.opened_at desc limit 20`;
  const readings = await db`
    select kind, systolic, diastolic, value, measured_at, source from readings
    where elder_id = ${elderId} and measured_at > now() - interval '7 days'
    order by measured_at desc limit 12`;
  const meds = await db`
    select s.name, s.note, ((now() at time zone f.timezone)::date + t) at time zone f.timezone as due_at,
           l.taken_at
    from med_schedules s
    join elders e on e.id = s.elder_id join families f on f.id = e.family_id
    cross join lateral unnest(s.times) t
    left join med_logs l on l.schedule_id = s.id
         and l.due_at = ((now() at time zone f.timezone)::date + t) at time zone f.timezone
    where s.elder_id = ${elderId} and s.active order by due_at`;

  return {
    elder,
    steps7: steps.map((s) => ({ day: new Date(s.day).toISOString().slice(0, 10), steps: s.steps })),
    sleep: dto && dto.sleepTimeSeconds ? {
      deep: dto.deepSleepSeconds ?? 0, light: dto.lightSleepSeconds ?? 0,
      rem: dto.remSleepSeconds ?? 0, awake: dto.awakeSleepSeconds ?? 0,
    } : null,
    alerts: alerts.map(toAlert),
    readings: readings.map((r): Reading => ({
      kind: r.kind, systolic: r.systolic, diastolic: r.diastolic, value: num(r.value),
      measuredAt: iso(r.measured_at)!, source: r.source,
    })),
    meds: meds.map((m) => ({ name: m.name, note: m.note, dueAt: iso(m.due_at)!, takenAt: iso(m.taken_at) })),
  };
}

export async function getSettings(familyId: string): Promise<SettingsData> {
  if (isDemo) return demoSettings();
  const db = sql();
  const [f] = await db`select f.*, exists(select 1 from family_chats c where c.family_id = f.id) as has_group
                       from families f where f.id = ${familyId}`;
  const elders = await db`select id, display_name, conditions from elders where family_id = ${familyId} order by created_at`;
  const ids = elders.map((e) => e.id);
  const [rules, meds, devices, garmin] = await Promise.all([
    db`select * from alert_rules where elder_id = any(${ids}::uuid[]) order by metric, comparator`,
    db`select id, elder_id, name, note, times::text[] as times from med_schedules
       where elder_id = any(${ids}::uuid[]) and active order by created_at`,
    db`select id, elder_id, label, last_seen_at, battery from watch_devices
       where elder_id = any(${ids}::uuid[]) order by created_at`,
    db`select elder_id, status, last_sync_at, last_error from garmin_accounts where elder_id = any(${ids}::uuid[])`,
  ]);
  return {
    family: {
      quietStart: hhmm(f.quiet_start)!, quietEnd: hhmm(f.quiet_end)!,
      morningReportAt: hhmm(f.morning_report_at)!, eveningReportAt: hhmm(f.evening_report_at),
      hasTelegramGroup: !!f.has_group,
    },
    elders: elders.map((e) => {
      const g = garmin.find((x) => x.elder_id === e.id);
      return {
        id: e.id, name: e.display_name, conditions: e.conditions ?? [],
        rules: rules.filter((r) => r.elder_id === e.id).map((r): RuleRow => ({
          id: r.id, metric: r.metric, comparator: r.comparator, threshold: Number(r.threshold),
          severity: r.severity, activeAfter: hhmm(r.active_after), notify: r.notify, enabled: r.enabled,
        })),
        meds: meds.filter((m) => m.elder_id === e.id).map((m) => ({
          id: m.id, name: m.name, note: m.note, times: (m.times as string[]).map((t) => t.slice(0, 5)),
        })),
        devices: devices.filter((d) => d.elder_id === e.id).map((d) => ({
          id: d.id, label: d.label, lastSeenAt: iso(d.last_seen_at), battery: d.battery,
        })),
        garmin: g ? { status: g.status, lastSyncAt: iso(g.last_sync_at), lastError: g.last_error } : null,
      };
    }),
  };
}

/** Cảnh báo 30 ngày của cả gia đình, mới nhất trước. */
export async function getAlerts(familyId: string): Promise<AlertRow[]> {
  if (isDemo) return demoOverview().recentAlerts;
  const rows = await sql()`
    select a.*, e.display_name as elder_name, c.display_name as acked_name
    from alerts a join elders e on e.id = a.elder_id left join caregivers c on c.id = a.acked_by
    where e.family_id = ${familyId} and a.opened_at > now() - interval '30 days'
    order by (a.resolved_at is null) desc, a.opened_at desc limit 100`;
  return rows.map(toAlert);
}

export async function getFamilyAdmin(familyId: string, caregiverId: string): Promise<FamilyAdmin> {
  if (isDemo) {
    const o = demoOverview();
    return {
      name: o.familyName, hasTelegramGroup: true,
      groups: [{ chatId: "-1", title: "Nhà mình (mẫu)", linkedAt: new Date().toISOString() }],
      members: o.carers.map((c, i) => ({ id: c.id, name: c.name, role: c.role, hasTelegram: c.hasTelegram, phone: c.phone, isMe: i === 0,
        email: null, hasAccount: true })),
      invites: [{ id: "i1", code: "demo123abc", role: "alerts", expiresAt: new Date(Date.now() + 5 * 864e5).toISOString() }],
      elders: o.elders.map((e) => ({ id: e.id, name: e.name, birthYear: e.birthYear, conditions: e.conditions, hasTelegram: e.id !== "demo-ba-ngoai", command: null })),
    };
  }
  const db = sql();
  const [[f], groups, members, invites, elders] = await Promise.all([
    db`select name from families where id = ${familyId}`,
    db`select chat_id::text, title, linked_at from family_chats where family_id = ${familyId} order by linked_at`,
    db`select id, display_name, role, telegram_user_id, phone, email, account_id from caregivers where family_id = ${familyId}
       order by (role = 'admin') desc, created_at`,
    db`select id, code, role, expires_at from invites where family_id = ${familyId} and revoked_at is null
       and expires_at > now() order by created_at desc`,
    db`select id, display_name, birth_year, conditions, telegram_user_id, command from elders
       where family_id = ${familyId} order by created_at`,
  ]);
  return {
    name: f?.name ?? "Gia đình",
    hasTelegramGroup: groups.length > 0,
    groups: groups.map((g) => ({ chatId: g.chat_id, title: g.title ?? null, linkedAt: iso(g.linked_at)! })),
    members: members.map((m) => ({ id: m.id, name: m.display_name, role: m.role, hasTelegram: m.telegram_user_id != null,
      phone: m.phone, isMe: m.id === caregiverId, email: m.email ?? null, hasAccount: m.account_id != null })),
    invites: invites.map((i) => ({ id: i.id, code: i.code, role: i.role, expiresAt: iso(i.expires_at)! })),
    elders: elders.map((e) => ({ id: e.id, name: e.display_name, birthYear: e.birth_year, conditions: e.conditions ?? [],
      hasTelegram: e.telegram_user_id != null, command: e.command })),
  };
}

export async function getInvite(code: string): Promise<{ familyName: string; role: string; inviter: string | null } | null> {
  if (isDemo) return { familyName: "Gia đình (dữ liệu mẫu)", role: "alerts", inviter: "Nguyên" };
  const [r] = await sql()`
    select f.name, i.role, c.display_name as inviter from invites i
    join families f on f.id = i.family_id left join caregivers c on c.id = i.created_by
    where i.code = ${code} and i.revoked_at is null and i.expires_at > now()`;
  return r ? { familyName: r.name, role: r.role, inviter: r.inviter } : null;
}

/** Trạng thái mã 6 số đồng hồ đang hiện (trang /d/[code] mở từ thông báo trên điện thoại). */
export async function getPairingState(code: string): Promise<"pending" | "claimed" | "expired"> {
  if (isDemo) return "pending";
  const [r] = await sql()`
    select claimed_at is not null as claimed, expires_at > now() as live from watch_pairings
    where code = ${code} order by created_at desc limit 1`;
  if (!r) return "expired";
  return r.claimed ? "claimed" : r.live ? "pending" : "expired";
}

/** Số liệu tổng quan cho trang quản trị hệ thống. */
export async function getSystemStats(): Promise<{
  families: number; elders: number; caregivers: number; watches: number; lastWatchAt: string | null; openAlerts: number;
}> {
  if (isDemo) return { families: 1, elders: 2, caregivers: 3, watches: 1, lastWatchAt: null, openAlerts: 0 };
  const [r] = await sql()`
    select (select count(*) from families)::int as families,
           (select count(*) from elders)::int as elders,
           (select count(*) from caregivers)::int as caregivers,
           (select count(*) from watch_devices)::int as watches,
           (select max(last_seen_at) from watch_devices) as last_watch_at,
           (select count(*) from alerts where resolved_at is null)::int as open_alerts`;
  return {
    families: r.families, elders: r.elders, caregivers: r.caregivers, watches: r.watches,
    lastWatchAt: iso(r.last_watch_at), openAlerts: r.open_alerts,
  };
}

/** Danh sách tài khoản cho trang quản trị hệ thống. */
export async function getSystemAdmins(): Promise<{
  id: string; name: string; email: string; isSystemAdmin: boolean; lastLoginAt: string | null; families: string[];
}[]> {
  if (isDemo) return [];
  const rows = await sql()`
    select a.id, a.name, a.email, a.is_system_admin, a.last_login_at,
           coalesce(array_agg(f.name order by f.name) filter (where f.id is not null), '{}') as families
    from accounts a
    left join caregivers c on c.account_id = a.id
    left join families f on f.id = c.family_id
    group by a.id order by a.is_system_admin desc, a.created_at`;
  return rows.map((r) => ({
    id: r.id, name: r.name, email: r.email, isSystemAdmin: r.is_system_admin, lastLoginAt: iso(r.last_login_at),
    families: r.families,
  }));
}
