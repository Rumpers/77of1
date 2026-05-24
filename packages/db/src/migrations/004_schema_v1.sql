-- OF-56: complete schema v1
-- Adds creator_config, fan_accounts, creator_content_embeddings
-- Extends consent_grants with grant_type enum + consent_grant_version

-- Extended consent grant type enum (superset of legacy modality values)
create type if not exists consent_grant_type as enum (
  'persona_text',
  'voice',
  'image',
  'talking_video',
  'fullbody_video',
  'social_oauth'
);

-- Extend consent_grants: full grant type + which consent policy version was signed
alter table consent_grants
  add column if not exists grant_type       consent_grant_type,
  add column if not exists consent_grant_version int not null default 1;

-- creator_config: brand/monetization settings per creator
create table if not exists creator_config (
  creator_id         uuid primary key references creators(id) on delete cascade,
  handle             text not null,
  brand_color        text,
  font_weight        text,
  cover_image_url    text,
  monetization_model text not null default 'subscription'
                       check (monetization_model in ('subscription', 'pay_per_message', 'tiered', 'free')),
  languages_served   text[] not null default '{}',
  intensity_dial     text not null default 'warm'
                       check (intensity_dial in ('warm', 'intimate', 'explicit')),
  forbidden_topics   text[] not null default '{}',
  paused             boolean not null default false,
  persona_fields     jsonb not null default '{}',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table creator_config enable row level security;

create policy creator_row_isolation on creator_config
  using (creator_id = current_setting('app.current_creator_id', true)::uuid);

-- fan_accounts: one row per (fan, creator) pair; tracks trial/subscription state
create table if not exists fan_accounts (
  fan_id      uuid not null,
  creator_id  uuid not null references creators(id) on delete cascade,
  trial_count int not null default 0,
  created_at  timestamptz not null default now(),
  primary key (fan_id, creator_id)
);

create index on fan_accounts (creator_id);

alter table fan_accounts enable row level security;

create policy creator_row_isolation on fan_accounts
  using (creator_id = current_setting('app.current_creator_id', true)::uuid);

-- creator_content_embeddings: RAG source chunks with 1536-dim pgvector embeddings
-- Separate from creator_rag_entries (legacy); this is the canonical table for RAG
create table if not exists creator_content_embeddings (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid not null references creators(id) on delete cascade,
  chunk_text  text not null,
  embedding   vector(1536),
  source_type text not null,
  created_at  timestamptz not null default now()
);

create index on creator_content_embeddings (creator_id);
create index on creator_content_embeddings
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table creator_content_embeddings enable row level security;

create policy creator_row_isolation on creator_content_embeddings
  using (creator_id = current_setting('app.current_creator_id', true)::uuid);
