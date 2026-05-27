-- HID-053: Multi-channel account linking
-- Creates hermes_channels table so creator↔channel linkage is stored per-channel
-- rather than as a bare column on creators. Supports Telegram now; LINE in Slice 3.
-- Idempotent: all statements use IF NOT EXISTS / DO-block guards.

create table if not exists hermes_channels (
  id            uuid        primary key default gen_random_uuid(),
  creator_id    uuid        not null references creators(id) on delete cascade,
  channel_type  text        not null check (channel_type in ('telegram', 'line')),
  channel_id    text        not null,  -- telegram chat_id or LINE userId (plaintext)
  is_primary    boolean     not null default true,
  is_active     boolean     not null default true,
  linked_at     timestamptz not null default now(),
  unlinked_at   timestamptz,
  -- one of each channel type per creator
  unique (creator_id, channel_type)
);

create index if not exists hermes_channels_creator_idx
  on hermes_channels (creator_id);

-- fast lookup: given a channel_id, find the linked creator
create unique index if not exists hermes_channels_channel_lookup_idx
  on hermes_channels (channel_type, channel_id)
  where is_active = true;

alter table hermes_channels enable row level security;

-- service-role bypass (Hermes bot uses service-role key)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'hermes_channels'
      and policyname = 'service_role_all'
  ) then
    create policy service_role_all on hermes_channels
      using (true)
      with check (true);
  end if;
end $$;

-- creator can read their own channel rows (web dashboard)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'hermes_channels'
      and policyname = 'creator_self_select'
  ) then
    create policy creator_self_select on hermes_channels
      for select
      using (creator_id = nullif(current_setting('app.current_creator_id', true), '')::uuid);
  end if;
end $$;

-- Migrate any existing telegram_user_id rows from creators table if the column exists.
-- Safe to run even if the column was never added (DO block catches the missing-column error).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'creators' and column_name = 'telegram_user_id'
  ) then
    insert into hermes_channels (creator_id, channel_type, channel_id, is_primary, is_active, linked_at)
    select id, 'telegram', telegram_user_id, true, true, coalesce(updated_at, now())
    from creators
    where telegram_user_id is not null
    on conflict (creator_id, channel_type) do nothing;
  end if;
end $$;
