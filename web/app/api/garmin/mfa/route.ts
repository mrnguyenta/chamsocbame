import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { linkRequestOfAdmin } from "@/lib/garmin";
import { getT } from "@/lib/i18n-server";

/** Ghi mã xác thực Garmin người dùng vừa nhập; máy chủ đang chờ sẽ đọc lấy. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = String(body.request_id ?? "");
  const code = String(body.code ?? "").replace(/\s/g, "").slice(0, 12);
  const t = await getT();
  if (!/^\d{4,10}$/.test(code)) {
    return NextResponse.json({ ok: false, message: t("Mã gồm các chữ số trong email Garmin.", "The code is the digits in the Garmin email.") });
  }
  if (!(await linkRequestOfAdmin(id))) {
    return NextResponse.json({ ok: false, message: t("Không tìm thấy lượt liên kết.", "Link request not found.") }, { status: 404 });
  }

  await sql()`update garmin_link_requests set mfa_code = ${code}, status = 'checking_code', updated_at = now()
              where id = ${id} and status in ('awaiting_mfa', 'wrong_code')`;
  return NextResponse.json({ ok: true });
}
