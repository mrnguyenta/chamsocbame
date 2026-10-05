-- Một gia đình nối được nhiều nhóm Telegram (ví dụ nhóm anh chị em, nhóm cả họ); lưu tên nhóm để hiện trên website.
-- Mỗi nhóm chỉ thuộc một gia đình.
create table family_chats (
  chat_id    bigint primary key,
  family_id  uuid not null references families(id) on delete cascade,
  title      text,
  linked_at  timestamptz not null default now()
);
create index family_chats_family on family_chats (family_id);
alter table family_chats enable row level security;

insert into family_chats (chat_id, family_id)
select telegram_chat_id, id from families where telegram_chat_id is not null
on conflict (chat_id) do nothing;
alter table families drop column telegram_chat_id;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'chamsoc_app') then
    grant select, insert, update, delete on family_chats to chamsoc_app;
  end if;
end $$;
revoke all on family_chats from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on family_chats from anon, authenticated;
  end if;
end $$;
