// Dữ liệu mẫu khi chưa cấu hình DATABASE_URL (chế độ demo, để trình bày).
import type { AlertRow, ElderDetail, ElderSummary, Overview, SettingsData } from "./types";

const MIN = 60_000;

function hrSeries(now: number, base: number, spikeAtMinAgo: number | null) {
  const out: { ts: string; bpm: number }[] = [];
  for (let m = 24 * 60; m >= 0; m -= 10) {
    const t = now - m * MIN;
    const hour = new Date(t).getUTCHours() + 7; // giờ Việt Nam
    const h = hour % 24;
    const asleep = h < 6 || h >= 22;
    let bpm = asleep ? base - 8 + Math.round(3 * Math.sin(m / 37)) : base + Math.round(8 * Math.sin(m / 53));
    if (h >= 17 && h < 18) bpm += 30; // đi bộ buổi chiều
    if (spikeAtMinAgo !== null && Math.abs(m - spikeAtMinAgo) <= 20) bpm = base + 30;
    out.push({ ts: new Date(t).toISOString(), bpm });
  }
  return out;
}

function people(now: number): ElderSummary[] {
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
  return [
    {
      id: "demo-ba", name: "Ba Hùng", birthYear: 1955, conditions: ["tang_huyet_ap", "tieu_duong"],
      status: "ok", hrNow: 68, lastDataAt: iso(4 * MIN), liveSource: true,
      watchLabel: "Venu 4", watchBattery: 64, hr24h: hrSeries(now, 66, null),
      today: { restingHr: 62, steps: 4820, sleepSeconds: 24000, deepSleepSeconds: 4200, sleepScore: 72,
               bodyBattery: 45, spo2Min: 92, stressAvg: 31 },
    },
    {
      id: "demo-me", name: "Mẹ Lan", birthYear: 1959, conditions: ["tim_mach"],
      status: "attention", hrNow: 98, lastDataAt: iso(2 * MIN), liveSource: true,
      watchLabel: "vívoactive 6", watchBattery: 38, hr24h: hrSeries(now, 74, 90),
      today: { restingHr: 98, steps: 1230, sleepSeconds: 17700, deepSleepSeconds: 2400, sleepScore: 51,
               bodyBattery: 18, spo2Min: 93, stressAvg: 48 },
    },
    {
      id: "demo-ba-ngoai", name: "Bà ngoại Tư", birthYear: 1942, conditions: ["tang_huyet_ap"],
      status: "offline", hrNow: null, lastDataAt: iso(26 * 60 * MIN), liveSource: false,
      watchLabel: null, watchBattery: null, hr24h: [],
      today: { restingHr: null, steps: null, sleepSeconds: null, deepSleepSeconds: null, sleepScore: null,
               bodyBattery: null, spo2Min: null, stressAvg: null },
    },
  ];
}

function alerts(now: number): AlertRow[] {
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
  return [
    { id: "a1", elderId: "demo-me", elderName: "Mẹ Lan", metric: "resting_hr", severity: "high",
      message: "Nhịp tim nghỉ 98 bpm (ngưỡng > 90 bpm)", openedAt: iso(90 * MIN),
      ackedBy: "Chị Hạnh", ackedAt: iso(84 * MIN), resolvedAt: null },
    { id: "a2", elderId: "demo-ba-ngoai", elderName: "Bà ngoại Tư", metric: "no_sync_hours", severity: "warn",
      message: "Garmin Connect chưa đồng bộ 26 giờ (ngưỡng > 12 giờ)", openedAt: iso(14 * 60 * MIN),
      ackedBy: null, ackedAt: null, resolvedAt: null },
    { id: "a3", elderId: "demo-ba", elderName: "Ba Hùng", metric: "systolic", severity: "high",
      message: "Huyết áp tâm thu 165 mmHg (ngưỡng > 160 mmHg)", openedAt: iso(3 * 24 * 60 * MIN),
      ackedBy: "Nguyên", ackedAt: iso(3 * 24 * 60 * MIN - 6 * MIN), resolvedAt: iso(3 * 24 * 60 * MIN - 120 * MIN) },
    { id: "a4", elderId: "demo-ba", elderName: "Ba Hùng", metric: "steps", severity: "info",
      message: "Bước chân 860 bước (ngưỡng < 1.000 bước)", openedAt: iso(5 * 24 * 60 * MIN),
      ackedBy: null, ackedAt: null, resolvedAt: iso(5 * 24 * 60 * MIN - 600 * MIN) },
  ];
}

export function demoOverview(): Overview {
  const now = Date.now();
  const all = alerts(now);
  return {
    familyName: "Gia đình (dữ liệu mẫu)",
    elders: people(now),
    openAlerts: all.filter((a) => !a.resolvedAt),
    recentAlerts: all,
    carers: [
      { id: "c1", name: "Nguyên", role: "admin", hasTelegram: true, phone: "+84…01" },
      { id: "c2", name: "Chị Hạnh", role: "alerts", hasTelegram: true, phone: "+84…02" },
      { id: "c3", name: "Anh Tú", role: "reports", hasTelegram: true, phone: null },
    ],
  };
}

export function demoDetail(id: string): ElderDetail | null {
  const now = Date.now();
  const elder = people(now).find((p) => p.id === id);
  if (!elder) return null;
  const stepsBase = elder.id === "demo-me" ? [3100, 2800, 4500, 1900, 2200, 3600, 1230]
    : [6400, 5100, 7200, 1900, 2300, 6800, 4820];
  const steps7 = stepsBase.map((s, i) => ({
    day: new Date(now - (6 - i) * 24 * 60 * MIN).toISOString().slice(0, 10),
    steps: elder.id === "demo-ba-ngoai" ? null : s,
  }));
  return {
    elder,
    steps7,
    sleep: elder.today.sleepSeconds
      ? { deep: elder.today.deepSleepSeconds ?? 0, light: 12300, rem: 5100,
          awake: 2400 }
      : null,
    alerts: alerts(now).filter((a) => a.elderId === id),
    readings: elder.id === "demo-ba-ngoai" ? [] : [
      { kind: "blood_pressure", systolic: 132, diastolic: 84, value: null, measuredAt: new Date(now - 60 * MIN).toISOString(), source: "telegram" },
      { kind: "glucose", systolic: null, diastolic: null, value: 7.2, measuredAt: new Date(now - 58 * MIN).toISOString(), source: "telegram" },
      { kind: "blood_pressure", systolic: 145, diastolic: 90, value: null, measuredAt: new Date(now - 25 * 60 * MIN).toISOString(), source: "garmin" },
    ],
    meds: elder.id === "demo-ba" ? [
      { name: "Amlodipine 5mg", note: "huyết áp, sau ăn sáng", dueAt: new Date(now - 180 * MIN).toISOString(), takenAt: new Date(now - 176 * MIN).toISOString() },
      { name: "Metformin 500mg", note: "sau ăn", dueAt: new Date(now - 180 * MIN).toISOString(), takenAt: null },
    ] : [],
  };
}

export function demoSettings(): SettingsData {
  const rule = (id: string, metric: string, comparator: "gt" | "lt", threshold: number,
                severity: "info" | "warn" | "high" | "urgent", enabled = true, activeAfter: string | null = null,
                notify: "family" | "elder" = "family") =>
    ({ id, metric, comparator, threshold, severity, enabled, activeAfter, notify });
  const base = (p: string) => [
    rule(`${p}1`, "hr_now", "gt", 120, "high"),
    rule(`${p}2`, "hr_now", "lt", 40, "urgent"),
    rule(`${p}3`, "resting_hr", "gt", 90, "high"),
    rule(`${p}4`, "spo2_min", "lt", 90, "high"),
    rule(`${p}5`, "no_live_minutes", "gt", 30, "warn"),
    rule(`${p}6`, "steps", "lt", 1000, "info", true, "18:00", "elder"),
    rule(`${p}7`, "sleep_hours", "lt", 5, "warn", true, "10:00"),
    rule(`${p}8`, "body_battery", "lt", 15, "warn", false),
  ];
  return {
    family: { quietStart: "22:00", quietEnd: "06:00", morningReportAt: "07:30", eveningReportAt: "21:00", hasTelegramGroup: true },
    elders: [
      { id: "demo-ba", name: "Ba Hùng", conditions: ["tang_huyet_ap", "tieu_duong"],
        rules: [...base("b"), rule("b9", "systolic", "gt", 160, "high"), rule("b10", "glucose", "lt", 3.9, "urgent"), rule("b11", "glucose", "gt", 13.9, "high")],
        meds: [{ id: "m1", name: "Amlodipine 5mg", note: "huyết áp, sau ăn sáng", times: ["07:00"] },
               { id: "m2", name: "Metformin 500mg", note: "sau ăn", times: ["07:00", "19:00"] }],
        devices: [{ id: "d1", label: "Venu 4", lastSeenAt: new Date(Date.now() - 4 * MIN).toISOString(), battery: 64 }],
        garmin: { status: "ok", lastSyncAt: new Date(Date.now() - 9 * MIN).toISOString(), lastError: null } },
      { id: "demo-me", name: "Mẹ Lan", conditions: ["tim_mach"], rules: base("m"), meds: [],
        devices: [{ id: "d2", label: "vívoactive 6", lastSeenAt: new Date(Date.now() - 2 * MIN).toISOString(), battery: 38 }],
        garmin: { status: "ok", lastSyncAt: new Date(Date.now() - 6 * MIN).toISOString(), lastError: null } },
      { id: "demo-ba-ngoai", name: "Bà ngoại Tư", conditions: ["tang_huyet_ap"],
        rules: [...base("t"), rule("t9", "systolic", "gt", 160, "high")], meds: [], devices: [],
        garmin: { status: "needs_relogin", lastSyncAt: new Date(Date.now() - 26 * 60 * MIN).toISOString(), lastError: "Token hết hạn" } },
    ],
  };
}
