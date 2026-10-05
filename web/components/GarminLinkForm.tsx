"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Status = "idle" | "starting" | "awaiting_mfa" | "checking_code" | "wrong_code" | "done" | "failed" | "expired";
const DONE: Status[] = ["done", "failed", "expired"];

/**
 * Liên kết Garmin Connect của một người thân: email + mật khẩu Garmin, rồi mã xác thực nếu Garmin gửi về email.
 * Máy chủ chỉ lưu token đã mã hoá, không lưu mật khẩu.
 */
export default function GarminLinkForm({ elderId, relink }: { elderId: string; relink?: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const req = useRef<string | null>(null);

  // Hỏi trạng thái mỗi 2 giây trong lúc máy chủ đang đăng nhập Garmin.
  useEffect(() => {
    if (status === "idle" || DONE.includes(status)) return;
    const t = setInterval(async () => {
      if (!req.current) return;
      const r = await fetch(`/api/garmin/status?id=${req.current}`).then((x) => x.json()).catch(() => null);
      if (r && r.status !== "starting") {
        setStatus((s) => (DONE.includes(s) ? s : r.status));
        if (r.message) setMessage(r.message);
      }
    }, 2000);
    return () => clearInterval(t);
  }, [status]);

  async function start(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    req.current = crypto.randomUUID();
    setStatus("starting");
    setMessage("Đang đăng nhập Garmin…");
    const r = await fetch("/api/garmin/start", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ request_id: req.current, elder_id: elderId, email: f.get("email"), password: f.get("password") }),
    }).then((x) => x.json()).catch(() => ({ status: "failed", message: "Mất kết nối, thử lại." }));
    setStatus(r.status);
    setMessage(r.message);
    if (r.status === "done") router.refresh();
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setStatus("checking_code");
    setMessage("Đang kiểm tra mã…");
    const r = await fetch("/api/garmin/mfa", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ request_id: req.current, code }),
    }).then((x) => x.json()).catch(() => ({ ok: false, message: "Mất kết nối, thử lại." }));
    if (!r.ok) { setStatus("wrong_code"); setMessage(r.message); }
    setCode("");
  }

  const tone = status === "done" ? "info" : status === "failed" || status === "expired" || status === "wrong_code" ? "danger" : "info";

  return (
    <div className="rule" style={{ gap: 10 }}>
      {(status === "idle" || status === "failed" || status === "expired") && (
        <form onSubmit={start} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="muted" style={{ fontSize: 14 }}>
            {relink ? "Đăng nhập lại Garmin Connect của người này." : "Tài khoản Garmin Connect đang ghép với đồng hồ của người này."}
            {" "}Thêm giấc ngủ chi tiết, HRV, SpO2 ban đêm. Mật khẩu không được lưu.
          </div>
          <label className="field">Email Garmin
            <input type="email" name="email" autoComplete="username" autoCapitalize="none" required />
          </label>
          <label className="field">Mật khẩu Garmin
            <input type="password" name="password" autoComplete="current-password" required />
          </label>
          <button className="btn primary small" type="submit" style={{ alignSelf: "flex-start" }}>
            {relink ? "Liên kết lại" : "Liên kết Garmin Connect"}
          </button>
        </form>
      )}
      {(status === "awaiting_mfa" || status === "wrong_code") && (
        <form onSubmit={sendCode} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label className="field">Mã xác thực Garmin gửi về email
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code"
              required placeholder="123456" style={{ fontSize: 22, letterSpacing: 4, fontWeight: 700, minHeight: 52 }} />
          </label>
          <button className="btn primary small" type="submit" style={{ alignSelf: "flex-start" }}>Xác nhận mã</button>
        </form>
      )}
      {message && <div role="status" className={`banner ${tone}`}>{message}</div>}
    </div>
  );
}
