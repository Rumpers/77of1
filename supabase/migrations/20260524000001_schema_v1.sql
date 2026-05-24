-- 7of1 Platform v1 — canonical Supabase schema
-- All 10 core tables. Idempotent: uses IF NOT EXISTS and DO-block policy guards.
-- Run via: supabase db reset

-- Extensions
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. creators
--    Creator accounts with inline config JSONB + auth linkage
-- ============================================================
create table if not exists creators (
  id             uuid        primary key default gen_random_uuid(),
  handle         text        not null unique,
  display_name   text        not null,
  config         jsonb       not null default '{}',
  replit_user_id text        unique,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists creators_replit_user_id_idx
  on creators (replit_user_id)
  where replit_user_id is not null;

alter table creators enable row level security;

-- ============================================================
-- 2. fans
--    Per-creator fan accounts with locale, tier, age gate
-- ============================================================
create table if not exists fans (
  id             uuid        primary key default gen_random_uuid(),
  creator_id     uuid        not null references creators(id) on delete cascade,
  replit_user_id text,
  locale         text        not null default 'en',
  tier           text        not null default 'free'
                               check (tier in ('free', 'trial', 'subscriber', 'credit')),
  age_verified   boolean     not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists fans_creator_id_idx on fans (creator_id);
create unique index if not exists fans_replit_creator_uidx
  on fans (replit_user_id, creator_id)
  where replit_user_id is not null;

alter table fans enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'fans' and policyname = 'creator_row_isolation'
  ) then
    create policy creator_row_isolation on fans
      using (creator_id = current_setting('app.current_creator_id', true)::uuid);
  end if;
end $$;

-- ============================================================
-- 3. consent_grants
--    Per-creator per-modality consent with version tracking
-- ============================================================
create table if not exists consent_grants (
  id         uuid        primary key default gen_random_uuid(),
  creator_id uuid        not null references creators(id) on delete cascade,
  modality   text        not null check (modality in ('text', 'voice', 'video', 'image')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  version    int         not null default 1,
  unique (creator_id, modality, version)
);

create index if not exists consent_grants_creator_id_idx
  on consent_grants (creator_id);
create index if not exists consent_grants_active_idx
  on consent_grants (creator_id, modality)
  where revoked_at is null;

alter table consent_grants enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'consent_grants' and policyname = 'creator_row_isolation'
  ) then
    create policy creator_row_isolation on consent_grants
      using (creator_id = current_setting('app.current_creator_id', true)::uuid);
  end if;
end $$;

-- ============================================================
-- 4. generation_jobs
--    Async job tracking for text/voice/video/image/moderation.
--    bullmq_job_id enables BullMQ cancellation.
--    consent_grant_id enables fast revocation queries.
-- ============================================================
create table if not exists generation_jobs (
  id                    uuid        primary key default gen_random_uuid(),
  creator_id            uuid        not null references creators(id),
  fan_id                uuid        not null references fans(id),
  consent_grant_id      uuid        not null references consent_grants(id),
  bullmq_job_id         text,
  modality              text        not null
                          check (modality in ('text', 'voice', 'video', 'image', 'moderation')),
  status                text        not null default 'queued'
                          check (status in ('queued', 'processing', 'done', 'failed', 'cancelled')),
  attempt_count         int         not null default 0,
  consent_grant_version int         not null default 1,
  result_url            text,
  error_message         text,
  created_at            timestamptz not null default now(),
  completed_at          timestamptz
);

create index if not exists generation_jobs_creator_id_idx
  on generation_jobs (creator_id);
-- Composite index for revocation queries: find all active jobs for a revoked consent
create index if not exists generation_jobs_revocation_idx
  on generation_jobs (creator_id, consent_grant_id, status);
create index if not exists generation_jobs_fan_id_idx
  on generation_jobs (fan_id);

alter table generation_jobs enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'generation_jobs' and policyname = 'creator_row_isolation'
  ) then
    create policy creator_row_isolation on generation_jobs
      using (creator_id = current_setting('app.current_creator_id', true)::uuid);
  end if;
end $$;

-- ============================================================
-- 5. creator_assets
--    Uploaded photos/videos/audio with consent tracking
-- ============================================================
create table if not exists creator_assets (
  id             uuid        primary key default gen_random_uuid(),
  creator_id     uuid        not null references creators(id) on delete cascade,
  asset_type     text        not null check (asset_type in ('photo', 'video', 'audio')),
  storage_path   text        not null,
  consent_status text        not null default 'pending'
                               check (consent_status in ('pending', 'granted', 'revoked')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists creator_assets_creator_id_idx on creator_assets (creator_id);

alter table creator_assets enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'creator_assets' and policyname = 'creator_row_isolation'
  ) then
    create policy creator_row_isolation on creator_assets
      using (creator_id = current_setting('app.current_creator_id', true)::uuid);
  end if;
end $$;

-- ============================================================
-- 6. usage_counters
--    Per fan+creator per billing period (messages, credits,
--    voice seconds, video seconds)
-- ============================================================
create table if not exists usage_counters (
  fan_id         uuid        not null,
  creator_id     uuid        not null references creators(id),
  billing_period text        not null,  -- 'YYYY-MM' e.g. '2026-05'
  messages       int         not null default 0,
  credits_used   int         not null default 0,
  voice_seconds  int         not null default 0,
  video_seconds  int         not null default 0,
  updated_at     timestamptz not null default now(),
  primary key (fan_id, creator_id, billing_period)
);

create index if not exists usage_counters_creator_id_idx on usage_counters (creator_id);

alter table usage_counters enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'usage_counters' and policyname = 'creator_row_isolation'
  ) then
    create policy creator_row_isolation on usage_counters
      using (creator_id = current_setting('app.current_creator_id', true)::uuid);
  end if;
end $$;

-- ============================================================
-- 7. fan_subscriptions
--    Stripe subscription tracking per fan+creator
-- ============================================================
create table if not exists fan_subscriptions (
  id                     uuid        primary key default gen_random_uuid(),
  fan_id                 uuid        not null,
  creator_id             uuid        not null references creators(id),
  stripe_subscription_id text        not null unique,
  stripe_customer_id     text        not null,
  status                 text        not null
                           check (status in ('active', 'past_due', 'cancelled', 'trialing')),
  current_period_start   timestamptz not null,
  current_period_end     timestamptz not null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists fan_subscriptions_creator_id_idx on fan_subscriptions (creator_id);
create index if not exists fan_subscriptions_fan_creator_idx on fan_subscriptions (fan_id, creator_id);

alter table fan_subscriptions enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'fan_subscriptions' and policyname = 'creator_row_isolation'
  ) then
    create policy creator_row_isolation on fan_subscriptions
      using (creator_id = current_setting('app.current_creator_id', true)::uuid);
  end if;
end $$;

-- ============================================================
-- 8. fan_credits
--    Per fan+creator credit balance
-- ============================================================
create table if not exists fan_credits (
  fan_id     uuid        not null,
  creator_id uuid        not null references creators(id),
  balance    int         not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now(),
  primary key (fan_id, creator_id)
);

create index if not exists fan_credits_creator_id_idx on fan_credits (creator_id);

alter table fan_credits enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'fan_credits' and policyname = 'creator_row_isolation'
  ) then
    create policy creator_row_isolation on fan_credits
      using (creator_id = current_setting('app.current_creator_id', true)::uuid);
  end if;
end $$;

-- ============================================================
-- 9. credit_transactions
--    Credit topup/spend/refund ledger
-- ============================================================
create table if not exists credit_transactions (
  id              uuid        primary key default gen_random_uuid(),
  fan_id          uuid        not null,
  creator_id      uuid        not null references creators(id),
  kind            text        not null check (kind in ('topup', 'spend', 'refund')),
  amount          int         not null,
  stripe_event_id text,
  idempotency_key text        unique,
  created_at      timestamptz not null default now()
);

create index if not exists credit_transactions_creator_id_idx on credit_transactions (creator_id);
create index if not exists credit_transactions_fan_creator_idx on credit_transactions (fan_id, creator_id);

alter table credit_transactions enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'credit_transactions' and policyname = 'creator_row_isolation'
  ) then
    create policy creator_row_isolation on credit_transactions
      using (creator_id = current_setting('app.current_creator_id', true)::uuid);
  end if;
end $$;

-- ============================================================
-- 10. audit_log
--     Immutable event log: consent events, kill switch,
--     moderation flags, revocations.
--     Append-only enforced via RLS — no UPDATE or DELETE policy.
-- ============================================================
create table if not exists audit_log (
  id         uuid        primary key default gen_random_uuid(),
  creator_id uuid        references creators(id),
  fan_id     uuid,
  event_type text        not null,
  payload    jsonb       not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists audit_log_creator_id_idx on audit_log (creator_id);
create index if not exists audit_log_event_type_idx on audit_log (event_type, created_at desc);

alter table audit_log enable row level security;

-- Append-only: SELECT and INSERT allowed; no UPDATE or DELETE policy (denied by default).
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'audit_log' and policyname = 'audit_log_select'
  ) then
    create policy audit_log_select on audit_log for select using (true);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'audit_log' and policyname = 'audit_log_insert'
  ) then
    create policy audit_log_insert on audit_log for insert with check (true);
  end if;
end $$;
