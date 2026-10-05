import type { Lang } from "./i18n";

const TZ = "Asia/Ho_Chi_Minh";
const locale = (lang: Lang) => (lang === "en" ? "en-GB" : "vi-VN");

export const fmtNum = (v: number | null | undefined, lang: Lang = "vi") =>
  v === null || v === undefined ? "—" : v.toLocaleString(lang === "en" ? "en-US" : "vi-VN");

export function fmtDuration(seconds: number | null | undefined, lang: Lang = "vi"): string {
  if (!seconds) return "—";
  const m = Math.round(seconds / 60);
  const [h, mm] = [Math.floor(m / 60), String(m % 60).padStart(2, "0")];
  return lang === "en" ? `${h}h ${mm}m` : `${h}g ${mm}p`;
}

export function fmtTime(isoStr: string, lang: Lang = "vi"): string {
  return new Date(isoStr).toLocaleTimeString(locale(lang), { hour: "2-digit", minute: "2-digit", timeZone: TZ });
}

export function fmtDateTime(isoStr: string, lang: Lang = "vi"): string {
  return new Date(isoStr).toLocaleString(locale(lang), {
    hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", timeZone: TZ,
  });
}

export function fmtAgo(isoStr: string | null, now = Date.now(), lang: Lang = "vi"): string {
  const en = lang === "en";
  if (!isoStr) return en ? "no data yet" : "chưa có dữ liệu";
  const min = Math.max(0, Math.round((now - new Date(isoStr).getTime()) / 60_000));
  if (min < 1) return en ? "just now" : "vừa xong";
  if (min < 60) return en ? `${min} min ago` : `${min} phút trước`;
  const h = Math.round(min / 60);
  if (h < 48) return en ? `${h} h ago` : `${h} giờ trước`;
  const d = Math.round(h / 24);
  return en ? `${d} days ago` : `${d} ngày trước`;
}

export function age(birthYear: number | null, lang: Lang = "vi"): string {
  if (!birthYear) return "";
  const n = new Date().getFullYear() - birthYear;
  return lang === "en" ? `age ${n}` : `${n} tuổi`;
}
