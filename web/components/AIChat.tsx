"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "./LangProvider";

type Msg = { role: "user" | "assistant"; content: string; error?: boolean };

const STORE = "ai-chat";

function load(): Msg[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(STORE) ?? "[]");
    return Array.isArray(v) ? v.slice(-30) : [];
  } catch {
    return [];
  }
}

/**
 * Khung chat hỏi AI về sức khoẻ cả nhà; giữ vài lượt gần nhất để AI hiểu câu hỏi nối tiếp.
 * Cuộc trò chuyện lưu trong tab trình duyệt, dùng chung giữa nút chat nổi và trang Hỏi AI.
 */
export default function AIChat({ suggestions, compact = false }: { suggestions: string[]; compact?: boolean }) {
  const t = useT();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setMsgs(load()); }, []);
  useEffect(() => {
    try { sessionStorage.setItem(STORE, JSON.stringify(msgs.slice(-30))); } catch { /* chế độ riêng tư */ }
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);
  useEffect(() => { if (compact) input.current?.focus(); }, [compact]);

  async function ask(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    const history = msgs.filter((m) => !m.error).map(({ role, content }) => ({ role, content }));
    setMsgs((m) => [...m, { role: "user", content: question }]);
    setText("");
    setBusy(true);
    try {
      const r = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, history }) });
      const j = await r.json();
      setMsgs((m) => [...m, { role: "assistant", content: j.answer, error: !j.ok }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: t("Mất kết nối, thử lại nhé.", "Connection lost, please try again."), error: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "ai-chat compact" : "ai-chat"}>
      <div className="chat" aria-live="polite">
        {msgs.length === 0 && (
          <>
            <div className="bubble assistant">{t(
              "Chào bạn! Mình đọc được số liệu đồng hồ, huyết áp, thuốc và cảnh báo của cả nhà. Bạn muốn hỏi gì?",
              "Hi! I can read the family's watch data, blood pressure, medicines and alerts. What would you like to know?")}</div>
            <div className="suggest">
              {suggestions.map((s) => (
                <button key={s} type="button" className="btn small" onClick={() => ask(s)}>{s}</button>
              ))}
            </div>
          </>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`bubble ${m.role}${m.error ? " error" : ""}`}>{m.content}</div>
        ))}
        {busy && <div className="bubble assistant typing" aria-label={t("AI đang trả lời", "The AI is answering")}><span /><span /><span /></div>}
        <div ref={end} />
      </div>
      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); ask(text); }}>
        <textarea ref={input} value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={2000}
          placeholder={t("Hỏi về sức khoẻ của ba mẹ, người thân…", "Ask about your loved ones' health…")}
          aria-label={t("Câu hỏi", "Question")}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(text); } }} />
        <button className="btn primary" type="submit" disabled={busy || !text.trim()} aria-label={t("Gửi", "Send")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>
        </button>
      </form>
      {msgs.length > 0 && (
        <button type="button" className="link-sm clear" onClick={() => setMsgs([])}>{t("Cuộc trò chuyện mới", "New conversation")}</button>
      )}
    </div>
  );
}
