import Link from "next/link";
import {
  IconBell, IconChevron, IconDrop, IconHeart, IconPill, IconSteps, IconTelegram, IconUsers, IconWatch,
} from "@/components/icons";
import { Avatar } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { fmtAgo } from "@/lib/format";
import { RULE_GROUPS } from "@/lib/metrics";
import { deleteDevice, deleteMed } from "./actions";
import { AddMedForm, AddRuleForm, ConditionsForm, FamilyForm, RuleForm, WatchKeyForm } from "./forms";

export const dynamic = "force-dynamic";

const GARMIN_STATUS: Record<string, { label: string; tone: string }> = {
  ok: { label: "Đang kết nối", tone: "tone-ok" },
  needs_relogin: { label: "Cần đăng nhập lại", tone: "tone-warn" },
  error: { label: "Lỗi tạm thời", tone: "tone-danger" },
};

function CardTitle({ icon, tile, title, sub }: { icon: React.ReactNode; tile: string; title: string; sub?: string }) {
  return (
    <div className="card-title">
      <span className={`icon-tile ${tile}`}>{icon}</span>
      <div><h2>{title}</h2>{sub && <div className="muted">{sub}</div>}</div>
    </div>
  );
}

// Biểu tượng cho từng khối ngưỡng (khớp RULE_GROUPS trong lib/metrics).
const GROUP_ICON: Record<string, React.ReactNode> = {
  tim: <IconHeart size={20} />, ha: <IconDrop size={20} />, vandong: <IconSteps size={20} />, thietbi: <IconWatch size={20} />,
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ nguoi?: string }> }) {
  const session = await requireSession();
  const { nguoi } = await searchParams;
  const data = await getSettings(session.familyId);
  const e = data.elders.find((x) => x.id === nguoi) ?? data.elders[0];
  const canEdit = session.isAdmin;

  return (
    <main className="container">
      <div>
        <h1 style={{ fontSize: 26 }}>Cài đặt</h1>
        <div className="muted" style={{ fontSize: 14 }}>Ngưỡng cảnh báo, lịch thuốc, thiết bị và báo cáo Telegram</div>
      </div>
      {!canEdit && <div className="banner info">Bạn đang xem. Chỉ người quản trị gia đình mới sửa được cài đặt.</div>}

      {data.elders.length > 0 && (
        <nav className="pills" aria-label="Chọn người thân">
          {data.elders.map((x) => (
            <Link key={x.id} href={`/cai-dat?nguoi=${x.id}`} className="pill" aria-current={x.id === e.id ? "page" : undefined}>{x.name}</Link>
          ))}
        </nav>
      )}

      <div className="split">
        {e ? (
          <div className="main-col">
            <section className="card">
              <div className="row" style={{ flexWrap: "nowrap", marginBottom: 14 }}>
                <Avatar name={e.name} />
                <div>
                  <h2 style={{ margin: 0, fontSize: 20 }}>{e.name}</h2>
                  <div className="muted">Bệnh nền giúp gợi ý ngưỡng phù hợp và hiện trên báo cáo</div>
                </div>
              </div>
              <ConditionsForm key={e.id} elderId={e.id} conditions={e.conditions} canEdit={canEdit} />
            </section>

            <section className="card">
              <CardTitle icon={<IconBell size={20} />} tile="tile-coral" title="Ngưỡng cảnh báo"
                sub="Gạt công tắc để bật/tắt. Mức Cao/Khẩn cấp sẽ gọi thêm người nếu không ai nhận xử lý." />
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
                {RULE_GROUPS.map((g, i) => {
                  const rules = e.rules.filter((r) => g.metrics.includes(r.metric));
                  if (!rules.length) return null;
                  const on = rules.filter((r) => r.enabled).length;
                  return (
                    <details key={g.key} className="group-block" open={i === 0}>
                      <summary>
                        <span className={`icon-tile ${g.tile}`}>{GROUP_ICON[g.key] ?? <IconBell size={20} />}</span>
                        <span className="grow">
                          <span className="title" style={{ display: "block" }}>{g.title}</span>
                          <span className="muted" style={{ fontSize: 13 }}>{rules.length} ngưỡng · {on} đang bật</span>
                        </span>
                        <IconChevron size={18} className="chev" />
                      </summary>
                      <div className="group-body">
                        {rules.map((r) => <RuleForm key={r.id} rule={r} tile={g.tile} canEdit={canEdit} />)}
                      </div>
                    </details>
                  );
                })}
              </div>
              {canEdit && <AddRuleForm elderId={e.id} />}
            </section>

            <section className="card" id="thuoc">
              <CardTitle icon={<IconPill size={20} />} tile="tile-violet" title="Lịch uống thuốc"
                sub="Bot nhắc ba mẹ đúng giờ; quá 60 phút chưa bấm “Đã uống” thì báo cả nhà" />
              {e.meds.length === 0 && <div className="muted">Chưa có lịch thuốc.</div>}
              <ul className="list">
                {e.meds.map((m) => (
                  <li key={m.id} className="list-row">
                    <span className="icon-tile tile-violet"><IconPill size={20} /></span>
                    <span className="grow">
                      <span className="title" style={{ display: "block" }}>{m.name}</span>
                      <span className="row" style={{ gap: 6, marginTop: 4 }}>
                        {m.times.map((t) => <span key={t} className="chip tone-ok">{t}</span>)}
                        {m.note && <span className="muted">{m.note}</span>}
                      </span>
                    </span>
                    {canEdit && (
                      <form action={deleteMed}>
                        <input type="hidden" name="med_id" value={m.id} />
                        <button className="btn ghost small" type="submit" style={{ color: "var(--coral-ink)" }}>Xoá</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
              {canEdit && <AddMedForm elderId={e.id} />}
            </section>

            <section className="card">
              <CardTitle icon={<IconWatch size={20} />} tile="tile-blue" title="Thiết bị" sub="Nguồn dữ liệu sức khoẻ của người này" />
              <ul className="list">
                <li className="list-row">
                  <span className="icon-tile tile-teal"><IconHeart size={20} /></span>
                  <span className="grow">
                    <span className="title" style={{ display: "block" }}>Garmin Connect</span>
                    <span className="muted">{e.garmin ? `Đồng bộ ${fmtAgo(e.garmin.lastSyncAt)}` : "Chưa kết nối tài khoản Garmin"}</span>
                  </span>
                  {e.garmin && <span className={`chip ${GARMIN_STATUS[e.garmin.status]?.tone ?? "tone-neutral"}`}>
                    {GARMIN_STATUS[e.garmin.status]?.label ?? e.garmin.status}</span>}
                </li>
                {e.devices.map((d) => (
                  <li key={d.id} className="list-row">
                    <span className="icon-tile tile-blue"><IconWatch size={20} /></span>
                    <span className="grow">
                      <span className="title" style={{ display: "block" }}>{d.label ?? "Đồng hồ Garmin"}</span>
                      <span className="muted">Gửi trực tiếp · {fmtAgo(d.lastSeenAt)}{d.battery != null ? ` · pin ${d.battery}%` : ""}</span>
                    </span>
                    {canEdit && (
                      <form action={deleteDevice}>
                        <input type="hidden" name="device_id" value={d.id} />
                        <button className="btn ghost small" type="submit" style={{ color: "var(--coral-ink)" }}>Ngắt kết nối</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
              <div className="row" style={{ marginTop: 12 }}>
                <Link className="btn primary small" href={`/ket-noi-dong-ho?nguoi=${e.id}`}>
                  Kết nối đồng hồ bằng mã 6 số <span className="arrow"><IconChevron size={16} /></span>
                </Link>
              </div>
              {canEdit && (
                <details className="more" style={{ marginTop: 10 }}>
                  <summary className="muted">Cách thủ công: tạo mã dài để dán vào Garmin Connect</summary>
                  <WatchKeyForm elderId={e.id} />
                </details>
              )}
            </section>
          </div>
        ) : (
          <div className="main-col"><div className="card">Chưa có người thân nào.</div></div>
        )}

        <aside className="side-col">
          <section className="card">
            <CardTitle icon={<IconTelegram size={20} />} tile="tile-blue" title="Telegram"
              sub={data.family.hasTelegramGroup ? "Đã nối nhóm gia đình" : "Chưa nối nhóm Telegram"} />
            <FamilyForm f={data.family} canEdit={canEdit} />
          </section>
          <section className="card">
            <CardTitle icon={<IconUsers size={20} />} tile="tile-amber" title="Gọi điện tự động" sub="Đã để sẵn · chưa bật" />
            <p className="muted" style={{ margin: 0 }}>
              Sau 20 phút không ai bấm “Tôi xử lý” trên Telegram, hệ thống gọi điện cho người có số điện thoại.
              Cần đăng ký nhà cung cấp gọi (Stringee hoặc Twilio) để bật.
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
