import { NextResponse, type NextRequest } from "next/server";
import { getIdentity, sampleBlocked } from "@/lib/auth";
import { sql } from "@/lib/db";
import { API_URL, adminOfElder } from "@/lib/garmin";
import { getT } from "@/lib/i18n-server";

// Đăng nhập Garmin có thể phải chờ người dùng nhập mã xác thực từ email.
export const maxDuration = 300;

/**
 * Bắt đầu liên kết Garmin Connect: tạo lượt liên kết rồi gọi máy chủ (chờ tới khi xong).
 * Trình duyệt đồng thời hỏi /api/garmin/status để biết khi nào cần nhập mã.
 * Mật khẩu chỉ đi qua (HTTPS) tới máy chủ để đăng nhập Garmin, không lưu ở đâu.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const elderId = String(body.elder_id ?? "");
  const requestId = String(body.request_id ?? "");
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");
  const t = await getT();
  if ((await getIdentity())?.isSample) return NextResponse.json({ status: "failed", message: sampleBlocked(t) });
  if (!email || !password) return NextResponse.json({ status: "failed", message: t("Nhập email và mật khẩu Garmin.", "Enter your Garmin email and password.") });
  if (!(await adminOfElder(elderId))) {
    return NextResponse.json({ status: "failed", message: t("Bạn không có quyền.", "You don't have permission.") }, { status: 403 });
  }
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    return NextResponse.json({ status: "failed",
      message: t("Máy chủ chưa cấu hình INTERNAL_API_SECRET.", "The server has not configured INTERNAL_API_SECRET.") });
  }

  // Trình duyệt tạo sẵn id để vừa gửi vừa hỏi trạng thái.
  if (!/^[0-9a-f-]{36}$/.test(requestId)) {
    return NextResponse.json({ status: "failed", message: t("Thiếu mã lượt liên kết.", "Missing link request ID.") });
  }
  await sql()`insert into garmin_link_requests (id, elder_id) values (${requestId}, ${elderId})`;
  try {
    const r = await fetch(`${API_URL}/api/garmin/link`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
      body: JSON.stringify({ request_id: requestId, elder_id: elderId, email, password }),
      signal: AbortSignal.timeout(290_000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  } catch (e) {
    const msg = t(`Máy chủ không phản hồi (${(e as Error).message}). Thử lại sau.`,
      `The server did not respond (${(e as Error).message}). Try again later.`);
    await sql()`update garmin_link_requests set status = 'failed', message = ${msg}

                where id = ${requestId} and status not in ('done', 'failed', 'expired')`;
  }
  const [row] = await sql()`select status, message from garmin_link_requests where id = ${requestId}`;
  return NextResponse.json({ status: row.status, message: row.message });
}
