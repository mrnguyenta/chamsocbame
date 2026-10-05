import "server-only";
import { cookies, headers } from "next/headers";
import { isLang, LANG_COOKIE, langFromAcceptLanguage, makeT, type Lang, type T } from "./i18n";

/** Ngôn ngữ người xem đã chọn (cookie), hoặc đoán từ trình duyệt. */
export async function getLang(): Promise<Lang> {
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLang(c)) return c;
  return langFromAcceptLanguage((await headers()).get("accept-language"));
}

export async function getT(): Promise<T> {
  return makeT(await getLang());
}
