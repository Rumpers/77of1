-- OF-131: Creator-side fan blocking
-- fan_blocks table: per-creator blocklist.
-- Hermes writes via service_role (BYPASSRLS). twin-engine + credits API check
-- this table before serving any fan request, enforcing <5s block effectiveness.
-- HID-031 (platform-wide ban) uses blocked_by='platform'; creator blocks use 'creator'.

create table if not exists fan_blocks (
  creator_id  uuid        not null references creators(id) on delete cascade,
  fan_id      uuid        not null references fans(id) on delete cascade,
  blocked_at  timestamptz not null default now(),
  blocked_by  text        not null default 'creator'
                check (blocked_by in ('creator', 'platform')),
  reason      text,
  primary key (creator_id, fan_id)
);

create index if not exists fan_blocks_creator_id_idx on fan_blocks (creator_id);
create index if not exists fan_blocks_fan_id_idx     on fan_blocks (fan_id);

-- Needed for platform-wide ban queries (HID-031): find all creator blocks for a fan
create index if not exists fan_blocks_platform_idx   on fan_blocks (fan_id, blocked_by)
  where blocked_by = 'platform';

alter table fan_blocks enable row level security;

-- Creator can SELECT their own block list (read-only for creator session)
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'fan_blocks' and policyname = 'creator_select_blocks'
  ) then
    create policy creator_select_blocks on fan_blocks
      for select
      using (creator_id = nullif(current_setting('app.current_creator_id', true), '')::uuid);
  end if;
end $$;

-- INSERT / UPDATE / DELETE: service_role only (BYPASSRLS).
-- Hermes bot and platform admin use service_role; no direct client write permitted.
