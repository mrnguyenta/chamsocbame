import Link from "next/link";
import { notFound } from "next/navigation";
import AutoRefresh from "@/components/AutoRefresh";
import HrChart from "@/components/HrChart";
import SleepBar from "@/components/SleepBar";
import StepsChart from "@/components/StepsChart";
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
  const vals = e.hr24h.map((p) => p.bpm);
  const bp = d.readings.find((r) => r.kind === "blood_pressure");
  const glucose = d.readings.find((r) => r.kind === "glucose");

  return (
    <main className="container">
      <AutoRefresh seconds={60} />
      <nav className="row" aria-label="Chọn người thân" style={{ gap: 6 }}>
        <Link href="/" className="btn small">← Tổng quan</Link>
        {settings.elders.map((x) => (
          <Link key={x.id} href={`/nguoi-than/${x.id}`} className="btn small"
            style={x.id === e.id ? { background: "var(--text)", color: "var(--bg)", borderColor: "var(--text)" } : undefined}
            aria-current={x.id === e.id ? "page" : undefined}>{x.name}</Link>
        ))}
      </nav>

      <section className="row" style={{ gap: 16 }}>
        <Avatar name={e.name} />
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <div className="row" style={{ gap: 10 }}>
            <h1 style={{ fontSize: 28 }}>{e.name}</h1>
            <StatusChip status={e.status} />
          </div>
          <div className="muted" style={{ fontSize: 14 }}>
            {[age(e.birthYear), e.conditions.map((c) => CONDITIONS[c] ?? c).join(", "),
              e.watchLabel ? `${e.watchLabel}${e.watchBattery != null ? ` (pin ${e.watchBattery}%)` : ""}` : null,
              `${e.liveSource ? "đồng hồ gửi trực tiếp" : "Garmin Connect"} ${fmtAgo(e.lastDataAt)}`]
              .filter(Boolean).join(" · ")}
          </div>
        </div>
        <Link className="btn" href="/cai-dat">Chỉnh ngưỡng cảnh báo</Link>
      </section>

      <section className="kpis" aria-label="Chỉ số hôm nay">
        <Kpi label="Nhịp tim lúc này" value={e.hrNow ?? "—"} unit="bpm"
          note={e.hrNow == null ? "Cần ứng dụng đồng hồ" : "Trung bình vài phút gần nhất"} />
        <Kpi label="Nhịp tim nghỉ" value={e.today.restingHr ?? "—"} unit="bpm" />
        <Kpi label="Bước chân" value={fmtNum(e.today.steps)} />
        <Kpi label="Giấc ngủ" value={fmtDuration(e.today.sleepSeconds)}
          note={e.today.sleepScore != null ? `Điểm ngủ ${e.today.sleepScore}/100` : undefined} />
        <Kpi label="Body Battery" value={e.today.bodyBattery ?? "—"} unit="/100" />
        <Kpi label="SpO2 thấp nhất" value={e.today.spo2Min ?? "—"} unit="%" />
        <Kpi label="Huyết áp gần nhất" value={bp ? `${bp.systolic}/${bp.diastolic}` : "—"}
          note={bp ? fmtDateTime(bp.measuredAt) : "Ba mẹ nhắn 130/85 cho bot"} />
        <Kpi label="Đường huyết gần nhất" value={glucose?.value ?? "—"} unit={glucose ? "mmol/L" : undefined}
          note={glucose ? fmtDateTime(glucose.measuredAt) : undefined} />
      </section>

      <div className="split">
        <div className="main-col">
          <section className="card">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
              <h2 style={{ margin: 0 }}>Nhịp tim 24 giờ qua</h2>
              {vals.length > 0 && (
                <span className="muted">Thấp nhất {Math.min(...vals)} · Cao nhất {Math.max(...vals)} bpm
                  {hrRule ? ` · ngưỡng cảnh báo ${hrRule.threshold}` : ""}</span>
              )}
            </div>
            <div style={{ marginTop: 14 }}>
              <HrChart data={e.hr24h} threshold={hrRule?.threshold} label={`Nhịp tim 24 giờ của ${e.name}`} />
            </div>
          </section>

          <div className="split">
            <section className="card" style={{ flex: "1 1 300px", minWidth: 0 }}>
              <h2>Giấc ngủ đêm qua</h2>
              {d.sleep ? <SleepBar sleep={d.sleep} /> : <div className="muted">Chưa có dữ liệu giấc ngủ.</div>}
            </section>
            <section className="card" style={{ flex: "1 1 300px", minWidth: 0 }}>
              <h2>Bước chân 7 ngày</h2>
              <StepsChart data={d.steps7} />
            </section>
          </div>

          <section className="card">
            <h2>Lịch sử cảnh báo (30 ngày)</h2>
            {d.alerts.length === 0 ? <div className="muted">Không có cảnh báo.</div> : (
              <div className="table-wrap">
                <table style={{ minWidth: 560 }}>
                  <thead><tr><th>Thời gian</th><th>Cảnh báo</th><th>Mức</th><th>Xử lý</th></tr></thead>
                  <tbody>
                    {d.alerts.map((a) => (
                      <tr key={a.id}>
                        <td style={{ whiteSpace: "nowrap" }}>{fmtDateTime(a.openedAt)}</td>
                        <td>{a.message}</td>
                        <td><SeverityChip severity={a.severity} /></td>
                        <td className="muted">
                          {a.ackedBy ? `${a.ackedBy} nhận lúc ${fmtTime(a.ackedAt!)}` : "—"}
                          {a.resolvedAt ? " · đã bình thường" : " · đang mở"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="side-col">
          <section className="card">
            <h2>Thuốc hôm nay</h2>
            {d.meds.length === 0 ? <div className="muted">Chưa có lịch uống thuốc.</div> : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {d.meds.map((m, i) => (
                  <li key={i} className="row" style={{ flexWrap: "nowrap", gap: 10 }}>
                    <span className={`chip ${m.takenAt ? "tone-ok" : "tone-neutral"}`}>{m.takenAt ? "Đã uống" : "Chưa"}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{fmtTime(m.dueAt)} · {m.name}</div>
                      {m.note && <div className="muted">{m.note}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="muted" style={{ marginTop: 10 }}>Ba mẹ bấm “Đã uống” ngay trong tin nhắc trên Telegram.</div>
          </section>

          <section className="card">
            <h2>Chỉ số nhập tay (7 ngày)</h2>
            {d.readings.length === 0 ? <div className="muted">Chưa có. Ba mẹ nhắn <code>130/85</code> hoặc <code>đường 7.2</code> cho bot.</div> : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
                {d.readings.map((r, i) => (
                  <li key={i} className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                    <span>{fmtDateTime(r.measuredAt)} <span className="muted">· {r.source === "garmin" ? "máy Garmin" : "Telegram"}</span></span>
                    <strong>
                      {r.kind === "blood_pressure" ? `${r.systolic}/${r.diastolic}` : r.kind === "glucose" ? `${r.value} mmol/L` : `${r.value} kg`}
                    </strong>
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
