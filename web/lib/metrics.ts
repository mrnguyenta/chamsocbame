// Nhãn hiển thị; giữ khớp với backend/chamsoc/rules.py (METRICS).
export const METRICS: Record<string, { label: string; unit: string; hint: string }> = {
  resting_hr: { label: "Nhịp tim nghỉ", unit: "bpm", hint: "Garmin tính mỗi ngày" },
  hr_now: { label: "Nhịp tim hiện tại", unit: "bpm", hint: "Trung vị 10 phút, cần ứng dụng đồng hồ; bỏ qua khi đang đi lại" },
  spo2_min: { label: "SpO2 thấp nhất", unit: "%", hint: "Đo ban đêm" },
  sleep_hours: { label: "Giấc ngủ", unit: "giờ", hint: "Tổng thời gian ngủ đêm qua" },
  steps: { label: "Bước chân", unit: "bước", hint: "Nên đặt giờ kiểm tra, ví dụ 18:00" },
  body_battery: { label: "Body Battery", unit: "", hint: "Năng lượng cơ thể 0–100" },
  stress_avg: { label: "Stress trung bình", unit: "", hint: "Thang Garmin 0–100" },
  no_sync_hours: { label: "Garmin Connect chưa đồng bộ", unit: "giờ", hint: "Đồng hồ → điện thoại → Garmin" },
  no_live_minutes: { label: "Đồng hồ chưa gửi dữ liệu", unit: "phút", hint: "Ứng dụng đồng hồ gửi mỗi 5 phút" },
  watch_battery: { label: "Pin đồng hồ", unit: "%", hint: "Không báo khi đang sạc" },
  systolic: { label: "Huyết áp tâm thu", unit: "mmHg", hint: "Số trên" },
  diastolic: { label: "Huyết áp tâm trương", unit: "mmHg", hint: "Số dưới" },
  glucose: { label: "Đường huyết", unit: "mmol/L", hint: "Nhập tay qua Telegram" },
};

export const SEVERITY: Record<string, { label: string; tone: string }> = {
  info: { label: "Nhắc nhở", tone: "neutral" },
  warn: { label: "Chú ý", tone: "warn" },
  high: { label: "Cao", tone: "danger" },
  urgent: { label: "Khẩn cấp", tone: "urgent" },
};

export const CONDITIONS: Record<string, string> = {
  tang_huyet_ap: "Tăng huyết áp",
  tim_mach: "Tim mạch",
  tieu_duong: "Tiểu đường",
  copd: "Bệnh phổi (COPD)",
};

export const STATUS: Record<string, { label: string; tone: string }> = {
  ok: { label: "Ổn định", tone: "ok" },
  attention: { label: "Cần chú ý", tone: "danger" },
  offline: { label: "Mất kết nối", tone: "warn" },
  nodata: { label: "Chưa có dữ liệu", tone: "neutral" },
};

/** Nhóm ngưỡng trên trang Cài đặt. */
export const RULE_GROUPS: { key: string; title: string; tile: string; metrics: string[] }[] = [
  { key: "tim", title: "Tim mạch & SpO2", tile: "tile-coral", metrics: ["hr_now", "resting_hr", "spo2_min"] },
  { key: "ha", title: "Huyết áp & đường huyết", tile: "tile-violet", metrics: ["systolic", "diastolic", "glucose"] },
  { key: "vandong", title: "Vận động & giấc ngủ", tile: "tile-teal", metrics: ["steps", "sleep_hours", "body_battery", "stress_avg"] },
  { key: "thietbi", title: "Thiết bị", tile: "tile-blue", metrics: ["no_live_minutes", "no_sync_hours", "watch_battery"] },
];
