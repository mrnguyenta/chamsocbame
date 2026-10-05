import { NextResponse, type NextRequest } from "next/server";
import { getIdentity, SAMPLE_BLOCKED } from "@/lib/auth";
import { sql } from "@/lib/db";
import { API_URL, adminOfElder } from "@/lib/garmin";

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
  if ((await getIdentity())?.isSample) return NextResponse.json({ status: "failed", message: SAMPLE_BLOCKED });
  if (!email || !password) return NextResponse.json({ status: "failed", message: "Nhập email và mật khẩu Garmin." });
  if (!(await adminOfElder(elderId))) return NextResponse.json({ status: "failed", message: "Bạn không có quyền." }, { status: 403 });
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return NextResponse.json({ status: "failed", message: "Máy chủ chưa cấu hình INTERNAL_API_SECRET." });

  // Trình duyệt tạo sẵn id để vừa gửi vừa hỏi trạng thái.
  if (!/^[0-9a-f-]{36}$/.test(requestId)) return NextResponse.json({ status: "failed", message: "Thiếu mã lượt liên kết." });
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
    await sql()`update garmin_link_requests set status = 'failed', message = ${`Máy chủ không phản hồi (${(e as Error).message}). Thử lại sau.`}
                where id = ${requestId} and status not in ('done', 'failed', 'expired')`;
  }
  const [row] = await sql()`select status, message from garmin_link_requests where id = ${requestId}`;
  return NextResponse.json({ status: row.status, message: row.message });
}
