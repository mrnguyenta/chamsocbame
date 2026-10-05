import type { Lang } from "./i18n";

type Bi = [vi: string, en: string];
const pick = (b: Bi, lang: Lang) => (lang === "en" ? b[1] : b[0]);
const mapOf = <V, R>(src: Record<string, V>, f: (v: V) => R): Record<string, R> =>
  Object.fromEntries(Object.entries(src).map(([k, v]) => [k, f(v)]));

// Nhãn hiển thị; giữ khớp với backend/chamsoc/rules.py (METRICS).
const METRIC_TEXT: Record<string, { label: Bi; unit: Bi; hint: Bi }> = {
  resting_hr: { label: ["Nhịp tim nghỉ", "Resting heart rate"], unit: ["bpm", "bpm"], hint: ["Garmin tính mỗi ngày", "Calculated daily by Garmin"] },
  hr_now: { label: ["Nhịp tim hiện tại", "Current heart rate"], unit: ["bpm", "bpm"],
    hint: ["Trung vị 10 phút, cần ứng dụng đồng hồ; bỏ qua khi đang đi lại", "10-minute median from the watch app; ignored while walking"] },
  spo2_min: { label: ["SpO2 thấp nhất", "Lowest SpO2"], unit: ["%", "%"], hint: ["Đo ban đêm", "Measured overnight"] },
  sleep_hours: { label: ["Giấc ngủ", "Sleep"], unit: ["giờ", "h"], hint: ["Tổng thời gian ngủ đêm qua", "Total sleep last night"] },
  steps: { label: ["Bước chân", "Steps"], unit: ["bước", "steps"], hint: ["Nên đặt giờ kiểm tra, ví dụ 18:00", "Set a check time, e.g. 18:00"] },
  body_battery: { label: ["Body Battery", "Body Battery"], unit: ["", ""], hint: ["Năng lượng cơ thể 0–100", "Body energy 0–100"] },
  stress_avg: { label: ["Stress trung bình", "Average stress"], unit: ["", ""], hint: ["Thang Garmin 0–100", "Garmin scale 0–100"] },
  no_sync_hours: { label: ["Garmin Connect chưa đồng bộ", "Garmin Connect not synced"], unit: ["giờ", "h"],
    hint: ["Đồng hồ → điện thoại → Garmin", "Watch → phone → Garmin"] },
  no_live_minutes: { label: ["Đồng hồ chưa gửi dữ liệu", "Watch has not sent data"], unit: ["phút", "min"],
    hint: ["Ứng dụng đồng hồ gửi mỗi 5 phút", "The watch app sends every 5 minutes"] },
  watch_battery: { label: ["Pin đồng hồ", "Watch battery"], unit: ["%", "%"], hint: ["Không báo khi đang sạc", "No alert while charging"] },
  inactive_minutes: { label: ["Ngồi/nằm im không đi lại", "Not moving"], unit: ["phút", "min"],
    hint: ["7h–21h, khi đang đeo đồng hồ; đếm từ lần cuối có bước chân", "7am–9pm while the watch is worn; counted from the last step"] },
  not_worn_minutes: { label: ["Không đeo đồng hồ", "Watch not worn"], unit: ["phút", "min"],
    hint: ["7h–21h: đồng hồ vẫn gửi nhưng không đo được nhịp tim; không tính lúc sạc",
      "7am–9pm: the watch sends data but reads no heart rate; not while charging"] },
  stress_1h: { label: ["Căng thẳng trung bình 1 giờ", "1-hour average stress"], unit: ["", ""],
    hint: ["Thang Garmin 0–100, đồng hồ tính trung bình 1 giờ qua", "Garmin scale 0–100, averaged over the last hour"] },
  systolic: { label: ["Huyết áp tâm thu", "Systolic blood pressure"], unit: ["mmHg", "mmHg"], hint: ["Số trên", "Upper number"] },
  diastolic: { label: ["Huyết áp tâm trương", "Diastolic blood pressure"], unit: ["mmHg", "mmHg"], hint: ["Số dưới", "Lower number"] },
  glucose: { label: ["Đường huyết", "Blood glucose"], unit: ["mmol/L", "mmol/L"], hint: ["Nhập tay qua Telegram", "Entered via Telegram"] },
};

export const METRIC_KEYS = Object.keys(METRIC_TEXT);

export function metrics(lang: Lang): Record<string, { label: string; unit: string; hint: string }> {
  return mapOf(METRIC_TEXT, (m) => ({ label: pick(m.label, lang), unit: pick(m.unit, lang), hint: pick(m.hint, lang) }));
}

const SEVERITY_TEXT: Record<string, { label: Bi; tone: string }> = {
  info: { label: ["Nhắc nhở", "Reminder"], tone: "neutral" },
  warn: { label: ["Chú ý", "Warning"], tone: "warn" },
  high: { label: ["Cao", "High"], tone: "danger" },
  urgent: { label: ["Khẩn cấp", "Urgent"], tone: "urgent" },
};

export const SEVERITY_KEYS = Object.keys(SEVERITY_TEXT);

export function severities(lang: Lang): Record<string, { label: string; tone: string }> {
  return mapOf(SEVERITY_TEXT, (s) => ({ label: pick(s.label, lang), tone: s.tone }));
}

const CONDITION_TEXT: Record<string, Bi> = {
  tang_huyet_ap: ["Tăng huyết áp", "High blood pressure"],
  tim_mach: ["Tim mạch", "Heart disease"],
  tieu_duong: ["Tiểu đường", "Diabetes"],
  copd: ["Bệnh phổi (COPD)", "Lung disease (COPD)"],
};

/** Mã bệnh nền hợp lệ (dùng khi đọc form). */
export const CONDITION_KEYS = Object.keys(CONDITION_TEXT);

export function conditions(lang: Lang): Record<string, string> {
  return mapOf(CONDITION_TEXT, (c) => pick(c, lang));
}

const STATUS_TEXT: Record<string, { label: Bi; tone: string }> = {
  ok: { label: ["Ổn định", "Stable"], tone: "ok" },
  attention: { label: ["Cần chú ý", "Needs attention"], tone: "danger" },
  offline: { label: ["Mất kết nối", "Offline"], tone: "warn" },
  nodata: { label: ["Chưa có dữ liệu", "No data yet"], tone: "neutral" },
};

export function statuses(lang: Lang): Record<string, { label: string; tone: string }> {
  return mapOf(STATUS_TEXT, (s) => ({ label: pick(s.label, lang), tone: s.tone }));
}

/** Nhóm ngưỡng trên trang Cài đặt. */
const GROUPS: { key: string; title: Bi; tile: string; metrics: string[] }[] = [
  { key: "tim", title: ["Tim mạch & SpO2", "Heart & SpO2"], tile: "tile-coral", metrics: ["hr_now", "resting_hr", "spo2_min"] },
  { key: "ha", title: ["Huyết áp & đường huyết", "Blood pressure & glucose"], tile: "tile-violet", metrics: ["systolic", "diastolic", "glucose"] },
  { key: "vandong", title: ["Vận động & giấc ngủ", "Activity & sleep"], tile: "tile-teal",
    metrics: ["inactive_minutes", "steps", "sleep_hours", "body_battery"] },
  { key: "cangthang", title: ["Căng thẳng", "Stress"], tile: "tile-amber", metrics: ["stress_1h", "stress_avg"] },
  { key: "thietbi", title: ["Thiết bị", "Device"], tile: "tile-blue", metrics: ["not_worn_minutes", "no_live_minutes", "no_sync_hours", "watch_battery"] },
];

export function ruleGroups(lang: Lang): { key: string; title: string; tile: string; metrics: string[] }[] {
  return GROUPS.map((g) => ({ ...g, title: pick(g.title, lang) }));
}

const fmtVal = (v: number, lang: Lang) =>
  Number.isInteger(v) ? v.toLocaleString(lang === "en" ? "en-US" : "vi-VN")
    : v.toLocaleString(lang === "en" ? "en-US" : "vi-VN", { maximumFractionDigits: 1 });

/**
 * Nội dung cảnh báo theo ngôn ngữ. Tiếng Việt: câu backend đã lưu (giống tin Telegram).
 * Tiếng Anh: dựng lại từ chỉ số, giá trị và ngưỡng; thiếu thông tin thì dùng câu đã lưu.
 */
export function alertText(a: { metric: string; message: string; value?: number | null; comparator?: string | null;
  threshold?: number | null }, lang: Lang): string {
  if (lang === "vi") return a.message;
  const m = METRIC_TEXT[a.metric];
  if (a.metric === "medication") return `Medication not confirmed: ${a.message}`;
  if (!m || a.value == null || a.threshold == null || !a.comparator) return a.message;
  const unit = m.unit[1] ? ` ${m.unit[1]}` : "";
  const sign = a.comparator === "gt" ? ">" : "<";
  return `${m.label[1]} ${fmtVal(a.value, lang)}${unit} (threshold ${sign} ${fmtVal(a.threshold, lang)}${unit})`;
}
