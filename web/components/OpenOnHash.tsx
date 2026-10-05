"use client";

import { useEffect } from "react";

/** Đóng các khối cùng nhóm (thuộc tính name) với khối vừa mở; trình duyệt mới tự làm, đây là dự phòng. */
function closeSiblings(el: HTMLDetailsElement) {
  const group = el.getAttribute("name");
  if (!group) return;
  document.querySelectorAll<HTMLDetailsElement>(`details[name="${CSS.escape(group)}"]`).forEach((d) => {
    if (d !== el && d.open) d.open = false;
  });
}

/**
 * Mở khối <details> có id trùng #hash (ví dụ /nguoi-than/x#nguong) rồi cuộn tới đó.
 * Bấm lại cùng một nút (#hash không đổi) vẫn mở lại khối; bấm "#tong-quan" thì đóng hết cho gọn.
 */
export default function OpenOnHash() {
  useEffect(() => {
    const openId = (id: string) => {
      const el = id ? document.getElementById(id) : null;
      if (el instanceof HTMLDetailsElement) {
        el.open = true;
        closeSiblings(el);
        el.scrollIntoView({ block: "start", behavior: "smooth" });
      } else if (el) {
        document.querySelectorAll<HTMLDetailsElement>("details.block[name][open]").forEach((d) => { d.open = false; });
      }
    };
    const onHash = () => openId(decodeURIComponent(location.hash.slice(1)));
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element).closest?.("a[href^='#']");
      if (a && a.getAttribute("href") === location.hash) openId(decodeURIComponent(location.hash.slice(1)));
    };
    const onToggle = (e: Event) => {
      const d = e.target;
      if (d instanceof HTMLDetailsElement && d.open) closeSiblings(d);
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    document.addEventListener("click", onClick);
    document.addEventListener("toggle", onToggle, true);
    return () => {
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener("click", onClick);
      document.removeEventListener("toggle", onToggle, true);
    };
  }, []);
  return null;
}
