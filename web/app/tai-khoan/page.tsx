import Link from "next/link";
import Block from "@/components/Block";
import OpenOnHash from "@/components/OpenOnHash";
import {
  IconBell, IconChevron, IconGear, IconTelegram, IconUser, IconUsers, IconWatch,
} from "@/components/icons";
import { Avatar } from "@/components/ui";
import { getSession, requireIdentity } from "@/lib/auth";
import { getBot } from "@/lib/bot";
import { getFamilyAdmin, getSettings } from "@/lib/data";
import { getT } from "@/lib/i18n-server";
import { FamilyForm } from "../cai-dat/forms";
import { switchFamily } from "../gia-dinh/actions";
import { LinkCodeForm } from "../gia-dinh/forms";
import { NameForm, PasswordForm } from "./forms";

export const dynamic = "force-dynamic";

function Row({ href, icon, tile, title, sub }: { href: string; icon: React.ReactNode; tile: string; title: string; sub?: string }) {
  return (
    <Link href={href} className="list-row" style={{ textDecoration: "none", color: "var(--text)" }}>
      <span className={`icon-tile ${tile}`}>{icon}</span>
      <span className="grow">
        <span className="title" style={{ display: "block" }}>{title}</span>
        {sub && <span className="muted">{sub}</span>}
      </span>
      <IconChevron size={18} />
    </Link>
  );
}

/** Tài khoản là trung tâm: hồ sơ, Telegram của tôi, gia đình, báo cáo, đồng hồ, quản trị. */
export default async function AccountPage() {
  const me = await requireIdentity("/tai-khoan");
  const t = await getT();
  const session = await getSession();
  const [fam, settings, bot] = session
    ? await Promise.all([getFamilyAdmin(session.familyId, session.caregiverId), getSettings(session.familyId), getBot()])
    : [null, null, null];
  const mine = fam?.members.find((m) => m.isMe);

  return (
    <main className="container" style={{ maxWidth: 760 }}>
      <OpenOnHash />
      <section className="card row" style={{ gap: 16, flexWrap: "nowrap" }}>
        <Avatar name={me.name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>{session?.name ?? me.name}</h1>
          <div className="muted" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{me.email}</div>
        </div>
        <form action="/api/auth/logout" method="post"><button className="btn small" type="submit">{t("Đăng xuất", "Sign out")}</button></form>
      </section>

      {!session && (
        <section className="card">
          <p style={{ marginTop: 0 }}>{t("Bạn chưa ở trong gia đình nào.", "You aren't in a family yet.")}</p>
          <Link className="btn primary" href="/bat-dau">{t("Tạo gia đình hoặc vào bằng link mời", "Create a family or join with an invite link")}</Link>
        </section>
      )}

      {session && fam && settings && (
        <>
          <Block id="gia-dinh" icon={<IconUsers size={20} />} tile="tile-violet" title={`${t("Gia đình", "Family")} · ${fam.name}`}
            sub={t(`${fam.elders.length} người thân · ${fam.members.length} người chăm sóc · ${fam.groups.length} nhóm Telegram`,
              `${fam.elders.length} loved ones · ${fam.members.length} caregivers · ${fam.groups.length} Telegram groups`)} open>
            {session.families.length > 1 && (
              <nav className="pills" aria-label={t("Chọn gia đình", "Choose family")}>
                {session.families.map((f) => (
                  <form key={f.id} action={switchFamily}>
                    <input type="hidden" name="family_id" value={f.id} />
                    <button className="pill" type="submit" aria-current={f.id === session.familyId ? "page" : undefined}
                      style={{ cursor: "pointer" }}>{f.name}</button>
                  </form>
                ))}
              </nav>
            )}
            <ul className="list">
              <li><Row href="/nguoi-than" icon={<IconUser size={20} />} tile="tile-coral" title={t("Ba mẹ & người thân", "Parents & loved ones")}
                sub={fam.elders.map((e) => e.name).join(", ") || t("Chưa có ai", "No one yet")} /></li>
              <li><Row href="/gia-dinh" icon={<IconUsers size={20} />} tile="tile-violet" title={t("Anh chị em & lời mời", "Siblings & invites")}
                sub={t(`${fam.members.length} người · thêm bằng email hoặc gửi link mời`, `${fam.members.length} people · add by email or send an invite link`)} /></li>
              <li><Row href="/gia-dinh#telegram" icon={<IconTelegram size={20} />} tile="tile-blue" title={t("Nhóm Telegram gia đình", "Family Telegram group")}
                sub={fam.groups.map((g) => g.title ?? t("Nhóm Telegram", "Telegram group")).join(", ") || t("Chưa nối nhóm nào", "No group connected yet")} /></li>
              <li><Row href="/bat-dau" icon={<IconUsers size={20} />} tile="tile-teal" title={t("Gia đình khác", "Other families")}
                sub={t("Tạo thêm (bên nội / bên ngoại) hoặc vào bằng link mời", "Create another (e.g. the other side of the family) or join with an invite link")} /></li>
            </ul>
          </Block>

          <Block id="telegram" icon={<IconTelegram size={20} />} tile="tile-blue" title={t("Telegram của tôi", "My Telegram")}
            sub={mine?.hasTelegram
              ? t("Đã nối · nhận cảnh báo riêng và bấm “Tôi xử lý”", "Connected · get personal alerts and tap “Tôi xử lý” (I'll handle it) in Telegram")
              : t("Chưa nối · nối để nhận cảnh báo riêng", "Not connected · connect to get personal alerts")}
            open={!mine?.hasTelegram}>
            <p className="muted" style={{ margin: 0 }}>
              {t("Cảnh báo luôn gửi vào nhóm gia đình. Nối Telegram riêng để bot nhắn thẳng cho bạn khi chưa ai nhận xử lý.",
                "Alerts always go to the family group. Connect your own Telegram so the bot messages you directly when no one has taken an alert yet.")}
            </p>
            <LinkCodeForm bot={bot?.username} kind="caregiver" label={mine?.hasTelegram ? t("Nối lại Telegram của tôi", "Reconnect my Telegram") : t("Nối Telegram của tôi", "Connect my Telegram")} />
          </Block>

          <Block id="bao-cao" icon={<IconBell size={20} />} tile="tile-amber" title={t("Báo cáo & giờ yên lặng", "Reports & quiet hours")}
            sub={`${t("Báo cáo", "Reports at")} ${settings.family.morningReportAt}${settings.family.eveningReportAt ? ` ${t("và", "and")} ${settings.family.eveningReportAt}` : ""} · ${t("yên lặng", "quiet")} ${settings.family.quietStart}–${settings.family.quietEnd}`}>
            <FamilyForm f={settings.family} canEdit={session.isAdmin} />
          </Block>

          <Block id="dong-ho" icon={<IconWatch size={20} />} tile="tile-teal" title={t("Đồng hồ", "Watch")}
            sub={t("Kết nối đồng hồ Garmin cho ba mẹ bằng mã 6 số", "Connect your parent's Garmin watch with a 6-digit code")}>
            <Link className="btn primary small" href="/ket-noi-dong-ho" style={{ alignSelf: "flex-start" }}>
              {t("Kết nối đồng hồ", "Connect watch")} <span className="arrow"><IconChevron size={16} /></span>
            </Link>
          </Block>
        </>
      )}

      <Block id="ho-so" icon={<IconUser size={20} />} tile="tile-teal" title={t("Hồ sơ & mật khẩu", "Profile & password")} sub={t("Đổi tên hiển thị, đổi mật khẩu", "Change display name, change password")}>
        <NameForm name={me.name} />
        <div className="section-title" style={{ margin: "6px 0 0" }}>{t("Đổi mật khẩu", "Change password")}</div>
        <PasswordForm />
      </Block>

      {me.isSystemAdmin && (
        <Link href="/quan-tri" className="card row" style={{ gap: 12, textDecoration: "none", color: "var(--text)", flexWrap: "nowrap" }}>
          <span className="icon-tile tile-blue"><IconGear size={20} /></span>
          <span style={{ flex: 1 }}>
            <strong>{t("Quản trị hệ thống", "System administration")}</strong>
            <div className="muted" style={{ fontSize: 13 }}>{t("Bot Telegram, file cài app đồng hồ, tài khoản, đặt lại mật khẩu", "Telegram bot, watch app install file, accounts, password resets")}</div>
          </span>
          <IconChevron size={18} />
        </Link>
      )}
    </main>
  );
}
