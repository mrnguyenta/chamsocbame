import { NextResponse, type NextRequest } from "next/server";
import { linkRequestOfAdmin } from "@/lib/garmin";

export async function GET(req: NextRequest) {
  const r = await linkRequestOfAdmin(req.nextUrl.searchParams.get("id") ?? "");
  if (!r) return NextResponse.json({ status: "starting", message: null });
  return NextResponse.json({ status: r.status, message: r.message });
}
