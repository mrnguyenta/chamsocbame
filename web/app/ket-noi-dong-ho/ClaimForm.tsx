"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CONDITIONS } from "@/lib/metrics";
import { type ClaimState, connectWatch } from "./actions";

const INIT: ClaimState = { ok: false, message: "" };

export default function ClaimForm({ elders, selected, code }: {
  elders: { id: string; name: string }[];
  selected?: string;
  /** Mã có sẵn khi mở từ thông báo trên điện thoại (/d/482917). */
  code?: string;
}) {
  const [state, action, pending] = useActionState(connectWatch, INIT);
  const [choice, setChoice] = useState(selected ?? elders[0]?.id ?? "new");
  const isNew = choice === "new";

  if (state.ok) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div role="status" className="banner info" style={{ fontWeight: 600 }}>{state.message}</div>
        <div className="muted" style={{ fontSize: 14 }}>
          Dữ liệu đầu tiên về trong vài phút. Tiếp theo, mời anh chị em và nối nhóm Telegram để cùng nhận cảnh báo.
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Link className="btn primary" href="/">Xem sức khoẻ</Link>
          <Link className="btn" href="/gia-dinh">Mời anh chị em, nối Telegram</Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {elders.length > 0 && (
        <label className="field">Đồng hồ của ai?
          <select name="elder_id" value={choice} onChange={(e) => setChoice(e.target.value)} style={{ minHeight: 48, fontSize: 16 }}>
            {elders.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            <option value="new">＋ Người khác…</option>
          </select>
        </label>
      )}
      {isNew && (
        <>
          <label className="field">{elders.length ? "Cách gọi người đeo đồng hồ" : "Đồng hồ của ai?"}
            <input type="text" name="name" required placeholder="Ba Hùng, Mẹ Lan, hoặc tên bạn" style={{ minHeight: 48, fontSize: 16 }} />
          </label>
          <div className="muted" style={{ fontSize: 14 }}>Bệnh nền (không bắt buộc, để tự đặt ngưỡng cảnh báo phù hợp)</div>
          <div className="row" style={{ gap: 8 }}>
            {Object.entries(CONDITIONS).map(([k, label]) => (
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
      <label className="field">Mã 6 số trên đồng hồ
        <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7}
          placeholder="482 917" required defaultValue={code ? `${code.slice(0, 3)} ${code.slice(3)}` : undefined}
          style={{ minHeight: 56, fontSize: 28, fontWeight: 700, letterSpacing: 6, borderRadius: 12,
            border: "2px solid var(--accent)", padding: "0 14px", background: "var(--surface)" }} />
      </label>
      <details>
        <summary className="muted" style={{ cursor: "pointer", fontSize: 14 }}>Tuỳ chọn: đặt tên đồng hồ</summary>
        <label className="field" style={{ marginTop: 8 }}>Tên đồng hồ
          <input type="text" name="label" placeholder="Fenix 7 của Ba" />
        </label>
      </details>
      <button className="btn primary" type="submit" disabled={pending} style={{ minHeight: 52, fontSize: 16 }}>
        {pending ? "Đang kết nối…" : "Kết nối đồng hồ"}
      </button>
      {state.message && <div role="status" className="banner danger">{state.message}</div>}
    </form>
  );
}
