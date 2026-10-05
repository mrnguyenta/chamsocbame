import Link from "next/link";
import { notFound } from "next/navigation";
import { IconBack } from "@/components/icons";
import { Avatar } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { getWeeklyReport, type WeeklyStats } from "@/lib/data";
import { makeT, type Lang, type T } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

function rows(t: T, lang: Lang) {
  const nf = (v: number | null, digits = 0) =>
    v == null ? "—" : v.toLocaleString(lang === "en" ? "en-US" : "vi-VN", { maximumFractionDigits: digits });
  const hm = (h: number | null) => {
    if (h == null) return "—";
    const m = Math.round(h * 60);
    return lang === "en" ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : `${Math.floor(m / 60)}g ${String(m % 60).padStart(2, "0")}p`;
  };
  // [nhãn, giá trị hiển thị, số để so sánh, tăng là tốt (true) / xấu (false) / không đánh giá (null)]
  return [
    { label: t("Nhịp tim nghỉ", "Resting heart rate"), show: (w: WeeklyStats) => w.resting_hr == null ? "—" : `${nf(w.resting_hr)} bpm`, val: (w: WeeklyStats) => w.resting_hr, upGood: false, minDelta: 3 },
    { label: t("Bước chân / ngày", "Steps / day"), show: (w: WeeklyStats) => nf(w.steps), val: (w: WeeklyStats) => w.steps, upGood: true, minDelta: 500 },
    { label: t("Ngủ / đêm", "Sleep / night"), show: (w: WeeklyStats) => hm(w.sleep_hours), val: (w: WeeklyStats) => w.sleep_hours, upGood: true, minDelta: 0.5 },
    { label: t("Ngủ sâu", "Deep sleep"), show: (w: WeeklyStats) => hm(w.deep_sleep_hours), val: (w: WeeklyStats) => w.deep_sleep_hours, upGood: true, minDelta: 0.25 },
    { label: t("SpO2 thấp nhất", "Lowest SpO2"), show: (w: WeeklyStats) => w.spo2_lowest == null ? "—" : `${w.spo2_lowest}%`, val: (w: WeeklyStats) => w.spo2_lowest, upGood: true, minDelta: 2 },
    { label: t("Căng thẳng TB", "Avg stress"), show: (w: WeeklyStats) => nf(w.stress), val: (w: WeeklyStats) => w.stress, upGood: false, minDelta: 5 },
    { label: "Body Battery", show: (w: WeeklyStats) => nf(w.body_battery), val: (w: WeeklyStats) => w.body_battery, upGood: true, minDelta: 5 },
    { label: "HRV", show: (w: WeeklyStats) => w.hrv == null ? "—" : `${nf(w.hrv)} ms`, val: (w: WeeklyStats) => w.hrv, upGood: true, minDelta: 3 },
    { label: t("Huyết áp TB", "Avg blood pressure"), show: (w: WeeklyStats) => w.bp_systolic ? `${w.bp_systolic}/${w.bp_diastolic}` : "—", val: (w: WeeklyStats) => w.bp_systolic, upGood: false, minDelta: 5 },
    { label: t("Đường huyết TB", "Avg glucose"), show: (w: WeeklyStats) => w.glucose == null ? "—" : `${nf(w.glucose, 1)} mmol/L`, val: (w: WeeklyStats) => w.glucose, upGood: false, minDelta: 0.5 },
    { label: t("Cảnh báo", "Alerts"), show: (w: WeeklyStats) => String(w.alerts), val: (w: WeeklyStats) => w.alerts, upGood: false, minDelta: 1 },
    { label: t("Uống thuốc đúng giờ", "Medicines taken"), show: (w: WeeklyStats) => w.meds?.percent == null ? "—" : `${w.meds.percent}%`, val: (w: WeeklyStats) => w.meds?.percent ?? null, upGood: true, minDelta: 5 },
  ];
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireSession();
  const lang = await getLang();
  const t = makeT(lang);
  const r = await getWeeklyReport(s.familyId, id);
  if (!r) notFound();
  const notes = new Map((r.ai?.people ?? []).map((p) => [p.name, p]));
  const defs = rows(t, lang);
  return (
    <main className="container" style={{ maxWidth: 960 }}>
      <div className="row" style={{ gap: 10 }}>
        <Link className="btn ghost small" href="/bao-cao"><IconBack size={16} /> {t("Các tuần", "All weeks")}</Link>
      </div>
      <div>
        <h1 style={{ fontSize: 24 }}>{t("Báo cáo tuần", "Weekly report")} {dm(r.weekStart)} – {dm(r.weekEnd)}/{r.weekEnd.slice(0, 4)}</h1>
        <p className="muted" style={{ margin: "4px 0 0" }}>{r.data.family} · {t("so với tuần trước", "compared with the week before")}</p>
      </div>
      {r.ai?.overview && <div className="banner info" style={{ fontSize: 15 }}>🤖 {r.ai.overview}</div>}
      {!r.ai && <div className="banner warn">{t("Chưa có nhận xét AI (quản trị bật AI ở trang Quản trị).", "No AI comments (an admin can turn AI on in Admin).")}</div>}
      {r.data.people.map((p) => {
        const note = notes.get(p.name);
        const empty = p.this_week.days_with_data === 0 && p.last_week.days_with_data === 0;
        return (
          <section key={p.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="row" style={{ gap: 12 }}>
              <Avatar name={p.name} />
              <span className="grow">
                <Link href={`/nguoi-than/${p.id}`} className="title" style={{ display: "block", fontSize: 18, fontWeight: 700, color: "var(--text)", textDecoration: "none" }}>{p.name}</Link>
                <span className="muted">{t(`${p.this_week.days_with_data}/7 ngày có số liệu`, `${p.this_week.days_with_data}/7 days with data`)}</span>
              </span>
            </div>
            {empty ? <div className="muted">{t("Chưa có số liệu đồng hồ hai tuần qua.", "No watch data in the last two weeks.")}</div> : (
              <div style={{ overflowX: "auto" }}>
                <table className="report-table">
                  <thead><tr><th>{t("Chỉ số", "Metric")}</th><th>{t("Tuần này", "This week")}</th><th>{t("Tuần trước", "Last week")}</th></tr></thead>
                  <tbody>
                    {defs.filter((d) => d.show(p.this_week) !== "—" || d.show(p.last_week) !== "—").map((d) => {
                      const a = d.val(p.this_week), b = d.val(p.last_week);
                      const delta = a != null && b != null ? a - b : null;
                      const big = delta != null && Math.abs(delta) >= d.minDelta;
                      const good = big && (delta! > 0) === d.upGood;
                      return (
                        <tr key={d.label}>
                          <td>{d.label}</td>
                          <td style={{ fontWeight: 700 }}>
                            {d.show(p.this_week)}
                            {big && <span className={good ? "delta good" : "delta bad"}>{delta! > 0 ? " ▲" : " ▼"}</span>}
                          </td>
                          <td className="muted">{d.show(p.last_week)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {note && (
              <div className="rule" style={{ gap: 8 }}>
                <div>🤖 {note.summary}</div>
                {note.suggestions.length > 0 && <ul style={{ margin: 0, paddingLeft: 20 }}>{note.suggestions.map((x) => <li key={x}>{x}</li>)}</ul>}
              </div>
            )}
            {p.alerts_this_week.length > 0 && (
              <div>
                <div className="section-title" style={{ margin: "0 0 6px" }}>{t("Cảnh báo trong tuần", "Alerts this week")}</div>
                <ul style={{ margin: 0, paddingLeft: 20 }} className="muted">{p.alerts_this_week.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            )}
          </section>
        );
      })}
      <p className="muted" style={{ fontSize: 13 }}>{t("Chỉ để tham khảo, không thay thế chẩn đoán của bác sĩ.", "For reference only; not a substitute for a doctor's diagnosis.")}</p>
    </main>
  );
}
