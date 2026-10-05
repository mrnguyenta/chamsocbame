"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/LangProvider";

type Msg = { role: "user" | "assistant"; content: string; error?: boolean };

/** Khung chat hỏi AI; giữ vài lượt gần nhất để AI hiểu câu hỏi nối tiếp. */
export default function AskAI({ suggestions }: { suggestions: string[] }) {
  const t = useT();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy]);

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
    <section className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {msgs.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="muted" style={{ fontSize: 14 }}>{t("Thử hỏi:", "Try asking:")}</div>
          <div className="row" style={{ gap: 8 }}>
            {suggestions.map((s) => (
              <button key={s} type="button" className="btn small" onClick={() => ask(s)} style={{ textAlign: "left" }}>{s}</button>
            ))}
          </div>
        </div>
      )}
      <div className="chat" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={`bubble ${m.role}${m.error ? " error" : ""}`}>{m.content}</div>
        ))}
        {busy && <div className="bubble assistant muted">{t("AI đang xem số liệu…", "The AI is looking at the data…")}</div>}
        <div ref={end} />
      </div>
      <form className="row" style={{ gap: 8, flexWrap: "nowrap", alignItems: "flex-end" }}
        onSubmit={(e) => { e.preventDefault(); ask(text); }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={2000}
          placeholder={t("Hỏi về sức khoẻ của ba mẹ, người thân…", "Ask about your loved ones' health…")}
          aria-label={t("Câu hỏi", "Question")}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(text); } }}
          style={{ flex: 1, minHeight: 48, fontSize: 16, resize: "vertical" }} />
        <button className="btn primary" type="submit" disabled={busy || !text.trim()}>{t("Hỏi", "Ask")}</button>
      </form>
    </section>
  );
}
