import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { callBackend } from "@/lib/backend";
import { getT } from "@/lib/i18n-server";

export const maxDuration = 300;

/** Quản trị gia đình tạo báo cáo tuần ngay (không chờ sáng Chủ nhật), có thể gửi luôn vào nhóm Telegram. */
export async function POST(req: NextRequest) {
  const t = await getT();
  const s = await getSession();
  if (!s?.isAdmin) return NextResponse.json({ ok: false, message: t("Chỉ quản trị gia đình mới tạo được.", "Only family admins can do this.") }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  try {
    const r = await callBackend<{ id: string }>("/api/report/weekly", { family_id: s.familyId, send_telegram: body.send_telegram === true });
    return NextResponse.json({ ok: true, id: r.id });
  } catch (e) {
    return NextResponse.json({ ok: false, message: t(`Chưa tạo được báo cáo (${(e as Error).message}).`, `Couldn't create the report (${(e as Error).message}).`) });
  }
}
