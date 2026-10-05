import Link from "next/link";
import { IconChevron, IconHeart, IconTelegram, IconUsers } from "@/components/icons";
import { Avatar } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { getBot } from "@/lib/bot";
import { getFamilyAdmin } from "@/lib/data";
import { age } from "@/lib/format";
import type { T } from "@/lib/i18n";
import { getLang, getT } from "@/lib/i18n-server";
import { conditions } from "@/lib/metrics";
import { revokeInvite, switchFamily, unlinkGroup, updateMember } from "./actions";
import { AddElderForm, AddMemberForm, EditElderForm, EditMemberForm, InviteForm, LinkCodeForm } from "./forms";

export const dynamic = "force-dynamic";

const roles = (t: T): Record<string, string> => ({
  admin: t("Quản trị", "Admin"), alerts: t("Nhận cảnh báo", "Gets alerts"), reports: t("Chỉ nhận báo cáo", "Reports only"),
});

function CardTitle({ icon, tile, title, sub }: { icon: React.ReactNode; tile: string; title: string; sub?: string }) {
  return (
    <div className="card-title">
      <span className={`icon-tile ${tile}`}>{icon}</span>
      <div><h2>{title}</h2>{sub && <div className="muted">{sub}</div>}</div>
    </div>
  );
}

export default async function FamilyPage({ searchParams }: { searchParams: Promise<{ moi?: string }> }) {
  const session = await requireSession();
  const { moi } = await searchParams;
  const f = await getFamilyAdmin(session.familyId, session.caregiverId);
  const admin = session.isAdmin;
  const bot = (await getBot()).username;
  const lang = await getLang();
  const t = await getT();
  const ROLE = roles(t);
  const COND = conditions(lang);
  const dateLocale = lang === "en" ? "en-GB" : "vi-VN";

  return (
    <main className="container">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 26 }}>{f.name}</h1>
          <div className="muted" style={{ fontSize: 14 }}>{f.elders.length} {t("người thân", "family members")} · {f.members.length} {t("người chăm sóc", "caregivers")}</div>
        </div>
        <Link className="btn small" href="/tai-khoan">← {t("Tài khoản", "Account")}</Link>
      </div>

      {moi && (
        <div className="banner info">
          {t("Đã tạo gia đình. Tiếp theo: thêm ba mẹ, nối nhóm Telegram, rồi mời anh chị em cùng theo dõi.",
            "Family created. Next: add your parents, connect the Telegram group, then invite your siblings to follow along.")}
        </div>
      )}

      {session.families.length > 1 && (
        <nav className="pills" aria-label={t("Chọn gia đình", "Choose family")}>
          {session.families.map((fam) => (
            <form key={fam.id} action={switchFamily}>
              <input type="hidden" name="family_id" value={fam.id} />
              <button className="pill" type="submit" aria-current={fam.id === session.familyId ? "page" : undefined}
                style={{ cursor: "pointer" }}>{fam.name}</button>
            </form>
          ))}
        </nav>
      )}

      <div className="split">
        <div className="main-col">
          <section className="card">
            <CardTitle icon={<IconHeart size={20} />} tile="tile-coral" title={t("Ba mẹ & người thân", "Parents & family members")} sub={t("Người được theo dõi sức khoẻ", "People whose health is monitored")} />
            {f.elders.length === 0 && <div className="muted" style={{ marginBottom: 10 }}>{t("Chưa có ai. Thêm ba mẹ để bắt đầu.", "No one yet. Add your parents to get started.")}</div>}
            <ul className="list" style={{ marginBottom: 12 }}>
              {f.elders.map((e) => (
                <li key={e.id} className="list-row" style={{ flexWrap: "wrap" }}>
                  <Avatar name={e.name} small />
                  <span className="grow">
                    <span className="title" style={{ display: "block" }}>{e.name}</span>
                    <span className="muted">
                      {[age(e.birthYear, lang), e.conditions.map((c) => COND[c] ?? c).join(", "),
                        e.command ? t(`nhắn /${e.command} trong nhóm để xem nhanh`, `send /${e.command} in the group for a quick look`) : null]
                        .filter(Boolean).join(" · ") || t("Chưa có thông tin bệnh nền", "No health conditions yet")}
                    </span>
                  </span>
                  <span className={`chip ${e.hasTelegram ? "tone-ok" : "tone-neutral"}`}>{e.hasTelegram ? t("Đã nối Telegram", "Telegram connected") : t("Chưa nối Telegram", "Telegram not connected")}</span>
                  <Link className="btn ghost small" href={`/nguoi-than/${e.id}`}>{t("Mở trang", "Open page")} <IconChevron size={14} /></Link>
                  {admin && !e.hasTelegram && (
                    <div style={{ width: "100%" }}><LinkCodeForm bot={bot} kind="elder" elderId={e.id} label={t(`Nối Telegram của ${e.name} (nhắc thuốc, nhập huyết áp)`, `Connect ${e.name}'s Telegram (medication reminders, blood pressure entry)`)} /></div>
                  )}
                  {admin && <EditElderForm elder={e} />}
                </li>
              ))}
            </ul>
            {admin && <AddElderForm />}
          </section>

          <section className="card">
            <CardTitle icon={<IconUsers size={20} />} tile="tile-violet" title={t("Người cùng chăm sóc", "Caregivers")}
              sub={t("Anh chị em, con cháu cùng nhận báo cáo và cảnh báo", "Siblings and relatives who share reports and alerts")} />
            <ul className="list">
              {f.members.map((m) => (
                <li key={m.id} className="list-row" style={{ flexWrap: "wrap" }}>
                  <Avatar name={m.name} small />
                  <span className="grow">
                    <span className="title" style={{ display: "block" }}>{m.name}{m.isMe ? t(" (bạn)", " (you)") : ""}</span>
                    <span className="muted">{[ROLE[m.role], m.email, m.phone ? t("có số gọi khẩn", "has emergency number") : null].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className={`chip ${m.hasTelegram ? "tone-ok" : "tone-neutral"}`}>{m.hasTelegram ? t("Đã nối Telegram", "Telegram connected") : t("Chưa nối Telegram", "Telegram not connected")}</span>
                  {m.isMe && !m.hasTelegram && (
                    <div style={{ width: "100%" }}><LinkCodeForm bot={bot} kind="caregiver" label={t("Nối Telegram của tôi (nhận cảnh báo riêng)", "Connect my Telegram (personal alerts)")} /></div>
                  )}
                  {(admin || m.isMe) && <EditMemberForm member={m} />}
                  {admin && !m.isMe && (
                    <form action={updateMember} className="row" style={{ gap: 6 }}>
                      <input type="hidden" name="caregiver_id" value={m.id} />
                      <select name="action" defaultValue={m.role} aria-label={t(`Quyền của ${m.name}`, `${m.name}'s role`)}>
                        <option value="admin">{t("Quản trị", "Admin")}</option>
                        <option value="alerts">{t("Nhận cảnh báo", "Gets alerts")}</option>
                        <option value="reports">{t("Chỉ nhận báo cáo", "Reports only")}</option>
                        <option value="remove">{t("Xoá khỏi gia đình", "Remove from family")}</option>
                      </select>
                      <button className="btn small" type="submit">{t("Lưu", "Save")}</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            {admin && <div style={{ marginTop: 12 }}><AddMemberForm /></div>}
            {admin && (
              <div style={{ marginTop: 16 }}>
                <div className="section-title" style={{ margin: "0 0 8px" }}>{t("Hoặc gửi link mời (họ tự đăng ký)", "Or send an invite link (they sign up themselves)")}</div>
                <InviteForm />
                {f.invites.length > 0 && (
                  <ul className="list" style={{ marginTop: 10 }}>
                    {f.invites.map((i) => (
                      <li key={i.id} className="list-row" style={{ minHeight: 0 }}>
                        <span className="grow">
                          <span className="title" style={{ display: "block" }}>{t("Link", "Link")} /moi/{i.code}</span>
                          <span className="muted">{ROLE[i.role]} · {t("hết hạn", "expires")} {new Date(i.expiresAt).toLocaleDateString(dateLocale)}</span>
                        </span>
                        <form action={revokeInvite}>
                          <input type="hidden" name="invite_id" value={i.id} />
                          <button className="btn ghost small" type="submit" style={{ color: "var(--coral-ink)" }}>{t("Thu hồi", "Revoke")}</button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        </div>

        <aside className="side-col">
          <section id="telegram" className="card" style={{ scrollMarginTop: 80 }}>
            <CardTitle icon={<IconTelegram size={20} />} tile="tile-blue" title={t("Nhóm Telegram gia đình", "Family Telegram groups")}
              sub={f.groups.length ? t(`Bot gửi cảnh báo và báo cáo vào ${f.groups.length} nhóm`, `The bot sends alerts and reports to ${f.groups.length} group(s)`)
                : t("Chưa nối nhóm nào", "No groups connected yet")} />
            {f.groups.length > 0 && (
              <ul className="list" style={{ marginBottom: 12 }}>
                {f.groups.map((g) => (
                  <li key={g.chatId} className="list-row" style={{ minHeight: 0 }}>
                    <span className="icon-tile tile-blue" style={{ width: 36, height: 36 }}><IconTelegram size={18} /></span>
                    <span className="grow">
                      <span className="title" style={{ display: "block" }}>{g.title ?? t("Nhóm Telegram", "Telegram group")}</span>
                      <span className="muted">{t("Nối ngày", "Connected on")} {new Date(g.linkedAt).toLocaleDateString(dateLocale)}</span>
                    </span>
                    {admin && (
                      <form action={unlinkGroup}>
                        <input type="hidden" name="chat_id" value={g.chatId} />
                        <button className="btn ghost small" type="submit" style={{ color: "var(--coral-ink)" }}>{t("Gỡ", "Remove")}</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {admin ? (
              <>
                <p className="muted" style={{ marginTop: 0 }}>
                  {f.groups.length ? t("Nối thêm nhóm khác (ví dụ nhóm cả họ): ", "Connect another group (e.g. the extended family): ")
                    : t("Tạo (hoặc dùng) một nhóm Telegram có anh chị em, ", "Create (or use) a Telegram group with your siblings, ")}
                  {t("thêm bot vào nhóm, rồi gõ mã bên dưới trong nhóm. Mỗi mã dùng cho một nhóm.",
                    "add the bot to the group, then type the code below in the group. Each code works for one group.")}
                </p>
                <LinkCodeForm bot={bot} kind="group" label={f.groups.length ? t("Lấy mã nối thêm nhóm", "Get a code for another group") : t("Lấy mã nối nhóm", "Get a group code")} />
              </>
            ) : <p className="muted" style={{ margin: 0 }}>{t("Người quản trị gia đình nối nhóm Telegram.", "The family admin connects the Telegram group.")}</p>}
          </section>
          <section className="card">
            <h2>{t("Bắt đầu nhanh", "Quick start")}</h2>
            <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6, fontSize: 14 }}>
              <li>{t("Thêm ba mẹ, chọn bệnh nền", "Add your parents, choose health conditions")}</li>
              <li>{t("Nối nhóm Telegram gia đình", "Connect the family Telegram group")}</li>
              <li>{t("Thêm anh chị em bằng email, mỗi người tự nối Telegram", "Add siblings by email; each connects their own Telegram")}</li>
              <li><Link href="/ket-noi-dong-ho">{t("Kết nối đồng hồ Garmin", "Connect a Garmin watch")}</Link> {t("bằng mã 6 số", "with a 6-digit code")}</li>
              <li>{t("Nối Telegram của ba mẹ để nhắc thuốc", "Connect your parents' Telegram for medication reminders")}</li>
            </ol>
          </section>
        </aside>
      </div>
    </main>
  );
}
