"use client";

import { useEffect, useRef } from "react";

/** Nút "Log in with Telegram". Widget chèn iframe ngay sau thẻ script, nên phải gắn vào một div. */
export default function TelegramLogin({ bot }: { bot: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || el.childElementCount) return;
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://telegram.org/js/telegram-widget.js?22";
    s.dataset.telegramLogin = bot;
    s.dataset.size = "large";
    s.dataset.radius = "10";
    s.dataset.authUrl = "/api/auth/telegram";
    s.dataset.requestAccess = "write";
    el.appendChild(s);
  }, [bot]);
  return <div ref={ref} style={{ minHeight: 44 }} />;
}
