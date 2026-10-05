export type Severity = "info" | "warn" | "high" | "urgent";
export type Status = "ok" | "attention" | "offline" | "nodata";

export interface Today {
  restingHr: number | null;
  steps: number | null;
  sleepSeconds: number | null;
  deepSleepSeconds: number | null;
  sleepScore: number | null;
  bodyBattery: number | null;
  spo2Min: number | null;
  stressAvg: number | null;
  // Từ đồng hồ (gửi mỗi 5 phút); thiếu thì là null/undefined.
  stressNow?: number | null;
  stress1h?: number | null;
  respiration?: number | null;
  calories?: number | null;
  distanceM?: number | null;
  floors?: number | null;
  activeMin?: number | null;
  /** HRV đêm qua (ms), từ Garmin Connect. */
  hrv?: number | null;
}

export interface ElderSummary {
  id: string;
  name: string;
  birthYear: number | null;
  conditions: string[];
  status: Status;
  today: Today;
  hrNow: number | null;
  /** Lần cuối có dữ liệu: đồng hồ gửi trực tiếp hoặc Garmin Connect. */
  lastDataAt: string | null;
  liveSource: boolean;
  watchLabel: string | null;
  watchBattery: number | null;
  hr24h: { ts: string; bpm: number }[];
  /** Đang đeo, không đeo (đồng hồ vẫn gửi nhưng không có nhịp tim), hay đang sạc. */
  wear?: "worn" | "not_worn" | "charging" | null;
  /** Số phút ngồi/nằm im (ban ngày, đang đeo); null nếu không áp dụng. */
  inactiveMin?: number | null;
}

export interface AlertRow {
  id: string;
  elderId: string;
  elderName: string;
  metric: string;
  severity: Severity;
  message: string;
  openedAt: string;
  ackedBy: string | null;
  ackedAt: string | null;
  resolvedAt: string | null;
}

export interface Carer {
  id: string;
  name: string;
  role: "admin" | "alerts" | "reports";
  hasTelegram: boolean;
  phone: string | null;
}

export interface Overview {
  familyName: string;
  elders: ElderSummary[];
  openAlerts: AlertRow[];
  recentAlerts: AlertRow[];
  carers: Carer[];
}

export interface Reading {
  kind: "blood_pressure" | "glucose" | "weight";
  systolic: number | null;
  diastolic: number | null;
  value: number | null;
  measuredAt: string;
  source: string;
}

export interface MedToday {
  name: string;
  note: string | null;
  dueAt: string;
  takenAt: string | null;
}

export interface SleepStages {
  deep: number;
  light: number;
  rem: number;
  awake: number;
}

export interface ElderDetail {
  elder: ElderSummary;
  steps7: { day: string; steps: number | null }[];
  sleep: SleepStages | null;
  alerts: AlertRow[];
  readings: Reading[];
  meds: MedToday[];
}

export interface RuleRow {
  id: string;
  metric: string;
  comparator: "gt" | "lt";
  threshold: number;
  severity: Severity;
  activeAfter: string | null;
  notify: "family" | "elder";
  enabled: boolean;
}

export interface MedSchedule {
  id: string;
  name: string;
  note: string | null;
  times: string[];
}

export interface DeviceRow {
  id: string;
  label: string | null;
  lastSeenAt: string | null;
  battery: number | null;
}

export interface ElderSettings {
  id: string;
  name: string;
  conditions: string[];
  rules: RuleRow[];
  meds: MedSchedule[];
  devices: DeviceRow[];
  garmin: { status: string; lastSyncAt: string | null; lastError: string | null } | null;
}

export interface FamilySettings {
  quietStart: string;
  quietEnd: string;
  morningReportAt: string;
  eveningReportAt: string | null;
  hasTelegramGroup: boolean;
}

export interface SettingsData {
  family: FamilySettings;
  elders: ElderSettings[];
}

export interface FamilyAdmin {
  name: string;
  hasTelegramGroup: boolean;
  /** Các nhóm Telegram đã nối (tên nhóm lấy lúc nối, tự cập nhật khi nhóm đổi tên). */
  groups: { chatId: string; title: string | null; linkedAt: string }[];
  members: {
    id: string; name: string; role: "admin" | "alerts" | "reports"; hasTelegram: boolean; phone: string | null; isMe: boolean;
    email: string | null; hasAccount: boolean;
  }[];
  invites: { id: string; code: string; role: string; expiresAt: string }[];
  elders: { id: string; name: string; birthYear: number | null; conditions: string[]; hasTelegram: boolean; command: string | null }[];
}
