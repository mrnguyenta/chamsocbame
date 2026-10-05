import "server-only";
import { API_URL } from "./garmin";

/** Gọi máy chủ Python (AI, báo cáo tuần) bằng chuỗi bí mật nội bộ; người dùng đã được kiểm quyền trước đó. */
export async function callBackend<T>(path: string, body: unknown, timeoutMs = 280_000): Promise<T> {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) throw new Error("INTERNAL_API_SECRET");
  const r = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as T;
}
