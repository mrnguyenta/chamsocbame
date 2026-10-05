"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/components/LangProvider";

/** Quản trị tạo báo cáo tuần trọn gần nhất ngay, có thể gửi luôn vào nhóm Telegram. */
export default function CreateReport() {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [send, setSend] = useState(false);
  const [err, setErr] = useState("");
  return (
    <section className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="row" style={{ gap: 10 }}>
        <button className="btn primary" type="button" disabled={busy} onClick={async () => {
          setBusy(true); setErr("");
          try {
            const r = await fetch("/api/bao-cao", { method: "POST", headers: { "content-type": "application/json" },
              body: JSON.stringify({ send_telegram: send }) });
            const j = await r.json();
            if (j.ok) router.push(`/bao-cao/${j.id}`); else setErr(j.message);
          } catch {
            setErr(t("Mất kết nối, thử lại nhé.", "Connection lost, please try again."));
          } finally {
            setBusy(false);
          }
        }}>{busy ? t("Đang làm báo cáo (khoảng 1 phút)…", "Making the report (about a minute)…") : t("Tạo báo cáo tuần ngay", "Create this week's report now")}</button>
        <label className="check-chip">
          <input type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} />
          <span className="tick" aria-hidden>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="M5 12l5 5 9-10" /></svg>
          </span>
          {t("Gửi luôn vào nhóm Telegram", "Also post to the Telegram group")}
        </label>
      </div>
      {err && <div role="status" className="banner danger">{err}</div>}
    </section>
  );
}
