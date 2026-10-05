"use client";

import { useEffect, useState } from "react";
import { IconTelegram } from "./icons";
import { useT } from "@/components/LangProvider";

/** Gửi link trang hiện tại cho người khác: Zalo/Messenger (chia sẻ của máy), Telegram, hoặc chép. */
export default function ShareLink({ text }: { text: string }) {
  const [url, setUrl] = useState("");
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const t = useT();
  useEffect(() => {
    setUrl(window.location.href);
    setCanShare(typeof navigator.share === "function");
  }, []);
  return (
    <div className="row" style={{ gap: 8, justifyContent: "center" }}>
      {canShare && (
        <button type="button" className="btn primary" onClick={() => navigator.share({ text, url }).catch(() => {})}>
          {t("Gửi cho con cháu (Zalo, Messenger…)", "Send to family (WhatsApp, Messenger…)")}
        </button>
      )}
      <a className="btn" target="_blank" rel="noreferrer"
        href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`}>
        <IconTelegram size={16} /> {t("Gửi qua Telegram", "Send via Telegram")}
      </a>
      <button type="button" className="btn" onClick={async () => {
        try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* bỏ qua */ }
      }}>{copied ? t("Đã chép", "Copied") : t("Chép link", "Copy link")}
</button>
    </div>
  );
}
