"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useTransition } from "react";
import { LANG_COOKIE, makeT, type Lang, type T } from "@/lib/i18n";

const Ctx = createContext<Lang>("vi");

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <Ctx.Provider value={lang}>{children}</Ctx.Provider>;
}

export const useLang = (): Lang => useContext(Ctx);
export const useT = (): T => makeT(useContext(Ctx));

/** Nút đổi ngôn ngữ: lưu lựa chọn 1 năm rồi tải lại nội dung trang. */
export function LangSwitch({ className = "btn small ghost" }: { className?: string }) {
  const lang = useLang();
  const router = useRouter();
  const [pending, start] = useTransition();
  const next: Lang = lang === "vi" ? "en" : "vi";
  return (
    <button type="button" className={className} disabled={pending} lang={next}
      aria-label={next === "en" ? "Switch to English" : "Chuyển sang tiếng Việt"}
      onClick={() => {
        document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        start(() => router.refresh());
      }}>
      {next === "en" ? "EN" : "VI"}
    </button>
  );
}
