"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { T } from "@/lib/i18n";
import { IconBell, IconGear, IconHeart, IconHome, IconPlus, IconUser, IconUsers, IconWatch } from "./icons";
import { LangSwitch, useT } from "./LangProvider";

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

/** Menu bên trái trên máy tính (từ 900px): đủ chỗ cho nhãn tiếng Việt dài, không bị xuống dòng. */
export function SideNav({ name, isSystemAdmin, canSignOut }: { name: string; isSystemAdmin: boolean; canSignOut: boolean }) {
  const path = usePathname();
  const t = useT();
  return (
    <aside className="sidenav">
      <Link href="/" className="brand">
        <span aria-hidden className="icon-tile" style={{ background: "var(--accent-strong)", color: "#fff", borderRadius: 12 }}>
          <IconHeart size={20} />
        </span>
        <strong>{t("Chăm Sóc Người Thân", "Family Care")}</strong>
      </Link>
      <nav aria-label={t("Điều hướng chính", "Main navigation")}>
        {items(t).map((i) => (
          <Link key={i.href} href={i.href} className="item" aria-current={isActive(path, i.href) ? "page" : undefined}>
            {i.icon}<span>{i.label}</span>
          </Link>
        ))}
        {isSystemAdmin && (
          <Link href="/quan-tri" className="item" aria-current={path.startsWith("/quan-tri") ? "page" : undefined}>
            <IconGear size={22} /><span>{t("Quản trị", "Admin")}</span>
          </Link>
        )}
      </nav>
      <Link href="/ket-noi-dong-ho" className="btn primary" style={{ marginTop: 8 }}>
        <IconWatch size={18} />{t("Kết nối đồng hồ", "Connect watch")}
      </Link>
      <div style={{ flex: 1 }} />
      <div className="side-foot">
        <Link href="/tai-khoan" className="who" title={t("Tài khoản", "Account")}>
          <IconUser size={18} /><span>{name}</span>
        </Link>
        <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
          <LangSwitch className="btn small" />
          {canSignOut && (
            <form action="/api/auth/logout" method="post" style={{ flex: 1 }}>
              <button className="btn small" type="submit" style={{ width: "100%" }}>{t("Đăng xuất", "Sign out")}</button>
            </form>
          )}
        </div>
      </div>
    </aside>
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
