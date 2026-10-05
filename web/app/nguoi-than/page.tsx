import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getOverview } from "@/lib/data";

export const dynamic = "force-dynamic";

/** "Sức khoẻ" trên thanh điều hướng: mở người thân đầu tiên. */
export default async function HealthIndex() {
  const session = await requireSession();
  const o = await getOverview(session.familyId);
  if (o.elders.length) redirect(`/nguoi-than/${o.elders[0].id}`);
  redirect("/");
}
