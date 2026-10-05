// Hai ngôn ngữ giao diện: tiếng Việt (mặc định) và tiếng Anh.
// Cách dùng: t("Trang chủ", "Home"). Câu tiếng Việt viết trước, ngay tại chỗ dùng.
export type Lang = "vi" | "en";
export type T = (vi: string, en: string) => string;

export const LANG_COOKIE = "lang";

export const makeT = (lang: Lang): T => (vi, en) => (lang === "en" ? en : vi);

export const isLang = (v: unknown): v is Lang => v === "vi" || v === "en";

/** Lần đầu vào: trình duyệt có tiếng Việt thì tiếng Việt, không thì tiếng Anh. */
export function langFromAcceptLanguage(header: string | null | undefined): Lang {
  return /(^|[,\s])vi\b/i.test(header ?? "") ? "vi" : header ? "en" : "vi";
}
