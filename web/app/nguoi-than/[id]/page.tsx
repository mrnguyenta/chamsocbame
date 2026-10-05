import Link from "next/link";
import { notFound } from "next/navigation";
import AutoRefresh from "@/components/AutoRefresh";
import HeartRing from "@/components/HeartRing";
import HrChart from "@/components/HrChart";
import SleepBar from "@/components/SleepBar";
import StepsChart from "@/components/StepsChart";
import {
  IconBack, IconBolt, IconChevron, IconDrop, IconFile, IconHeart, IconMoon, IconPill, IconPulse, IconSteps,
} from "@/components/icons";
import { Avatar, Kpi, SeverityChip, StatusChip } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { getElderDetail, getSettings } from "@/lib/data";
import { age, fmtAgo, fmtDateTime, fmtDuration, fmtNum, fmtTime } from "@/lib/format";
import { CONDITIONS } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function ElderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const [d, settings] = await Promise.all([getElderDetail(session.familyId, id), getSettings(session.familyId)]);
  if (!d) notFound();
  const e = d.elder;
  const rules = settings.elders.find((x) => x.id === e.id)?.rules ?? [];
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

      <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <Link href="/" className="icon-tile" aria-label="Về tổng quan"
          style={{ background: "var(--surface-solid)", boxShadow: "var(--shadow-sm)", color: "var(--text)" }}>
          <IconBack size={20} />
        </Link>
        <h1 style={{ fontSize: 18, textAlign: "center" }}>Tình trạng sức khoẻ</h1>
        <Link href="/cai-dat" className="btn small">Ngưỡng</Link>
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
        <a className="pill active" href="#tong-quan">Tổng quan</a>
        <a className="pill" href="#tim">Tim mạch</a>
        <a className="pill" href="#van-dong">Vận động</a>
        <a className="pill" href="#giac-ngu">Giấc ngủ</a>
        <a className="pill" href="#ho-so">Hồ sơ</a>
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

        <aside id="ho-so" className="side-col">
          <section className="card">
            <h2>Thuốc hôm nay</h2>
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
          </section>

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

          <section className="card">
            <h2>Lịch sử cảnh báo (30 ngày)</h2>
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
          </section>
        </aside>
      </div>
      <p className="muted">Thông tin chỉ để tham khảo, không thay thế chẩn đoán của bác sĩ.</p>
    </main>
  );
}
