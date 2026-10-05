"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBell, IconHome, IconPlus, IconUser, IconUsers } from "./icons";

// Trang con của "Tài khoản": gia đình, quản trị, kết nối đồng hồ.
const ACCOUNT = ["/tai-khoan", "/gia-dinh", "/quan-tri", "/cai-dat"];

function isActive(path: string, href: string): boolean {
  if (href === "/") return path === "/";
  if (href === "/tai-khoan") return ACCOUNT.some((p) => path.startsWith(p));
  return path.startsWith(href);
}

const ITEMS = [
  { href: "/", label: "Trang chủ", icon: <IconHome size={22} /> },
  { href: "/nguoi-than", label: "Người thân", icon: <IconUsers size={22} /> },
  { href: "/canh-bao", label: "Cảnh báo", icon: <IconBell size={22} /> },
  { href: "/tai-khoan", label: "Tài khoản", icon: <IconUser size={22} /> },
];

export function TopNav() {
  const path = usePathname();
  return (
    <nav className="topnav" aria-label="Điều hướng chính" style={{ gap: 4, flex: "1 1 auto" }}>
      {ITEMS.map((i) => (
        <Link key={i.href} href={i.href} aria-current={isActive(path, i.href) ? "page" : undefined}>{i.label}</Link>
      ))}
      <Link href="/ket-noi-dong-ho" aria-current={path.startsWith("/ket-noi-dong-ho") ? "page" : undefined}>Kết nối đồng hồ</Link>
    </nav>
  );
}

/** Thanh điều hướng dưới trên điện thoại: 4 mục, nút "+" ở giữa để kết nối đồng hồ. */
export function BottomNav() {
  const path = usePathname();
  const link = (i: (typeof ITEMS)[number]) => (
    <Link key={i.href} href={i.href} aria-current={isActive(path, i.href) ? "page" : undefined}>{i.icon}{i.label}</Link>
  );
  return (
    <nav className="bottomnav" aria-label="Điều hướng">
      {link(ITEMS[0])}{link(ITEMS[1])}
      <Link href="/ket-noi-dong-ho" className="fab" aria-label="Kết nối đồng hồ"><IconPlus size={26} /></Link>
      {link(ITEMS[2])}{link(ITEMS[3])}
    </nav>
  );
}
