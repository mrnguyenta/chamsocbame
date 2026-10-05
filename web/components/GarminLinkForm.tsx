"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { makeT, type Lang } from "@/lib/i18n";

type Status = "idle" | "starting" | "awaiting_mfa" | "checking_code" | "wrong_code" | "done" | "failed" | "expired";
const DONE: Status[] = ["done", "failed", "expired"];

/** Câu trạng thái do máy chủ Python ghi (luôn tiếng Việt) → tiếng Anh khi người xem chọn tiếng Anh. */
function localize(msg: string | null, lang: Lang): string | null {
  if (lang === "vi" || !msg) return msg;
  const paren = msg.match(/\(([^()]*)\)[^()]*$/)?.[1];
  if (msg.startsWith("Sai email")) return "Wrong Garmin email or password.";
  if (msg.startsWith("Garmin chưa cho đăng nhập")) return `Garmin isn't allowing sign-in right now; try again in a few minutes (${paren}).`;
  if (msg.startsWith("Garmin đã gửi mã")) return "Garmin sent a verification code to your email. Enter it below.";
  if (msg.startsWith("Hết thời gian chờ mã")) return "Timed out waiting for the verification code. Link again to get a new code.";
  if (msg.startsWith("Mã chưa đúng")) return "Incorrect code. Check your email and enter it again.";
  if (msg.startsWith("Không xác thực được mã")) return `Couldn't verify the code (${paren}). Try linking again.`;
  if (msg.startsWith("Đã liên kết Garmin Connect"))
    return `Garmin Connect linked${paren ? ` (${paren})` : ""}. Data will arrive in a few minutes.`;
  return msg;
}

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
  const lang = useLang();
  const t = makeT(lang);

  // Hỏi trạng thái mỗi 2 giây trong lúc máy chủ đang đăng nhập Garmin.
  useEffect(() => {
    if (status === "idle" || DONE.includes(status)) return;
    const timer = setInterval(async () => {
      if (!req.current) return;
      const r = await fetch(`/api/garmin/status?id=${req.current}`).then((x) => x.json()).catch(() => null);
      if (r && r.status !== "starting") {
        setStatus((s) => (DONE.includes(s) ? s : r.status));
        if (r.message) setMessage(r.message);
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [status]);

  async function start(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    req.current = crypto.randomUUID();
    setStatus("starting");
    setMessage(t("Đang đăng nhập Garmin…", "Signing in to Garmin…"));
    const r = await fetch("/api/garmin/start", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ request_id: req.current, elder_id: elderId, email: f.get("email"), password: f.get("password") }),
    }).then((x) => x.json()).catch(() => ({ status: "failed", message: t("Mất kết nối, thử lại.", "Connection lost, try again.") }));
    setStatus(r.status);
    setMessage(r.message);
    if (r.status === "done") router.refresh();
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setStatus("checking_code");
    setMessage(t("Đang kiểm tra mã…", "Checking the code…"));
    const r = await fetch("/api/garmin/mfa", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ request_id: req.current, code }),
    }).then((x) => x.json()).catch(() => ({ ok: false, message: t("Mất kết nối, thử lại.", "Connection lost, try again.") }));
    if (!r.ok) { setStatus("wrong_code"); setMessage(r.message); }
    setCode("");
  }

  const tone = status === "done" ? "info" : status === "failed" || status === "expired" || status === "wrong_code" ? "danger" : "info";

  return (
    <div className="rule" style={{ gap: 10 }}>
      {(status === "idle" || status === "failed" || status === "expired") && (
        <form onSubmit={start} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="muted" style={{ fontSize: 14 }}>
            {relink ? t("Đăng nhập lại Garmin Connect của người này.", "Sign in again to this person's Garmin Connect.")
              : t("Tài khoản Garmin Connect đang ghép với đồng hồ của người này.", "The Garmin Connect account paired with this person's watch.")}
            {" "}{t("Thêm giấc ngủ chi tiết, HRV, SpO2 ban đêm. Mật khẩu không được lưu.",
              "Adds detailed sleep, HRV and overnight SpO2. The password is not stored.")}
          </div>
          <label className="field">{t("Email Garmin", "Garmin email")}
            <input type="email" name="email" autoComplete="username" autoCapitalize="none" required />
          </label>
          <label className="field">{t("Mật khẩu Garmin", "Garmin password")}
            <input type="password" name="password" autoComplete="current-password" required />
          </label>
          <button className="btn primary small" type="submit" style={{ alignSelf: "flex-start" }}>
            {relink ? t("Liên kết lại", "Relink") : t("Liên kết Garmin Connect", "Link Garmin Connect")}
          </button>
        </form>
      )}
      {(status === "awaiting_mfa" || status === "wrong_code") && (
        <form onSubmit={sendCode} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label className="field">{t("Mã xác thực Garmin gửi về email", "Verification code Garmin emailed you")}
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code"
              required placeholder="123456" style={{ fontSize: 22, letterSpacing: 4, fontWeight: 700, minHeight: 52 }} />
          </label>
          <button className="btn primary small" type="submit" style={{ alignSelf: "flex-start" }}>{t("Xác nhận mã", "Confirm code")}</button>
        </form>
      )}
      {message && <div role="status" className={`banner ${tone}`}>{localize(message, lang)}</div>}

    </div>
  );
}
