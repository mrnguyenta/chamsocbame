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
  IconSteps, IconTelegram, IconUser, IconWatch, IconFlame, IconRoute, IconLungs,
} from "@/components/icons";
import { Avatar, Kpi, SeverityChip, StatusChip } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { getBot } from "@/lib/bot";
import { getElderDetail, getFamilyAdmin, getSettings } from "@/lib/data";
import { age, fmtAgo, fmtDateTime, fmtDuration, fmtNum, fmtTime } from "@/lib/format";
import { makeT, type T } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { alertText, conditions, ruleGroups } from "@/lib/metrics";
import GarminLinkForm from "@/components/GarminLinkForm";
import { deleteDevice, deleteGarmin, deleteMed } from "../../cai-dat/actions";
import { AddMedForm, AddRuleForm, RuleForm, WatchKeyForm } from "../../cai-dat/forms";
import { DeleteElder, EditElderForm, LinkCodeForm } from "../../gia-dinh/forms";

const garminStatuses = (t: T): Record<string, { label: string; tone: string }> => ({
  ok: { label: t("Đang kết nối", "Connected"), tone: "tone-ok" },
  needs_relogin: { label: t("Cần đăng nhập lại", "Needs to sign in again"), tone: "tone-warn" },
  error: { label: t("Lỗi tạm thời", "Temporary error"), tone: "tone-danger" },
});

// Biểu tượng cho từng khối ngưỡng (khớp RULE_GROUPS trong lib/metrics).
const GROUP_ICON: Record<string, React.ReactNode> = {
  tim: <IconHeart size={20} />, ha: <IconDrop size={20} />, vandong: <IconSteps size={20} />, thietbi: <IconWatch size={20} />,
  cangthang: <IconBolt size={20} />,
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
  const lang = await getLang();
  const t = makeT(lang);
  const CONDITIONS = conditions(lang);
  const RULE_GROUPS = ruleGroups(lang);
  const GARMIN_STATUS = garminStatuses(t);
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
  const hrOk = !(hrHigh || e.status === "attention");
  const hrState = hr == null ? null : hrOk ? t("Bình thường", "Normal") : t("Cần chú ý", "Needs attention");

  return (
    <main className="container">
      <AutoRefresh seconds={60} />
      <OpenOnHash />

      {/* Đầu trang: một khối gồm quay lại, người đang xem, trạng thái; chọn người khác ngay bên dưới. */}
      <section className="card detail-head">
        <Link href="/" className="icon-tile back" aria-label={t("Về tổng quan", "Back to overview")}>
          <IconBack size={20} />
        </Link>
        <Avatar name={e.name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 10 }}>
            <h1 style={{ fontSize: 24, margin: 0 }}>{e.name}</h1>
            <StatusChip status={e.status} />
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            {[age(e.birthYear, lang), e.conditions.map((c) => CONDITIONS[c] ?? c).join(", "),
              e.watchLabel ? `${e.watchLabel}${e.watchBattery != null ? ` · ${t("pin", "battery")} ${e.watchBattery}%` : ""}` : null,
              `${e.liveSource ? t("đồng hồ gửi trực tiếp", "watch sends directly") : "Garmin Connect"} ${fmtAgo(e.lastDataAt, undefined, lang)}`]
              .filter(Boolean).join(" · ")}
          </div>
        </div>
        {settings.elders.length > 1 && (
          <nav className="pills people" aria-label={t("Chọn người thân", "Choose a family member")}>
            {settings.elders.map((x) => (
              <Link key={x.id} href={`/nguoi-than/${x.id}`} className="pill" aria-current={x.id === e.id ? "page" : undefined}>{x.name}</Link>
            ))}
          </nav>
        )}
      </section>

      <nav className="pills" aria-label={t("Mục", "Sections")}>
        <a className="pill active" href="#tong-quan">{t("Sức khoẻ", "Health")}</a>
        <a className="pill" href="#canh-bao">{t("Cảnh báo", "Alerts")}{openAlerts.length ? ` (${openAlerts.length})` : ""}</a>
        <a className="pill" href="#nguong">{t("Ngưỡng", "Thresholds")}</a>
        <a className="pill" href="#thuoc">{t("Thuốc", "Medications")}</a>
        <a className="pill" href="#dong-ho">{t("Đồng hồ", "Watch")}</a>
        <a className="pill" href="#thong-tin">{t("Thông tin", "Info")}</a>
      </nav>

      <div className="split detail-split">
        <div className="main-col">
          <section id="tong-quan" className="card" style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center", justifyContent: "center" }}>
            <HeartRing bpm={hr} />
            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
              <div className="muted" style={{ fontSize: 14 }}>{e.hrNow != null ? t("Nhịp tim lúc này", "Heart rate now") : t("Nhịp tim nghỉ", "Resting heart rate")}</div>
              <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.1 }}>
                {hr ?? "—"}{hr != null && <span style={{ fontSize: 16, fontWeight: 500, color: "var(--muted)" }}> bpm</span>}
              </div>
              {hrState && (
                <div className={`chip ${hrOk ? "tone-ok" : "tone-danger"}`} style={{ marginTop: 6 }}>{hrState}</div>
              )}
              {e.wear === "not_worn" && <div className="chip tone-neutral" style={{ marginTop: 6 }}>{t("Đang không đeo đồng hồ", "Watch not being worn")}</div>}
              {e.wear === "charging" && <div className="chip tone-neutral" style={{ marginTop: 6 }}>{t("Đồng hồ đang sạc", "Watch is charging")}</div>}
              {e.inactiveMin != null && e.inactiveMin >= 90 && (
                <div className="chip tone-warn" style={{ marginTop: 6 }}>
                  {t(`Ngồi/nằm im ${Math.floor(e.inactiveMin / 60)} giờ ${e.inactiveMin % 60} phút`,
                    `Not moving for ${Math.floor(e.inactiveMin / 60)} h ${e.inactiveMin % 60} min`)}
                </div>
              )}
              <div className="kpis tight" style={{ marginTop: 16 }}>
                <Kpi icon={<IconBolt size={16} />} tile="tile-amber" label={t("Năng lượng", "Energy")} value={e.today.bodyBattery ?? "—"} />
                <Kpi icon={<IconPulse size={16} />} tile="tile-coral" label={t("Căng thẳng", "Stress")} value={e.today.stressNow ?? e.today.stressAvg ?? "—"}
                  note={e.today.stress1h != null ? t(`TB 1 giờ: ${e.today.stress1h}`, `1-hour avg: ${e.today.stress1h}`) : undefined} />
                <Kpi icon={<IconMoon size={16} />} tile="tile-violet" label={t("Ngủ", "Sleep")} value={fmtDuration(e.today.sleepSeconds, lang)} />
              </div>
            </div>
          </section>

          <section id="tim" className="card">
            <div className="card-head">
              <h2>{t("Nhịp tim 24 giờ", "24-hour heart rate")}</h2>
              {vals.length > 0 && (
                <span className="muted">{t("Thấp nhất", "Low")} {Math.min(...vals)} · {t("Cao nhất", "High")} {Math.max(...vals)}
                  {hrRule ? ` · ${t("ngưỡng", "threshold")} ${hrRule.threshold}` : ""}</span>
              )}
            </div>
            <HrChart data={e.hr24h} threshold={hrRule?.threshold} label={t(`Nhịp tim 24 giờ của ${e.name}`, `${e.name}'s 24-hour heart rate`)} />
            <div className="kpis six" style={{ marginTop: 16 }}>
              <Kpi icon={<IconHeart size={16} />} tile="tile-coral" label={t("Nhịp tim nghỉ", "Resting heart rate")} value={e.today.restingHr ?? "—"} unit="bpm" />
              <Kpi icon={<IconDrop size={16} />} tile="tile-blue" label={t("SpO2 thấp nhất", "Lowest SpO2")} value={e.today.spo2Min ?? "—"} unit="%" />
              <Kpi icon={<IconLungs size={16} />} tile="tile-teal" label={t("Nhịp thở", "Breathing rate")} value={e.today.respiration ?? "—"} unit={t("lần/phút", "breaths/min")} />
              <Kpi icon={<IconHeart size={16} />} tile="tile-violet" label={t("HRV đêm qua", "HRV last night")} value={e.today.hrv ?? "—"} unit="ms"
                note={e.today.hrv == null ? t("Cần liên kết Garmin Connect", "Needs Garmin Connect link") : undefined} />
              <Kpi icon={<IconPulse size={16} />} tile="tile-coral" label={t("Huyết áp", "Blood pressure")} value={bp ? `${bp.systolic}/${bp.diastolic}` : "—"}
                note={bp ? fmtDateTime(bp.measuredAt, lang) : t("Ba mẹ nhắn 130/85 cho bot", "Parents text 130/85 to the bot")} />
              <Kpi icon={<IconDrop size={16} />} tile="tile-violet" label={t("Đường huyết", "Blood glucose")} value={glucose?.value ?? "—"}
                unit={glucose ? "mmol/L" : undefined} note={glucose ? fmtDateTime(glucose.measuredAt, lang) : undefined} />
            </div>
          </section>

          <section id="van-dong" className="card">
            <h2>{t("Vận động hôm nay", "Activity today")}</h2>
            <div className="kpis five" style={{ margin: "12px 0 18px" }}>
              <Kpi icon={<IconSteps size={16} />} tile="tile-teal" label={t("Bước", "Steps")} value={fmtNum(e.today.steps, lang)} />
              <Kpi icon={<IconFlame size={16} />} tile="tile-coral" label={t("Calo", "Calories")} value={fmtNum(e.today.calories ?? null, lang)} unit="kcal" />
              <Kpi icon={<IconRoute size={16} />} tile="tile-blue" label={t("Quãng đường", "Distance")}
                value={e.today.distanceM != null
                  ? t((e.today.distanceM / 1000).toFixed(1).replace(".", ","), (e.today.distanceM / 1000).toFixed(1)) : "—"} unit="km" />
              <Kpi icon={<IconBolt size={16} />} tile="tile-amber" label={t("Phút vận động", "Active minutes")} value={e.today.activeMin ?? "—"} unit={t("phút", "min")} />
              <Kpi icon={<IconSteps size={16} />} tile="tile-violet" label={t("Tầng leo", "Floors climbed")} value={e.today.floors ?? "—"} />
            </div>
            <h2>{t("Hoạt động trong tuần", "This week's activity")}</h2>
            <StepsChart data={d.steps7} />
          </section>
        </div>

        <aside className="side-col">
          <section className="card side-card">
            <div className="card-head">
              <h2>{t("Cảnh báo đang mở", "Open alerts")}</h2>
              <a className="link-sm" href="#canh-bao">{t("Lịch sử", "History")}</a>
            </div>
            {openAlerts.length === 0
              ? <div className="row" style={{ gap: 10 }}><span className="chip tone-ok">{t("Không có", "None")}</span>
                  <span className="muted" style={{ fontSize: 14 }}>{t("Mọi chỉ số trong ngưỡng.", "Everything is within thresholds.")}</span></div>
              : (
                <ul className="list">
                  {openAlerts.map((a) => (
                    <li key={a.id} className="list-row">
                      <span className="icon-tile tile-coral"><IconBell size={20} /></span>
                      <span className="grow">
                        <span className="title" style={{ display: "block" }}>{alertText(a, lang)}</span>
                        <span className="muted">{fmtDateTime(a.openedAt, lang)}{a.ackedBy ? t(` · ${a.ackedBy} đang xử lý`, ` · ${a.ackedBy} is handling it`) : t(" · chưa ai nhận", " · not taken yet")}</span>
                      </span>
                      <SeverityChip severity={a.severity} />
                    </li>
                  ))}
                </ul>
              )}
          </section>

          <section id="giac-ngu" className="card side-card">
            <div className="card-head">
              <h2>{t("Giấc ngủ đêm qua", "Last night's sleep")}</h2>
              {e.today.sleepScore != null && <span className="muted">{t("Điểm", "Score")} {e.today.sleepScore}/100</span>}
            </div>
            {d.sleep ? <SleepBar sleep={d.sleep} /> : <div className="muted">{t("Chưa có dữ liệu giấc ngủ.", "No sleep data yet.")}</div>}
          </section>

          <section className="card side-card">
            <div className="card-head">
              <h2>{t("Thuốc hôm nay", "Today's medicines")}</h2>
              <a className="link-sm" href="#thuoc">{t("Lịch thuốc", "Schedule")}</a>
            </div>
            {d.meds.length === 0 ? <div className="muted">{t("Chưa có lịch uống thuốc.", "No medication schedule yet.")}</div> : (
              <ul className="list">
                {d.meds.map((m, i) => (
                  <li key={i} className="list-row">
                    <span className={`icon-tile ${m.takenAt ? "tile-teal" : "tile-violet"}`}><IconPill size={20} /></span>
                    <span className="grow">
                      <span className="title" style={{ display: "block" }}>{m.name}</span>
                      <span className="muted">{fmtTime(m.dueAt, lang)}{m.note ? ` · ${m.note}` : ""}</span>
                    </span>
                    <span className={`chip ${m.takenAt ? "tone-ok" : "tone-neutral"}`}>{m.takenAt ? t("Đã uống", "Taken") : t("Chưa", "Not yet")}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card side-card">
            <h2>{t("Hồ sơ đo (7 ngày)", "Readings (7 days)")}</h2>
            {d.readings.length === 0 ? <div className="muted">{lang === "en"
              ? <>None yet. Parents text <code>130/85</code> or <code>đường 7.2</code> (glucose) to the bot.</>
              : <>Chưa có. Ba mẹ nhắn <code>130/85</code> hoặc <code>đường 7.2</code> cho bot.</>}</div> : (
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
                      <span className="muted">{fmtDateTime(r.measuredAt, lang)} · {r.source === "garmin" ? t("máy Garmin", "Garmin device") : "Telegram"}</span>
                    </span>
                    <span className="chev"><IconChevron size={18} /></span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <h2 className="section-title" style={{ margin: "4px 0 -10px" }}>{t("Lịch sử & cài đặt", "History & settings")}</h2>
          <div className="blocks-grid">
            <Block id="canh-bao" group="khoi" icon={<IconBell size={20} />} tile="tile-coral" title={t("Cảnh báo", "Alerts")}
              sub={openAlerts.length ? t(`${openAlerts.length} đang mở · 30 ngày qua`, `${openAlerts.length} open · last 30 days`)
                : t("Không có cảnh báo đang mở · 30 ngày qua", "No open alerts · last 30 days")}
              >
                {d.alerts.length === 0 ? <div className="muted">{t("Không có cảnh báo.", "No alerts.")}</div> : (
                <ul className="list scroll-list">
                  {d.alerts.map((a) => (
                    <li key={a.id} className="list-row">
                      <span className={`icon-tile ${a.resolvedAt ? "tile-teal" : "tile-coral"}`}><IconFile size={20} /></span>
                      <span className="grow">
                        <span className="title" style={{ display: "block" }}>{alertText(a, lang)}</span>
                        <span className="muted">
                          {fmtDateTime(a.openedAt, lang)}
                          {a.ackedBy ? t(` · ${a.ackedBy} nhận lúc ${fmtTime(a.ackedAt!, lang)}`,
                            ` · acknowledged by ${a.ackedBy} at ${fmtTime(a.ackedAt!, lang)}`) : ""}
                          {a.resolvedAt ? t(" · đã bình thường", " · back to normal") : t(" · đang mở", " · open")}
                        </span>
                      </span>
                      <SeverityChip severity={a.severity} />
                    </li>
                  ))}
                </ul>
              )}
            </Block>

            <Block id="nguong" group="khoi" icon={<IconAlert size={20} />} tile="tile-amber" title={t("Ngưỡng cảnh báo", "Alert thresholds")}
              sub={t(`${rules.filter((r) => r.enabled).length}/${rules.length} ngưỡng đang bật`,
                `${rules.filter((r) => r.enabled).length}/${rules.length} thresholds on`)}>
              {!canEdit && <div className="banner info">{t("Bạn đang xem. Chỉ quản trị gia đình mới sửa được.", "View only. Only family admins can make changes.")}</div>}
              {RULE_GROUPS.map((g, i) => {
                const rs = rules.filter((r) => g.metrics.includes(r.metric));
                if (!rs.length) return null;
                return (
                  <details key={g.key} className="group-block" open={i === 0}>
                    <summary>
                      <span className={`icon-tile ${g.tile}`}>{GROUP_ICON[g.key] ?? <IconBell size={20} />}</span>
                      <span className="grow">
                        <span className="title" style={{ display: "block" }}>{g.title}</span>
                        <span className="muted" style={{ fontSize: 13 }}>{t(`${rs.length} ngưỡng · ${rs.filter((r) => r.enabled).length} đang bật`,
                          `${rs.length} thresholds · ${rs.filter((r) => r.enabled).length} on`)}</span>
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

            <Block id="thuoc" group="khoi" icon={<IconPill size={20} />} tile="tile-violet" title={t("Thuốc", "Medications")}
              sub={t(`${es?.meds.length ?? 0} loại thuốc · bot nhắc đúng giờ`, `${es?.meds.length ?? 0} medicines · reminders on time`)}>
              <div className="muted" style={{ fontSize: 13 }}>{t("Quá 60 phút chưa bấm “Đã uống” thì bot báo cả nhà.",
                "If “Taken” isn't tapped within 60 minutes, the bot tells the whole family.")}</div>
              {(es?.meds.length ?? 0) === 0 && <div className="muted">{t("Chưa có lịch thuốc.", "No medications scheduled.")}</div>}
              <ul className="list">
                {es?.meds.map((m) => (
                  <li key={m.id} className="list-row">
                    <span className="icon-tile tile-violet"><IconPill size={20} /></span>
                    <span className="grow">
                      <span className="title" style={{ display: "block" }}>{m.name}</span>
                      <span className="row" style={{ gap: 6, marginTop: 4 }}>
                        {m.times.map((tm) => <span key={tm} className="chip tone-ok">{tm}</span>)}
                        {m.note && <span className="muted">{m.note}</span>}
                      </span>
                    </span>
                    {canEdit && (
                      <form action={deleteMed}>
                        <input type="hidden" name="med_id" value={m.id} />
                        <button className="btn ghost small" type="submit" style={{ color: "var(--coral-ink)" }}>{t("Xoá", "Delete")}</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
              {canEdit && <AddMedForm elderId={e.id} />}
            </Block>

            <Block id="dong-ho" group="khoi" icon={<IconWatch size={20} />} tile="tile-blue" title={t("Đồng hồ & thiết bị", "Watch & devices")}
              sub={e.watchLabel
                ? `${e.watchLabel}${e.watchBattery != null ? ` · ${t("pin", "battery")} ${e.watchBattery}%` : ""} · ${t("gửi", "sent")} ${fmtAgo(e.lastDataAt, undefined, lang)}`
                : t("Chưa gắn đồng hồ", "No watch set up")}>
              <ul className="list">
                {es?.devices.map((dv) => (
                  <li key={dv.id} className="list-row">
                    <span className="icon-tile tile-blue"><IconWatch size={20} /></span>
                    <span className="grow">
                      <span className="title" style={{ display: "block" }}>{dv.label ?? t("Đồng hồ Garmin", "Garmin watch")}</span>
                      <span className="muted">
                        {t("Gửi trực tiếp", "Sends directly")} · {fmtAgo(dv.lastSeenAt, undefined, lang)}
                        {dv.battery != null ? ` · ${t("pin", "battery")} ${dv.battery}%` : ""}
                      </span>
                    </span>
                    {canEdit && (
                      <form action={deleteDevice}>
                        <input type="hidden" name="device_id" value={dv.id} />
                        <button className="btn ghost small" type="submit" style={{ color: "var(--coral-ink)" }}>{t("Ngắt kết nối", "Disconnect")}</button>
                      </form>
                    )}
                  </li>
                ))}
                <li className="list-row">
                  <span className="icon-tile tile-teal"><IconHeart size={20} /></span>
                  <span className="grow">
                    <span className="title" style={{ display: "block" }}>Garmin Connect</span>
                    <span className="muted">{es?.garmin ? t(`Đồng bộ ${fmtAgo(es.garmin.lastSyncAt, undefined, lang)}`, `Synced ${fmtAgo(es.garmin.lastSyncAt, undefined, lang)}`)
                      : t("Chưa kết nối (không bắt buộc: thêm giấc ngủ, SpO2 ban đêm)", "Not connected (optional: adds sleep and overnight SpO2)")}</span>
                  </span>
                  {es?.garmin && <span className={`chip ${GARMIN_STATUS[es.garmin.status]?.tone ?? "tone-neutral"}`}>
                    {GARMIN_STATUS[es.garmin.status]?.label ?? es.garmin.status}</span>}
                </li>
              </ul>
              {canEdit && (
                <details className="more" open={!es?.garmin || es.garmin.status === "needs_relogin"}>
                  <summary className="btn small">{es?.garmin ? t("Liên kết lại Garmin Connect", "Relink Garmin Connect") : t("Liên kết Garmin Connect", "Link Garmin Connect")}</summary>
                  <div style={{ marginTop: 10 }}><GarminLinkForm elderId={e.id} relink={!!es?.garmin} /></div>
                </details>
              )}
              {canEdit && es?.garmin && (
                <form action={deleteGarmin}>
                  <input type="hidden" name="elder_id" value={e.id} />
                  <button className="btn ghost small" type="submit" style={{ color: "var(--coral-ink)" }}>{t("Gỡ liên kết Garmin Connect", "Unlink Garmin Connect")}</button>
                </form>
              )}
              <Link className="btn primary small" href={`/ket-noi-dong-ho?nguoi=${e.id}`} style={{ alignSelf: "flex-start" }}>
                {t("Kết nối đồng hồ bằng mã 6 số", "Connect watch with a 6-digit code")} <span className="arrow"><IconChevron size={16} /></span>
              </Link>
              {canEdit && (
                <details className="more">
                  <summary className="muted">{t("Cách thủ công: tạo mã dài để dán vào Garmin Connect", "Manual option: create a long key to paste into Garmin Connect")}</summary>
                  <WatchKeyForm elderId={e.id} />
                </details>
              )}
            </Block>

            <Block id="thong-tin" group="khoi" icon={<IconUser size={20} />} tile="tile-teal" title={t("Thông tin & Telegram", "Info & Telegram")}
              sub={[age(e.birthYear, lang), e.conditions.map((c) => CONDITIONS[c] ?? c).join(", ") || t("chưa có bệnh nền", "no health conditions"),
                info?.hasTelegram ? t("đã nối Telegram", "Telegram linked") : t("chưa nối Telegram", "Telegram not linked")].filter(Boolean).join(" · ")}>
              {info && canEdit && <EditElderForm elder={info} />}
              {info && canEdit && <DeleteElder elder={info} />}
              <div className="list-row" style={{ minHeight: 0 }}>
                <span className="icon-tile tile-blue"><IconTelegram size={20} /></span>
                <span className="grow">
                  <span className="title" style={{ display: "block" }}>{t(`Telegram của ${e.name}`, `${e.name}'s Telegram`)}</span>
                  <span className="muted">{info?.hasTelegram
                    ? t("Bot nhắc thuốc riêng, nhận chỉ số huyết áp/đường huyết qua tin nhắn",
                      "The bot sends personal medication reminders and takes blood pressure/glucose readings by message")
                    : t("Chưa nối: nhắc thuốc sẽ gửi vào nhóm gia đình", "Not linked: medication reminders go to the family group")}</span>
                </span>
                <span className={`chip ${info?.hasTelegram ? "tone-ok" : "tone-neutral"}`}>{info?.hasTelegram ? t("Đã nối", "Linked") : t("Chưa nối", "Not linked")}</span>
              </div>
              {canEdit && <LinkCodeForm bot={bot.username} kind="elder" elderId={e.id}
                label={info?.hasTelegram ? t(`Nối lại Telegram của ${e.name}`, `Relink ${e.name}'s Telegram`)
                  : t(`Nối Telegram của ${e.name}`, `Link ${e.name}'s Telegram`)} />}
              {info?.command && <div className="muted" style={{ fontSize: 14 }}>{lang === "en"
                ? <>In the Telegram group, send <code>/{info.command}</code> for a quick status.</>
                : <>Trong nhóm Telegram, nhắn <code>/{info.command}</code> để xem nhanh tình hình.</>}</div>}
            </Block>
          </div>
        </aside>
      </div>

      <p className="muted">{t("Thông tin chỉ để tham khảo, không thay thế chẩn đoán của bác sĩ.", "For reference only; not a substitute for a doctor's diagnosis.")}</p>

    </main>
  );
}
