import Link from "next/link";
import { notFound } from "next/navigation";
import AutoRefresh from "@/components/AutoRefresh";
import Block from "@/components/Block";
import OpenOnHash from "@/components/OpenOnHash";
import HeartRing from "@/components/HeartRing";
import HrChart from "@/components/HrChart";
import SleepBar from "@/components/SleepBar";
import StepsChart from "@/components/StepsChart";
import {
  IconAlert, IconBack, IconBell, IconBolt, IconChevron, IconDrop, IconFile, IconHeart, IconMoon, IconPill, IconPulse,
  IconSteps, IconTelegram, IconUser, IconWatch,
} from "@/components/icons";
import { Avatar, Kpi, SeverityChip, StatusChip } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { getBot } from "@/lib/bot";
import { getElderDetail, getFamilyAdmin, getSettings } from "@/lib/data";
import { age, fmtAgo, fmtDateTime, fmtDuration, fmtNum, fmtTime } from "@/lib/format";
import { CONDITIONS, RULE_GROUPS } from "@/lib/metrics";
import { deleteDevice, deleteMed } from "../../cai-dat/actions";
import { AddMedForm, AddRuleForm, RuleForm, WatchKeyForm } from "../../cai-dat/forms";
import { EditElderForm, LinkCodeForm } from "../../gia-dinh/forms";

const GARMIN_STATUS: Record<string, { label: string; tone: string }> = {
  ok: { label: "Đang kết nối", tone: "tone-ok" },
  needs_relogin: { label: "Cần đăng nhập lại", tone: "tone-warn" },
  error: { label: "Lỗi tạm thời", tone: "tone-danger" },
};

// Biểu tượng cho từng khối ngưỡng (khớp RULE_GROUPS trong lib/metrics).
const GROUP_ICON: Record<string, React.ReactNode> = {
  tim: <IconHeart size={20} />, ha: <IconDrop size={20} />, vandong: <IconSteps size={20} />, thietbi: <IconWatch size={20} />,
};

export const dynamic = "force-dynamic";

export default async function ElderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const [d, settings, fam, bot] = await Promise.all([
    getElderDetail(session.familyId, id), getSettings(session.familyId),
    getFamilyAdmin(session.familyId, session.caregiverId), getBot(),
  ]);
  if (!d) notFound();
  const e = d.elder;
  const es = settings.elders.find((x) => x.id === e.id);
  const info = fam.elders.find((x) => x.id === e.id);
  const canEdit = session.isAdmin;
  const rules = es?.rules ?? [];
  const openAlerts = d.alerts.filter((a) => !a.resolvedAt);
  const hrRule = rules.find((r) => r.enabled && r.metric === "hr_now" && r.comparator === "gt")
    ?? rules.find((r) => r.enabled && r.metric === "resting_hr" && r.comparator === "gt");
  const restRule = rules.find((r) => r.enabled && r.metric === "resting_hr" && r.comparator === "gt");
  const vals = e.hr24h.map((p) => p.bpm);
  const bp = d.readings.find((r) => r.kind === "blood_pressure");
  const glucose = d.readings.find((r) => r.kind === "glucose");
  const hr = e.hrNow ?? e.today.restingHr;
  const hrHigh = hr != null && restRule != null && e.hrNow == null && hr > restRule.threshold;
  const hrState = hr == null ? null : hrHigh || e.status === "attention" ? "Cần chú ý" : "Bình thường";

  return (
    <main className="container">
      <AutoRefresh seconds={60} />
      <OpenOnHash />

      <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <Link href="/" className="icon-tile" aria-label="Về tổng quan"
          style={{ background: "var(--surface-solid)", boxShadow: "var(--shadow-sm)", color: "var(--text)" }}>
          <IconBack size={20} />
        </Link>
        <h1 style={{ fontSize: 18, textAlign: "center" }}>{e.name}</h1>
        <a href="#nguong" className="btn small">Ngưỡng</a>
      </div>

      <nav className="pills" aria-label="Chọn người thân">
        {settings.elders.map((x) => (
          <Link key={x.id} href={`/nguoi-than/${x.id}`} className="pill" aria-current={x.id === e.id ? "page" : undefined}>{x.name}</Link>
        ))}
      </nav>

      <section className="card row" style={{ gap: 16, flexWrap: "nowrap" }}>
        <Avatar name={e.name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 10 }}>
            <h2 style={{ fontSize: 22, margin: 0 }}>{e.name}</h2>
            <StatusChip status={e.status} />
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            {[age(e.birthYear), e.conditions.map((c) => CONDITIONS[c] ?? c).join(", "),
              e.watchLabel ? `${e.watchLabel}${e.watchBattery != null ? ` · pin ${e.watchBattery}%` : ""}` : null,
              `${e.liveSource ? "đồng hồ gửi trực tiếp" : "Garmin Connect"} ${fmtAgo(e.lastDataAt)}`]
              .filter(Boolean).join(" · ")}
          </div>
        </div>
      </section>

      <nav className="pills" aria-label="Mục">
        <a className="pill active" href="#tong-quan">Sức khoẻ</a>
        <a className="pill" href="#canh-bao">Cảnh báo{openAlerts.length ? ` (${openAlerts.length})` : ""}</a>
        <a className="pill" href="#nguong">Ngưỡng</a>
        <a className="pill" href="#thuoc">Thuốc</a>
        <a className="pill" href="#dong-ho">Đồng hồ</a>
        <a className="pill" href="#thong-tin">Thông tin</a>
      </nav>

      <div className="split">
        <div className="main-col">
          <section id="tong-quan" className="card" style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center", justifyContent: "center" }}>
            <HeartRing bpm={hr} />
            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
              <div className="muted" style={{ fontSize: 14 }}>{e.hrNow != null ? "Nhịp tim lúc này" : "Nhịp tim nghỉ"}</div>
              <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.1 }}>
                {hr ?? "—"}{hr != null && <span style={{ fontSize: 16, fontWeight: 500, color: "var(--muted)" }}> bpm</span>}
              </div>
              {hrState && (
                <div className={`chip ${hrState === "Bình thường" ? "tone-ok" : "tone-danger"}`} style={{ marginTop: 6 }}>{hrState}</div>
              )}
              <div className="kpis tight" style={{ marginTop: 16 }}>
                <Kpi icon={<IconSteps size={16} />} tile="tile-teal" label="Bước" value={fmtNum(e.today.steps)} />
                <Kpi icon={<IconBolt size={16} />} tile="tile-amber" label="Năng lượng" value={e.today.bodyBattery ?? "—"} />
                <Kpi icon={<IconMoon size={16} />} tile="tile-violet" label="Ngủ" value={fmtDuration(e.today.sleepSeconds)} />
              </div>
            </div>
          </section>

          <section id="tim" className="card">
            <div className="card-head">
              <h2>Nhịp tim 24 giờ</h2>
              {vals.length > 0 && (
                <span className="muted">Thấp nhất {Math.min(...vals)} · Cao nhất {Math.max(...vals)}
                  {hrRule ? ` · ngưỡng ${hrRule.threshold}` : ""}</span>
              )}
            </div>
            <HrChart data={e.hr24h} threshold={hrRule?.threshold} label={`Nhịp tim 24 giờ của ${e.name}`} />
            <div className="kpis" style={{ marginTop: 16 }}>
              <Kpi icon={<IconHeart size={16} />} tile="tile-coral" label="Nhịp tim nghỉ" value={e.today.restingHr ?? "—"} unit="bpm" />
              <Kpi icon={<IconDrop size={16} />} tile="tile-blue" label="SpO2 thấp nhất" value={e.today.spo2Min ?? "—"} unit="%" />
              <Kpi icon={<IconPulse size={16} />} tile="tile-coral" label="Huyết áp" value={bp ? `${bp.systolic}/${bp.diastolic}` : "—"}
                note={bp ? fmtDateTime(bp.measuredAt) : "Ba mẹ nhắn 130/85 cho bot"} />
              <Kpi icon={<IconDrop size={16} />} tile="tile-violet" label="Đường huyết" value={glucose?.value ?? "—"}
                unit={glucose ? "mmol/L" : undefined} note={glucose ? fmtDateTime(glucose.measuredAt) : undefined} />
            </div>
          </section>

          <div className="split">
            <section id="van-dong" className="card" style={{ flex: "1 1 300px", minWidth: 0 }}>
              <h2>Hoạt động trong tuần</h2>
              <StepsChart data={d.steps7} />
            </section>
            <section id="giac-ngu" className="card" style={{ flex: "1 1 300px", minWidth: 0 }}>
              <h2>Giấc ngủ đêm qua</h2>
              {d.sleep ? <SleepBar sleep={d.sleep} /> : <div className="muted">Chưa có dữ liệu giấc ngủ.</div>}
              {e.today.sleepScore != null && <div className="muted" style={{ marginTop: 10 }}>Điểm ngủ {e.today.sleepScore}/100</div>}
            </section>
          </div>
        </div>

        <aside className="side-col">
          <section className="card">
            <h2>Hồ sơ đo (7 ngày)</h2>
            {d.readings.length === 0 ? <div className="muted">Chưa có. Ba mẹ nhắn <code>130/85</code> hoặc <code>đường 7.2</code> cho bot.</div> : (
              <ul className="list">
                {d.readings.map((r, i) => (
                  <li key={i} className="list-row">
                    <span className={`icon-tile ${r.kind === "blood_pressure" ? "tile-coral" : r.kind === "glucose" ? "tile-violet" : "tile-blue"}`}>
                      {r.kind === "blood_pressure" ? <IconPulse size={20} /> : <IconDrop size={20} />}
                    </span>
                    <span className="grow">
                      <span className="title" style={{ display: "block" }}>
                        {r.kind === "blood_pressure" ? `${r.systolic}/${r.diastolic} mmHg` : r.kind === "glucose" ? `${r.value} mmol/L` : `${r.value} kg`}
                      </span>
                      <span className="muted">{fmtDateTime(r.measuredAt)} · {r.source === "garmin" ? "máy Garmin" : "Telegram"}</span>
                    </span>
                    <span className="chev"><IconChevron size={18} /></span>
                  </li>
                ))}
              </ul>
            )}
          </section>

        </aside>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Block id="canh-bao" icon={<IconBell size={20} />} tile="tile-coral" title="Cảnh báo"
          sub={openAlerts.length ? `${openAlerts.length} đang mở · 30 ngày qua` : "Không có cảnh báo đang mở · 30 ngày qua"}
          open={openAlerts.length > 0}>
            {d.alerts.length === 0 ? <div className="muted">Không có cảnh báo.</div> : (
            <ul className="list">
              {d.alerts.map((a) => (
                <li key={a.id} className="list-row">
                  <span className={`icon-tile ${a.resolvedAt ? "tile-teal" : "tile-coral"}`}><IconFile size={20} /></span>
                  <span className="grow">
                    <span className="title" style={{ display: "block" }}>{a.message}</span>
                    <span className="muted">
                      {fmtDateTime(a.openedAt)}
                      {a.ackedBy ? ` · ${a.ackedBy} nhận lúc ${fmtTime(a.ackedAt!)}` : ""}
                      {a.resolvedAt ? " · đã bình thường" : " · đang mở"}
                    </span>
                  </span>
                  <SeverityChip severity={a.severity} />
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block id="nguong" icon={<IconAlert size={20} />} tile="tile-amber" title="Ngưỡng cảnh báo"
          sub={`${rules.filter((r) => r.enabled).length}/${rules.length} ngưỡng đang bật`}>
          {!canEdit && <div className="banner info">Bạn đang xem. Chỉ quản trị gia đình mới sửa được.</div>}
          {RULE_GROUPS.map((g, i) => {
            const rs = rules.filter((r) => g.metrics.includes(r.metric));
            if (!rs.length) return null;
            return (
              <details key={g.key} className="group-block" open={i === 0}>
                <summary>
                  <span className={`icon-tile ${g.tile}`}>{GROUP_ICON[g.key] ?? <IconBell size={20} />}</span>
                  <span className="grow">
                    <span className="title" style={{ display: "block" }}>{g.title}</span>
                    <span className="muted" style={{ fontSize: 13 }}>{rs.length} ngưỡng · {rs.filter((r) => r.enabled).length} đang bật</span>
                  </span>
                  <IconChevron size={18} className="chev" />
                </summary>
                <div className="group-body">
                  {rs.map((r) => <RuleForm key={r.id} rule={r} tile={g.tile} canEdit={canEdit} />)}
                </div>
              </details>
            );
          })}
          {canEdit && <AddRuleForm elderId={e.id} />}
        </Block>

        <Block id="thuoc" icon={<IconPill size={20} />} tile="tile-violet" title="Thuốc"
          sub="Bot nhắc đúng giờ; quá 60 phút chưa bấm “Đã uống” thì báo cả nhà">
          <div className="section-title" style={{ margin: 0 }}>Hôm nay</div>
            {d.meds.length === 0 ? <div className="muted">Chưa có lịch uống thuốc.</div> : (
            <ul className="list">
              {d.meds.map((m, i) => (
                <li key={i} className="list-row">
                  <span className={`icon-tile ${m.takenAt ? "tile-teal" : "tile-violet"}`}><IconPill size={20} /></span>
                  <span className="grow">
                    <span className="title" style={{ display: "block" }}>{m.name}</span>
                    <span className="muted">{fmtTime(m.dueAt)}{m.note ? ` · ${m.note}` : ""}</span>
                  </span>
                  <span className={`chip ${m.takenAt ? "tone-ok" : "tone-neutral"}`}>{m.takenAt ? "Đã uống" : "Chưa"}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="section-title" style={{ margin: "6px 0 0" }}>Lịch uống</div>
          {(es?.meds.length ?? 0) === 0 && <div className="muted">Chưa có lịch thuốc.</div>}
          <ul className="list">
            {es?.meds.map((m) => (
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
        </Block>

        <Block id="dong-ho" icon={<IconWatch size={20} />} tile="tile-blue" title="Đồng hồ & thiết bị"
          sub={e.watchLabel ? `${e.watchLabel}${e.watchBattery != null ? ` · pin ${e.watchBattery}%` : ""} · gửi ${fmtAgo(e.lastDataAt)}` : "Chưa gắn đồng hồ"}>
          <ul className="list">
            {es?.devices.map((dv) => (
              <li key={dv.id} className="list-row">
                <span className="icon-tile tile-blue"><IconWatch size={20} /></span>
                <span className="grow">
                  <span className="title" style={{ display: "block" }}>{dv.label ?? "Đồng hồ Garmin"}</span>
                  <span className="muted">Gửi trực tiếp · {fmtAgo(dv.lastSeenAt)}{dv.battery != null ? ` · pin ${dv.battery}%` : ""}</span>
                </span>
                {canEdit && (
                  <form action={deleteDevice}>
                    <input type="hidden" name="device_id" value={dv.id} />
                    <button className="btn ghost small" type="submit" style={{ color: "var(--coral-ink)" }}>Ngắt kết nối</button>
                  </form>
                )}
              </li>
            ))}
            <li className="list-row">
              <span className="icon-tile tile-teal"><IconHeart size={20} /></span>
              <span className="grow">
                <span className="title" style={{ display: "block" }}>Garmin Connect</span>
                <span className="muted">{es?.garmin ? `Đồng bộ ${fmtAgo(es.garmin.lastSyncAt)}` : "Chưa kết nối (không bắt buộc: thêm giấc ngủ, SpO2 ban đêm)"}</span>
              </span>
              {es?.garmin && <span className={`chip ${GARMIN_STATUS[es.garmin.status]?.tone ?? "tone-neutral"}`}>
                {GARMIN_STATUS[es.garmin.status]?.label ?? es.garmin.status}</span>}
            </li>
          </ul>
          <Link className="btn primary small" href={`/ket-noi-dong-ho?nguoi=${e.id}`} style={{ alignSelf: "flex-start" }}>
            Kết nối đồng hồ bằng mã 6 số <span className="arrow"><IconChevron size={16} /></span>
          </Link>
          {canEdit && (
            <details className="more">
              <summary className="muted">Cách thủ công: tạo mã dài để dán vào Garmin Connect</summary>
              <WatchKeyForm elderId={e.id} />
            </details>
          )}
        </Block>

        <Block id="thong-tin" icon={<IconUser size={20} />} tile="tile-teal" title="Thông tin & Telegram"
          sub={[age(e.birthYear), e.conditions.map((c) => CONDITIONS[c] ?? c).join(", ") || "chưa có bệnh nền",
            info?.hasTelegram ? "đã nối Telegram" : "chưa nối Telegram"].filter(Boolean).join(" · ")}>
          {info && canEdit && <EditElderForm elder={info} />}
          <div className="list-row" style={{ minHeight: 0 }}>
            <span className="icon-tile tile-blue"><IconTelegram size={20} /></span>
            <span className="grow">
              <span className="title" style={{ display: "block" }}>Telegram của {e.name}</span>
              <span className="muted">{info?.hasTelegram ? "Bot nhắc thuốc riêng, nhận chỉ số huyết áp/đường huyết qua tin nhắn"
                : "Chưa nối: nhắc thuốc sẽ gửi vào nhóm gia đình"}</span>
            </span>
            <span className={`chip ${info?.hasTelegram ? "tone-ok" : "tone-neutral"}`}>{info?.hasTelegram ? "Đã nối" : "Chưa nối"}</span>
          </div>
          {canEdit && <LinkCodeForm bot={bot.username} kind="elder" elderId={e.id}
            label={info?.hasTelegram ? `Nối lại Telegram của ${e.name}` : `Nối Telegram của ${e.name}`} />}
          {info?.command && <div className="muted" style={{ fontSize: 14 }}>Trong nhóm Telegram, nhắn <code>/{info.command}</code> để xem nhanh tình hình.</div>}
        </Block>
      </div>

      <p className="muted">Thông tin chỉ để tham khảo, không thay thế chẩn đoán của bác sĩ.</p>
    </main>
  );
}
