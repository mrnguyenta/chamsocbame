import Link from "next/link";
import { IconChevron, IconGear, IconHeart, IconTelegram, IconUsers } from "@/components/icons";
import { Avatar } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { getBot } from "@/lib/bot";
import { getFamilyAdmin } from "@/lib/data";
import { age } from "@/lib/format";
import { CONDITIONS } from "@/lib/metrics";
import { revokeInvite, switchFamily, unlinkGroup, updateMember } from "./actions";
import { AddElderForm, AddMemberForm, EditElderForm, EditMemberForm, InviteForm, LinkCodeForm } from "./forms";

export const dynamic = "force-dynamic";

const ROLE: Record<string, string> = { admin: "Quản trị", alerts: "Nhận cảnh báo", reports: "Chỉ nhận báo cáo" };

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

  return (
    <main className="container">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 26 }}>{f.name}</h1>
          <div className="muted" style={{ fontSize: 14 }}>{f.elders.length} người thân · {f.members.length} người chăm sóc</div>
        </div>
        <Link className="btn small" href="/cai-dat"><IconGear size={16} /> Ngưỡng & thuốc</Link>
      </div>

      {moi && (
        <div className="banner info">
          Đã tạo gia đình. Tiếp theo: thêm ba mẹ, nối nhóm Telegram, rồi mời anh chị em cùng theo dõi.
        </div>
      )}

      {session.families.length > 1 && (
        <nav className="pills" aria-label="Chọn gia đình">
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
            <CardTitle icon={<IconHeart size={20} />} tile="tile-coral" title="Ba mẹ & người thân" sub="Người được theo dõi sức khoẻ" />
            {f.elders.length === 0 && <div className="muted" style={{ marginBottom: 10 }}>Chưa có ai. Thêm ba mẹ để bắt đầu.</div>}
            <ul className="list" style={{ marginBottom: 12 }}>
              {f.elders.map((e) => (
                <li key={e.id} className="list-row" style={{ flexWrap: "wrap" }}>
                  <Avatar name={e.name} small />
                  <span className="grow">
                    <span className="title" style={{ display: "block" }}>{e.name}</span>
                    <span className="muted">
                      {[age(e.birthYear), e.conditions.map((c) => CONDITIONS[c] ?? c).join(", "), e.command ? `nhắn /${e.command} trong nhóm để xem nhanh` : null]
                        .filter(Boolean).join(" · ") || "Chưa có thông tin bệnh nền"}
                    </span>
                  </span>
                  <span className={`chip ${e.hasTelegram ? "tone-ok" : "tone-neutral"}`}>{e.hasTelegram ? "Đã nối Telegram" : "Chưa nối Telegram"}</span>
                  <Link className="btn ghost small" href={`/cai-dat?nguoi=${e.id}`}>Cài đặt <IconChevron size={14} /></Link>
                  {admin && !e.hasTelegram && (
                    <div style={{ width: "100%" }}><LinkCodeForm bot={bot} kind="elder" elderId={e.id} label={`Nối Telegram của ${e.name} (nhắc thuốc, nhập huyết áp)`} /></div>
                  )}
                  {admin && <EditElderForm elder={e} />}
                </li>
              ))}
            </ul>
            {admin && <AddElderForm />}
          </section>

          <section className="card">
            <CardTitle icon={<IconUsers size={20} />} tile="tile-violet" title="Người cùng chăm sóc"
              sub="Anh chị em, con cháu cùng nhận báo cáo và cảnh báo" />
            <ul className="list">
              {f.members.map((m) => (
                <li key={m.id} className="list-row" style={{ flexWrap: "wrap" }}>
                  <Avatar name={m.name} small />
                  <span className="grow">
                    <span className="title" style={{ display: "block" }}>{m.name}{m.isMe ? " (bạn)" : ""}</span>
                    <span className="muted">{[ROLE[m.role], m.email, m.phone ? "có số gọi khẩn" : null].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className={`chip ${m.hasTelegram ? "tone-ok" : "tone-neutral"}`}>{m.hasTelegram ? "Đã nối Telegram" : "Chưa nối Telegram"}</span>
                  {m.isMe && !m.hasTelegram && (
                    <div style={{ width: "100%" }}><LinkCodeForm bot={bot} kind="caregiver" label="Nối Telegram của tôi (nhận cảnh báo riêng)" /></div>
                  )}
                  {(admin || m.isMe) && <EditMemberForm member={m} />}
                  {admin && !m.isMe && (
                    <form action={updateMember} className="row" style={{ gap: 6 }}>
                      <input type="hidden" name="caregiver_id" value={m.id} />
                      <select name="action" defaultValue={m.role} aria-label={`Quyền của ${m.name}`}>
                        <option value="admin">Quản trị</option>
                        <option value="alerts">Nhận cảnh báo</option>
                        <option value="reports">Chỉ nhận báo cáo</option>
                        <option value="remove">Xoá khỏi gia đình</option>
                      </select>
                      <button className="btn small" type="submit">Lưu</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            {admin && <div style={{ marginTop: 12 }}><AddMemberForm /></div>}
            {admin && (
              <div style={{ marginTop: 16 }}>
                <div className="section-title" style={{ margin: "0 0 8px" }}>Hoặc gửi link mời (họ tự đăng ký)</div>
                <InviteForm />
                {f.invites.length > 0 && (
                  <ul className="list" style={{ marginTop: 10 }}>
                    {f.invites.map((i) => (
                      <li key={i.id} className="list-row" style={{ minHeight: 0 }}>
                        <span className="grow">
                          <span className="title" style={{ display: "block" }}>Link /moi/{i.code}</span>
                          <span className="muted">{ROLE[i.role]} · hết hạn {new Date(i.expiresAt).toLocaleDateString("vi-VN")}</span>
                        </span>
                        <form action={revokeInvite}>
                          <input type="hidden" name="invite_id" value={i.id} />
                          <button className="btn ghost small" type="submit" style={{ color: "var(--coral-ink)" }}>Thu hồi</button>
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
          <section className="card">
            <CardTitle icon={<IconTelegram size={20} />} tile="tile-blue" title="Nhóm Telegram gia đình"
              sub={f.groups.length ? `Bot gửi cảnh báo và báo cáo vào ${f.groups.length} nhóm` : "Chưa nối nhóm nào"} />
            {f.groups.length > 0 && (
              <ul className="list" style={{ marginBottom: 12 }}>
                {f.groups.map((g) => (
                  <li key={g.chatId} className="list-row" style={{ minHeight: 0 }}>
                    <span className="icon-tile tile-blue" style={{ width: 36, height: 36 }}><IconTelegram size={18} /></span>
                    <span className="grow">
                      <span className="title" style={{ display: "block" }}>{g.title ?? "Nhóm Telegram"}</span>
                      <span className="muted">Nối ngày {new Date(g.linkedAt).toLocaleDateString("vi-VN")}</span>
                    </span>
                    {admin && (
                      <form action={unlinkGroup}>
                        <input type="hidden" name="chat_id" value={g.chatId} />
                        <button className="btn ghost small" type="submit" style={{ color: "var(--coral-ink)" }}>Gỡ</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {admin ? (
              <>
                <p className="muted" style={{ marginTop: 0 }}>
                  {f.groups.length ? "Nối thêm nhóm khác (ví dụ nhóm cả họ): " : "Tạo (hoặc dùng) một nhóm Telegram có anh chị em, "}
                  thêm bot vào nhóm, rồi gõ mã bên dưới trong nhóm. Mỗi mã dùng cho một nhóm.
                </p>
                <LinkCodeForm bot={bot} kind="group" label={f.groups.length ? "Lấy mã nối thêm nhóm" : "Lấy mã nối nhóm"} />
              </>
            ) : <p className="muted" style={{ margin: 0 }}>Người quản trị gia đình nối nhóm Telegram.</p>}
          </section>
          <section className="card">
            <h2>Bắt đầu nhanh</h2>
            <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6, fontSize: 14 }}>
              <li>Thêm ba mẹ, chọn bệnh nền</li>
              <li>Nối nhóm Telegram gia đình</li>
              <li>Thêm anh chị em bằng email, mỗi người tự nối Telegram</li>
              <li><Link href="/ket-noi-dong-ho">Kết nối đồng hồ Garmin</Link> bằng mã 6 số</li>
              <li>Nối Telegram của ba mẹ để nhắc thuốc</li>
            </ol>
          </section>
        </aside>
      </div>
    </main>
  );
}
