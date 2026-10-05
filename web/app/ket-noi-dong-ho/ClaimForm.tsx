"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useLang, useT } from "@/components/LangProvider";
import { conditions } from "@/lib/metrics";
import { type ClaimState, connectWatch } from "./actions";

const INIT: ClaimState = { ok: false, message: "" };

export default function ClaimForm({ elders, selected, code }: {
  elders: { id: string; name: string }[];
  selected?: string;
  /** Mã có sẵn khi mở từ thông báo trên điện thoại (/d/482917). */
  code?: string;
}) {
  const lang = useLang();
  const t = useT();
  const [state, action, pending] = useActionState(connectWatch, INIT);
  const [choice, setChoice] = useState(selected ?? elders[0]?.id ?? "new");
  const isNew = choice === "new";

  if (state.ok) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div role="status" className="banner info" style={{ fontWeight: 600 }}>{state.message}</div>
        <div className="muted" style={{ fontSize: 14 }}>
          {t("Dữ liệu đầu tiên về trong vài phút. Tiếp theo, mời anh chị em và nối nhóm Telegram để cùng nhận cảnh báo.",
            "The first data arrives in a few minutes. Next, invite your siblings and link a Telegram group so everyone gets alerts.")}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Link className="btn primary" href="/">{t("Xem sức khoẻ", "View health")}</Link>
          <Link className="btn" href="/gia-dinh">{t("Mời anh chị em, nối Telegram", "Invite siblings, link Telegram")}</Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {elders.length > 0 && (
        <label className="field">{t("Đồng hồ của ai?", "Whose watch is this?")}
          <select name="elder_id" value={choice} onChange={(e) => setChoice(e.target.value)} style={{ minHeight: 48, fontSize: 16 }}>
            {elders.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            <option value="new">＋ {t("Người khác…", "Someone else…")}</option>
          </select>
        </label>
      )}
      {isNew && (
        <>
          <label className="field">{elders.length ? t("Cách gọi người đeo đồng hồ", "What do you call the wearer?") : t("Đồng hồ của ai?", "Whose watch is this?")}
            <input type="text" name="name" required placeholder={t("Ba Hùng, Mẹ Lan, hoặc tên bạn", "Dad, Mom, or your name")} style={{ minHeight: 48, fontSize: 16 }} />
          </label>
          <div className="muted" style={{ fontSize: 14 }}>{t("Bệnh nền (không bắt buộc, để tự đặt ngưỡng cảnh báo phù hợp)", "Health conditions (optional, to set suitable alert thresholds)")}</div>
          <div className="row" style={{ gap: 8 }}>
            {Object.entries(conditions(lang)).map(([k, label]) => (
              <label key={k} className="check-chip">
                <input type="checkbox" name={`c_${k}`} />
                <span className="tick" aria-hidden>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="M5 12l5 5 9-10" /></svg>
                </span>
                {label}
              </label>
            ))}
          </div>
        </>
      )}
      <label className="field">{t("Mã 6 số trên đồng hồ", "6-digit code on the watch")}
        <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7}
          placeholder="482 917" required defaultValue={code ? `${code.slice(0, 3)} ${code.slice(3)}` : undefined}
          style={{ minHeight: 56, fontSize: 28, fontWeight: 700, letterSpacing: 6, borderRadius: 12,
            border: "2px solid var(--accent)", padding: "0 14px", background: "var(--surface)" }} />
      </label>
      <details>
        <summary className="muted" style={{ cursor: "pointer", fontSize: 14 }}>{t("Tuỳ chọn: đặt tên đồng hồ", "Optional: name the watch")}</summary>
        <label className="field" style={{ marginTop: 8 }}>{t("Tên đồng hồ", "Watch name")}
          <input type="text" name="label" placeholder={t("Fenix 7 của Ba", "Dad's Fenix 7")} />
        </label>
      </details>
      <button className="btn primary" type="submit" disabled={pending} style={{ minHeight: 52, fontSize: 16 }}>
        {pending ? t("Đang kết nối…", "Connecting…") : t("Kết nối đồng hồ", "Connect watch")}
      </button>
      {state.message && <div role="status" className="banner danger">{state.message}</div>}
    </form>
  );
}
