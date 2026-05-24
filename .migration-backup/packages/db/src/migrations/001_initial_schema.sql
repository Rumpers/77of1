-- 7of1 initial schema
-- All tables include creator_id for RLS multi-tenancy
-- RLS enforced at DB layer per ADR-002

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- Creators
create table if not exists creators (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id text unique,
  display_name text not null,
  created_at timestamptz not null default now()
);

-- Creator personas (the 7-field twin config)
create table if not exists creator_personas (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  greeting_style text not null default '',
  fan_endearment text not null default '',
  emoji_usage text not null default 'minimal',
  bounds text[] not null default '{}',
  treatment_style text not null default '',
  personality_traits text[] not null default '{}',
  message_style text not null default '',
  intensity_dial text not null default 'warm' check (intensity_dial in ('warm', 'intimate', 'explicit')),
  updated_at timestamptz not null default now(),
  unique (creator_id)
);

-- Consent grants — one per modality per creator
create table if not exists consent_grants (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  modality text not null check (modality in ('text', 'voice', 'video', 'image')),
  version int not null default 1,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (creator_id, modality, version)
);

create index on consent_grants (creator_id, modality) where revoked_at is null;

-- Fan sessions
create table if not exists fan_sessions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

create index on fan_sessions (creator_id);

-- Generation jobs
create table if not exists generation_jobs (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id),
  fan_session_id uuid not null references fan_sessions(id),
  consent_grant_id uuid not null references consent_grants(id),
  modality text not null check (modality in ('text', 'voice', 'video', 'image')),
  status text not null default 'queued' check (status in ('queued', 'processing', 'done', 'failed', 'cancelled')),
  result_url text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index on generation_jobs (creator_id, status);
create index on generation_jobs (consent_grant_id);

-- Creator RAG index entries (per-creator, pgvector)
create table if not exists creator_rag_entries (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  content text not null,
  embedding vector(1536),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index on creator_rag_entries using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Row Level Security
alter table creators enable row level security;
alter table creator_personas enable row level security;
alter table consent_grants enable row level security;
alter table fan_sessions enable row level security;
alter table generation_jobs enable row level security;
alter table creator_rag_entries enable row level security;

-- RLS policies: creator_id isolation
create policy creator_row_isolation on creator_personas
  using (creator_id = current_setting('app.current_creator_id', true)::uuid);

create policy creator_row_isolation on consent_grants
  using (creator_id = current_setting('app.current_creator_id', true)::uuid);

create policy creator_row_isolation on fan_sessions
  using (creator_id = current_setting('app.current_creator_id', true)::uuid);

create policy creator_row_isolation on generation_jobs
  using (creator_id = current_setting('app.current_creator_id', true)::uuid);

create policy creator_row_isolation on creator_rag_entries
  using (creator_id = current_setting('app.current_creator_id', true)::uuid);
