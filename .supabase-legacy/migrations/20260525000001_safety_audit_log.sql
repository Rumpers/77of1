-- Safety audit log table for crisis intervention pipeline (OF-132/OF-161)
-- No raw message text stored — hashes only, per ADR privacy requirements.

create table if not exists safety_audit_log (
  id             uuid        primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  creator_id     uuid        not null references creators(id),
  fan_id_hash    text        not null,  -- SHA-256 of fan_id, not the UUID itself
  session_id     text        not null,
  message_hash   text        not null,  -- SHA-256 of message text
  crisis_level   text        not null check (crisis_level in ('none', 'low', 'medium', 'high')),
  crisis_type    text,
  locale         text        not null default 'en',
  confidence     float,
  response_sent  boolean     not null default false,
  twin_paused    boolean     not null default false,
  alerted        boolean     not null default false
);

-- Indexes for monitoring queries
create index if not exists safety_audit_log_created_at_idx
  on safety_audit_log (created_at desc);

create index if not exists safety_audit_log_creator_created_idx
  on safety_audit_log (creator_id, created_at desc);

create index if not exists safety_audit_log_crisis_level_created_idx
  on safety_audit_log (crisis_level, created_at desc);

-- RLS: append-only, creator-scoped reads
alter table safety_audit_log enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'safety_audit_log' and policyname = 'safety_audit_log_select'
  ) then
    create policy safety_audit_log_select on safety_audit_log
      for select
      using (creator_id = current_setting('app.current_creator_id', true)::uuid);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'safety_audit_log' and policyname = 'safety_audit_log_insert'
  ) then
    create policy safety_audit_log_insert on safety_audit_log
      for insert with check (true);
  end if;
end $$;

-- Metrics view: daily volume by crisis_level and locale
create or replace view safety_audit_daily_volume as
  select
    date_trunc('day', created_at) as day,
    crisis_level,
    locale,
    count(*)::int                 as event_count
  from safety_audit_log
  group by 1, 2, 3
  order by 1 desc, 2, 3;
