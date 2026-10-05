"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import AIChat from "./AIChat";
import { useT } from "./LangProvider";

/** Nút chat AI nổi ở góc phải dưới mọi trang; bấm mở khung chat (điện thoại: toàn màn hình). */
export default function AIWidget() {
  const t = useT();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  if (path.startsWith("/hoi-ai")) return null; // trang Hỏi AI đã có khung chat lớn

  const suggestions = [
    t("Hôm nay cả nhà thế nào?", "How is everyone today?"),
    t("Tuần này ai ngủ kém nhất?", "Who slept worst this week?"),
    t("Có gì đáng lo trong 7 ngày qua không?", "Anything worrying in the last 7 days?"),
  ];
  return (
    <>
      {open && (
        <div className="ai-panel" role="dialog" aria-modal="false" aria-label={t("Trợ lý AI", "AI assistant")}>
          <div className="ai-panel-head">
            <span className="ai-avatar" aria-hidden><Mascot /></span>
            <span className="grow">
              <strong style={{ display: "block" }}>{t("Trợ lý AI", "AI assistant")}</strong>
              <span className="muted" style={{ fontSize: 12 }}>{t("Chỉ để tham khảo, không thay bác sĩ", "For reference only, not a doctor")}</span>
            </span>
            <Link href="/hoi-ai" className="btn ghost small" title={t("Mở to", "Open full page")} aria-label={t("Mở to", "Open full page")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
            </Link>
            <button type="button" className="btn ghost small" onClick={() => setOpen(false)} aria-label={t("Đóng", "Close")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <AIChat suggestions={suggestions} compact />
        </div>
      )}
      <button type="button" className={open ? "ai-fab open" : "ai-fab"} onClick={() => setOpen((o) => !o)}
        aria-expanded={open} aria-label={open ? t("Đóng trợ lý AI", "Close AI assistant") : t("Hỏi trợ lý AI", "Ask the AI assistant")}>
        <Mascot />
        {!open && <span className="ai-fab-tip" aria-hidden>{t("Hỏi mình nhé!", "Ask me!")}</span>}
      </button>
    </>
  );
}

/** Linh vật trợ lý: khối tròn mềm màu xanh ngọc, hai mắt biết chớp, ngôi sao nhỏ ở góc. */
function Mascot() {
  const grad = `mascot-${useId().replace(/:/g, "")}`;
  return (
    <svg className="mascot" viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2fbf9" />
          <stop offset="1" stopColor="#bfe9e2" />
        </linearGradient>
      </defs>
      <rect x="7" y="10" width="50" height="46" rx="22" fill={`url(#${grad})`} />
      <ellipse cx="32" cy="52" rx="16" ry="3" fill="#0d8079" opacity="0.12" />
      <g className="eyes" fill="#0b4f4b">
        <ellipse cx="24.5" cy="33" rx="3.6" ry="5.2" />
        <ellipse cx="39.5" cy="33" rx="3.6" ry="5.2" />
      </g>
      <ellipse cx="19" cy="41" rx="3.2" ry="1.8" fill="#f06b5b" opacity="0.35" />
      <ellipse cx="45" cy="41" rx="3.2" ry="1.8" fill="#f06b5b" opacity="0.35" />
      <circle cx="51" cy="13" r="8.5" fill="#fde4df" stroke="#fff" strokeWidth="2" />
      <path className="spark" d="M51 7.8l1.4 3.8 3.8 1.4-3.8 1.4L51 18.2l-1.4-3.8-3.8-1.4 3.8-1.4z" fill="#f06b5b" />
    </svg>
  );
}
