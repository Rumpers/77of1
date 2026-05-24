-- ADR-011 Decision 3: usage counters per fan/creator/modality/window
-- RLS enforced; creator_id isolation matches 001_initial_schema.sql policy pattern

create table if not exists usage_counters (
  fan_id        uuid not null,
  creator_id    uuid not null,
  modality      text not null check (modality in ('text', 'voice', 'video', 'image')),
  window_start  timestamptz not null,
  window_size   text not null check (window_size in ('daily', 'weekly', 'monthly')),
  count         integer not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (fan_id, creator_id, modality, window_start, window_size)
);

create index on usage_counters (creator_id, modality, window_start);

alter table usage_counters enable row level security;

create policy creator_row_isolation on usage_counters
  using (creator_id = current_setting('app.current_creator_id', true)::uuid);
