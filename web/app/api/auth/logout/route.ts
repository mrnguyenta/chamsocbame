import { NextResponse, type NextRequest } from "next/server";
import { endSession, getIdentity } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function POST(req: NextRequest) {
  // Tài khoản mẫu: thoát là xoá luôn gia đình mẫu, không chờ hết 24 giờ.
  const id = await getIdentity();
  if (id?.isSample) {
    await sql()`delete from families where expires_at is not null
                and id in (select family_id from caregivers where account_id = ${id.accountId})`;
    await sql()`delete from accounts where id = ${id.accountId} and is_sample`;
  }
  await endSession();
  const to = String((await req.formData().catch(() => null))?.get("to") ?? "");
  return NextResponse.redirect(new URL(to === "/dang-ky" ? "/dang-ky" : "/dang-nhap", req.url), 303);
}
