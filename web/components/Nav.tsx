"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { T } from "@/lib/i18n";
import { IconBell, IconHome, IconPlus, IconUser, IconUsers } from "./icons";
import { useT } from "./LangProvider";

// Trang con của "Tài khoản": gia đình, quản trị, kết nối đồng hồ.
const ACCOUNT = ["/tai-khoan", "/gia-dinh", "/quan-tri", "/cai-dat"];

function isActive(path: string, href: string): boolean {
  if (href === "/") return path === "/";
  if (href === "/tai-khoan") return ACCOUNT.some((p) => path.startsWith(p));
  return path.startsWith(href);
}

const items = (t: T) => [
  { href: "/", label: t("Trang chủ", "Home"), icon: <IconHome size={22} /> },
  { href: "/nguoi-than", label: t("Người thân", "Relatives"), icon: <IconUsers size={22} /> },
  { href: "/canh-bao", label: t("Cảnh báo", "Alerts"), icon: <IconBell size={22} /> },
  { href: "/tai-khoan", label: t("Tài khoản", "Account"), icon: <IconUser size={22} /> },
];

export function TopNav() {
  const path = usePathname();
  const t = useT();
  return (
    <nav className="topnav" aria-label={t("Điều hướng chính", "Main navigation")} style={{ gap: 4, flex: "1 1 auto" }}>
      {items(t).map((i) => (
        <Link key={i.href} href={i.href} aria-current={isActive(path, i.href) ? "page" : undefined}>{i.label}</Link>
      ))}
      <Link href="/ket-noi-dong-ho" aria-current={path.startsWith("/ket-noi-dong-ho") ? "page" : undefined}>{t("Kết nối đồng hồ", "Connect watch")}</Link>
    </nav>
  );
}

/** Thanh điều hướng dưới trên điện thoại: 4 mục, nút "+" ở giữa để kết nối đồng hồ. */
export function BottomNav() {
  const path = usePathname();
  const t = useT();
  const ITEMS = items(t);
  const link = (i: (typeof ITEMS)[number]) => (
    <Link key={i.href} href={i.href} aria-current={isActive(path, i.href) ? "page" : undefined}>{i.icon}{i.label}</Link>
  );
  return (
    <nav className="bottomnav" aria-label={t("Điều hướng", "Navigation")}>
      {link(ITEMS[0])}{link(ITEMS[1])}
      <Link href="/ket-noi-dong-ho" className="fab" aria-label={t("Kết nối đồng hồ", "Connect watch")}><IconPlus size={26} /></Link>
      {link(ITEMS[2])}{link(ITEMS[3])}
    </nav>
  );
}
