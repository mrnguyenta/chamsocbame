import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getOverview } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * Trang Cài đặt cũ đã được chia ra: cài đặt từng người nằm trong trang người đó (/nguoi-than/[id]),
 * cài đặt chung của gia đình (báo cáo, giờ yên lặng) nằm trong Tài khoản. Giữ đường dẫn cũ để link cũ vẫn chạy.
 */
export default async function SettingsRedirect({ searchParams }: { searchParams: Promise<{ nguoi?: string }> }) {
  const session = await requireSession();
  const { nguoi } = await searchParams;
  if (nguoi) redirect(`/nguoi-than/${nguoi}#nguong`);
  const o = await getOverview(session.familyId);
  redirect(o.elders.length ? `/nguoi-than/${o.elders[0].id}#nguong` : "/tai-khoan#bao-cao");
}
