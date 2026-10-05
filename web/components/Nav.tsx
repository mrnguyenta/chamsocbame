"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBell, IconChart, IconGear, IconHome, IconPlus } from "./icons";

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

export function TopNav() {
  const path = usePathname();
  const items = [
    { href: "/", label: "Tổng quan" },
    { href: "/nguoi-than", label: "Sức khoẻ" },
    { href: "/canh-bao", label: "Cảnh báo" },
    { href: "/ket-noi-dong-ho", label: "Kết nối đồng hồ" },
    { href: "/cai-dat", label: "Cài đặt" },
  ];
  return (
    <nav className="topnav" aria-label="Điều hướng chính" style={{ gap: 4, flex: "1 1 auto" }}>
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={isActive(path, i.href) ? "page" : undefined}>{i.label}</Link>
      ))}
    </nav>
  );
}

/** Thanh điều hướng dưới trên điện thoại, nút "+" ở giữa để kết nối đồng hồ. */
export function BottomNav() {
  const path = usePathname();
  const cur = (href: string) => (isActive(path, href) ? "page" : undefined);
  return (
    <nav className="bottomnav" aria-label="Điều hướng">
      <Link href="/" aria-current={cur("/")}><IconHome size={22} />Tổng quan</Link>
      <Link href="/nguoi-than" aria-current={cur("/nguoi-than")}><IconChart size={22} />Sức khoẻ</Link>
      <Link href="/ket-noi-dong-ho" className="fab" aria-label="Kết nối đồng hồ"><IconPlus size={26} /></Link>
      <Link href="/canh-bao" aria-current={cur("/canh-bao")}><IconBell size={22} />Cảnh báo</Link>
      <Link href="/cai-dat" aria-current={cur("/cai-dat")}><IconGear size={22} />Cài đặt</Link>
    </nav>
  );
}
