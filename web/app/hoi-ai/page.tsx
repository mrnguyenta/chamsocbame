import { requireSession } from "@/lib/auth";
import { isDemo, sql } from "@/lib/db";
import { makeT } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import AskAI from "./AskAI";

export const dynamic = "force-dynamic";

export default async function AskAIPage() {
  const s = await requireSession();
  const t = makeT(await getLang());
  const elders = isDemo ? [] : (await sql()`select display_name from elders where family_id = ${s.familyId} order by created_at`)
    .map((e) => e.display_name as string);
  const first = elders[0] ?? t("Ba", "Dad");
  const suggestions = [
    t(`${first} hôm nay thế nào?`, `How is ${first} today?`),
    t("Tuần này ai ngủ kém nhất?", "Who slept worst this week?"),
    t("Có gì đáng lo trong 7 ngày qua không?", "Anything worrying in the last 7 days?"),
    t("Nhịp tim nghỉ của mọi người có tăng không?", "Has anyone's resting heart rate gone up?"),
  ];
  return (
    <main className="container" style={{ maxWidth: 860 }}>
      <div>
        <h1 style={{ fontSize: 24 }}>{t("Hỏi AI", "Ask AI")}</h1>
        <p className="muted" style={{ margin: "4px 0 0" }}>{t(
          "AI đọc số liệu đồng hồ, huyết áp, thuốc và cảnh báo của cả nhà để trả lời. Chỉ để tham khảo, không thay bác sĩ.",
          "The AI reads the family's watch data, blood pressure, medicines and alerts to answer. For reference only, not a doctor.")}</p>
      </div>
      <AskAI suggestions={suggestions} />
      <p className="muted" style={{ fontSize: 13 }}>{t(
        "Trong nhóm Telegram cũng hỏi được: gõ /hoi rồi câu hỏi, ví dụ “/hoi Mẹ tuần này ngủ thế nào?”.",
        "You can also ask in the Telegram group: type /hoi followed by your question.")}</p>
    </main>
  );
}
