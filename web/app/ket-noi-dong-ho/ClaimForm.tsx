"use client";

import { useActionState } from "react";
import { type ActionState, claimWatch } from "../cai-dat/actions";

const INIT: ActionState = { ok: false, message: "" };

export default function ClaimForm({ elders, selected }: { elders: { id: string; name: string }[]; selected?: string }) {
  const [state, action, pending] = useActionState(claimWatch, INIT);
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <label className="field">Đồng hồ của ai?
        <select name="elder_id" defaultValue={selected ?? elders[0]?.id} required style={{ minHeight: 48, fontSize: 16 }}>
          {elders.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </label>
      <label className="field">Mã 6 số trên đồng hồ
        <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7}
          placeholder="482 917" required
          style={{ minHeight: 56, fontSize: 28, fontWeight: 700, letterSpacing: 6, borderRadius: 12,
            border: "2px solid var(--accent)", padding: "0 14px", background: "var(--surface)" }} />
      </label>
      <label className="field">Tên đồng hồ (không bắt buộc)
        <input type="text" name="label" placeholder="Venu 4 của Ba" />
      </label>
      <button className="btn primary" type="submit" disabled={pending} style={{ minHeight: 52, fontSize: 16 }}>
        {pending ? "Đang kết nối…" : "Kết nối đồng hồ"}
      </button>
      {state.message && (
        <div role="status" className={`banner ${state.ok ? "info" : "danger"}`}>{state.message}</div>
      )}
    </form>
  );
}
