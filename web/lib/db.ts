import "server-only";
import postgres from "postgres";

// Không có DATABASE_URL => chế độ demo với dữ liệu mẫu.
export const isDemo = !process.env.DATABASE_URL;

const globalForDb = globalThis as unknown as { sql?: postgres.Sql };

export function sql(): postgres.Sql {
  if (isDemo) throw new Error("Chế độ demo: chưa cấu hình DATABASE_URL");
  // prepare: false là bắt buộc khi dùng pooler của Supabase (chế độ transaction).
  // idle_timeout/max_lifetime: đóng kết nối nhàn rỗi trước khi pooler cắt ngầm, tránh câu lệnh treo trên
  // kết nối đã chết (trước đây trang đứng tới 300 giây). connect_timeout: báo lỗi nhanh thay vì chờ mãi.
  globalForDb.sql ??= postgres(process.env.DATABASE_URL!, {
    prepare: false, max: 3, idle_timeout: 20, max_lifetime: 60 * 10, connect_timeout: 10,
  });
  return globalForDb.sql;
}
