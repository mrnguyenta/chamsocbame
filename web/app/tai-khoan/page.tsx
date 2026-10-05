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
        <form action="/api/auth/logout" method="post"><button className="btn small" type="submit">Đăng xuất</button></form>
      </section>

      {!session && (
        <section className="card">
          <p style={{ marginTop: 0 }}>Bạn chưa ở trong gia đình nào.</p>
          <Link className="btn primary" href="/bat-dau">Tạo gia đình hoặc vào bằng link mời</Link>
        </section>
      )}

      {session && fam && settings && (
        <>
          <Block id="gia-dinh" icon={<IconUsers size={20} />} tile="tile-violet" title={`Gia đình · ${fam.name}`}
            sub={`${fam.elders.length} người thân · ${fam.members.length} người chăm sóc · ${fam.groups.length} nhóm Telegram`} open>
            {session.families.length > 1 && (
              <nav className="pills" aria-label="Chọn gia đình">
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
              <li><Row href="/nguoi-than" icon={<IconUser size={20} />} tile="tile-coral" title="Ba mẹ & người thân"
                sub={fam.elders.map((e) => e.name).join(", ") || "Chưa có ai"} /></li>
              <li><Row href="/gia-dinh" icon={<IconUsers size={20} />} tile="tile-violet" title="Anh chị em & lời mời"
                sub={`${fam.members.length} người · thêm bằng email hoặc gửi link mời`} /></li>
              <li><Row href="/gia-dinh#telegram" icon={<IconTelegram size={20} />} tile="tile-blue" title="Nhóm Telegram gia đình"
                sub={fam.groups.map((g) => g.title ?? "Nhóm Telegram").join(", ") || "Chưa nối nhóm nào"} /></li>
              <li><Row href="/bat-dau" icon={<IconUsers size={20} />} tile="tile-teal" title="Gia đình khác"
                sub="Tạo thêm (bên nội / bên ngoại) hoặc vào bằng link mời" /></li>
            </ul>
          </Block>

          <Block id="telegram" icon={<IconTelegram size={20} />} tile="tile-blue" title="Telegram của tôi"
            sub={mine?.hasTelegram ? "Đã nối · nhận cảnh báo riêng và bấm “Tôi xử lý”" : "Chưa nối · nối để nhận cảnh báo riêng"}
            open={!mine?.hasTelegram}>
            <p className="muted" style={{ margin: 0 }}>
              Cảnh báo luôn gửi vào nhóm gia đình. Nối Telegram riêng để bot nhắn thẳng cho bạn khi chưa ai nhận xử lý.
            </p>
            <LinkCodeForm bot={bot?.username} kind="caregiver" label={mine?.hasTelegram ? "Nối lại Telegram của tôi" : "Nối Telegram của tôi"} />
          </Block>

          <Block id="bao-cao" icon={<IconBell size={20} />} tile="tile-amber" title="Báo cáo & giờ yên lặng"
            sub={`Báo cáo ${settings.family.morningReportAt}${settings.family.eveningReportAt ? ` và ${settings.family.eveningReportAt}` : ""} · yên lặng ${settings.family.quietStart}–${settings.family.quietEnd}`}>
            <FamilyForm f={settings.family} canEdit={session.isAdmin} />
          </Block>

          <Block id="dong-ho" icon={<IconWatch size={20} />} tile="tile-teal" title="Đồng hồ"
            sub="Kết nối đồng hồ Garmin cho ba mẹ bằng mã 6 số">
            <Link className="btn primary small" href="/ket-noi-dong-ho" style={{ alignSelf: "flex-start" }}>
              Kết nối đồng hồ <span className="arrow"><IconChevron size={16} /></span>
            </Link>
          </Block>
        </>
      )}

      <Block id="ho-so" icon={<IconUser size={20} />} tile="tile-teal" title="Hồ sơ & mật khẩu" sub="Đổi tên hiển thị, đổi mật khẩu">
        <NameForm name={me.name} />
        <div className="section-title" style={{ margin: "6px 0 0" }}>Đổi mật khẩu</div>
        <PasswordForm />
      </Block>

      {me.isSystemAdmin && (
        <Link href="/quan-tri" className="card row" style={{ gap: 12, textDecoration: "none", color: "var(--text)", flexWrap: "nowrap" }}>
          <span className="icon-tile tile-blue"><IconGear size={20} /></span>
          <span style={{ flex: 1 }}>
            <strong>Quản trị hệ thống</strong>
            <div className="muted" style={{ fontSize: 13 }}>Bot Telegram, file cài app đồng hồ, tài khoản, đặt lại mật khẩu</div>
          </span>
          <IconChevron size={18} />
        </Link>
      )}
    </main>
  );
}
