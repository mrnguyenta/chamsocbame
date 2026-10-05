const TZ = "Asia/Ho_Chi_Minh";

export const fmtNum = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : v.toLocaleString("vi-VN");

export function fmtDuration(seconds: number | null | undefined): string {
  if (!seconds) return "—";
  const m = Math.round(seconds / 60);
  return `${Math.floor(m / 60)}g ${String(m % 60).padStart(2, "0")}p`;
}

export function fmtTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
}

export function fmtDateTime(isoStr: string): string {
  return new Date(isoStr).toLocaleString("vi-VN", {
    hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", timeZone: TZ,
  });
}

export function fmtAgo(isoStr: string | null, now = Date.now()): string {
  if (!isoStr) return "chưa có dữ liệu";
  const min = Math.max(0, Math.round((now - new Date(isoStr).getTime()) / 60_000));
  if (min < 1) return "vừa xong";
  if (min < 60) return `${min} phút trước`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} giờ trước`;
  return `${Math.round(h / 24)} ngày trước`;
}

export function age(birthYear: number | null): string {
  return birthYear ? `${new Date().getFullYear() - birthYear} tuổi` : "";
}
