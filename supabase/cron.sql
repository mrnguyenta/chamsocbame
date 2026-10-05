-- Lịch chạy định kỳ: Supabase pg_cron gọi backend trên Vercel.
-- (Gói Vercel Hobby chỉ cho cron 1 lần/ngày, nên dùng pg_cron của Supabase.)
--
-- 1. Supabase Dashboard → Database → Extensions: bật pg_cron và pg_net.
-- 2. Lưu bí mật vào Vault (thay giá trị thật, CRON_SECRET giống biến môi trường trên Vercel):
--      select vault.create_secret('https://<ten-du-an>.vercel.app', 'backend_url');
--      select vault.create_secret('<CRON_SECRET>', 'cron_secret');
-- 3. Chạy phần dưới trong SQL Editor.

select cron.schedule('chamsoc-sync', '*/15 * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'backend_url') || '/api/cron/sync',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    timeout_milliseconds := 60000
  );
$$);

select cron.schedule('chamsoc-tick', '*/5 * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'backend_url') || '/api/cron/tick',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    timeout_milliseconds := 60000
  );
$$);
