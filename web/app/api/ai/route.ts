import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { callBackend } from "@/lib/backend";
import { getT } from "@/lib/i18n-server";

// AI có thể nghĩ vài chục giây.
export const maxDuration = 120;

/** Hỏi AI về sức khoẻ cả gia đình đang xem; ai trong gia đình cũng hỏi được. */
export async function POST(req: NextRequest) {
  const t = await getT();
  const s = await getSession();
  if (!s) return NextResponse.json({ ok: false, answer: t("Hãy đăng nhập lại.", "Please sign in again.") }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const question = String(body.question ?? "").trim().slice(0, 2000);
  if (!question) return NextResponse.json({ ok: false, answer: t("Hãy nhập câu hỏi.", "Please type a question.") });
  const history = Array.isArray(body.history)
    ? body.history.slice(-12).filter((m: { role?: string; content?: string }) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m: { role: string; content: string }) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    : [];
  try {
    const r = await callBackend<{ ok: boolean; answer: string }>("/api/ai/ask", { family_id: s.familyId, question, history }, 115_000);
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ ok: false, answer: t(`AI chưa trả lời được (${(e as Error).message}). Thử lại sau.`,
      `The AI couldn't answer (${(e as Error).message}). Please try again later.`) });
  }
}
