import Link from "next/link";
import { IconChart, IconChevron } from "@/components/icons";
import { requireSession } from "@/lib/auth";
import { getWeeklyReports } from "@/lib/data";
import { makeT } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import CreateReport from "./CreateReport";

export const dynamic = "force-dynamic";

const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export default async function ReportsPage() {
  const s = await requireSession();
  const t = makeT(await getLang());
  const reports = await getWeeklyReports(s.familyId);
  return (
    <main className="container" style={{ maxWidth: 860 }}>
      <div>
        <h1 style={{ fontSize: 24 }}>{t("Báo cáo tuần", "Weekly reports")}</h1>
        <p className="muted" style={{ margin: "4px 0 0" }}>{t(
          "Mỗi sáng Chủ nhật, bot gửi vào nhóm Telegram bảng tóm tắt tuần của từng người (so với tuần trước) và nhận xét của AI.",
          "Every Sunday morning the bot posts each person's weekly summary (compared with the week before) and AI comments to the Telegram group.")}</p>
      </div>
      {s.isAdmin && <CreateReport />}
      <section className="card">
        {reports.length === 0
          ? <div className="muted">{t("Chưa có báo cáo nào. Báo cáo đầu tiên đến vào sáng Chủ nhật này, hoặc bấm tạo ngay ở trên.",
              "No reports yet. The first arrives this Sunday morning, or create one now above.")}</div>
          : (
            <ul className="list">
              {reports.map((r) => (
                <li key={r.id}>
                  <Link className="list-row" href={`/bao-cao/${r.id}`}>
                    <span className="icon-tile tile-teal"><IconChart size={20} /></span>
                    <span className="grow">
                      <span className="title" style={{ display: "block" }}>{t("Tuần", "Week")} {dm(r.weekStart)} – {dm(r.weekEnd)}/{r.weekEnd.slice(0, 4)}</span>
                      <span className="muted">{r.hasAi ? t("Có nhận xét AI", "With AI comments") : t("Bảng số liệu", "Numbers only")}</span>
                    </span>
                    <span className="chev"><IconChevron size={18} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
      </section>
    </main>
  );
}
