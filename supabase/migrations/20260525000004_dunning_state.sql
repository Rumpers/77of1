-- Dunning state machine — OF-168
-- Additive migration: safe rollback (no DROP, no NOT NULL without DEFAULT).

-- ============================================================
-- 1. dunning_state on fan_subscriptions
--    Default 'active' keeps existing rows unaffected.
-- ============================================================
alter table fan_subscriptions
  add column if not exists dunning_state text not null default 'active'
    check (dunning_state in ('active', 'grace', 'paused', 'cancelled', 'recovered')),
  add column if not exists dunning_attempt   int         not null default 0,
  add column if not exists dunning_retry_at  timestamptz;

create index if not exists fan_subscriptions_dunning_state_idx
  on fan_subscriptions (dunning_state)
  where dunning_state not in ('active', 'recovered');

-- ============================================================
-- 2. dunning_audit_log
--    Append-only audit trail for every state transition.
--    No UPDATE or DELETE policies — insert + select only.
-- ============================================================
create table if not exists dunning_audit_log (
  id              uuid        primary key default gen_random_uuid(),
  subscription_id uuid        not null references fan_subscriptions(id),
  fan_id          uuid        not null,
  creator_id      uuid        not null references creators(id),
  from_state      text        not null,
  to_state        text        not null,
  event_type      text        not null
    check (event_type in (
      'charge_failed',
      'dunning_grace',
      'dunning_paused',
      'dunning_cancelled',
      'dunning_recovered',
      'retry_enqueued'
    )),
  attempt         int         not null default 0,
  payload         jsonb       not null default '{}',
  created_at      timestamptz not null default now()
);

create index if not exists dunning_audit_log_subscription_idx
  on dunning_audit_log (subscription_id, created_at desc);
create index if not exists dunning_audit_log_creator_idx
  on dunning_audit_log (creator_id, created_at desc);

alter table dunning_audit_log enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'dunning_audit_log' and policyname = 'dunning_audit_select'
  ) then
    create policy dunning_audit_select on dunning_audit_log for select using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'dunning_audit_log' and policyname = 'dunning_audit_insert'
  ) then
    create policy dunning_audit_insert on dunning_audit_log for insert with check (true);
  end if;
end $$;

-- ============================================================
-- 3. feature_flags
--    Simple boolean flag store, keyed by flag name.
-- ============================================================
create table if not exists feature_flags (
  key        text        primary key,
  enabled    boolean     not null default false,
  payload    jsonb       not null default '{}',
  updated_at timestamptz not null default now()
);

-- Seed the dunning flag — disabled by default (safe rollout).
insert into feature_flags (key, enabled) values ('dunning_enabled', false)
  on conflict (key) do nothing;
