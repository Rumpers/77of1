-- HID-059: Asset upload content moderation
-- Adds moderation_status column to creator_assets and a dedicated audit log.
-- Retention: append-only, no delete policy — 12+ months per legal requirements.

-- Add moderation_status to existing creator_assets table.
-- Default 'pending' preserves backward compat for rows inserted before this migration.
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'creator_assets' and column_name = 'moderation_status'
  ) then
    alter table creator_assets
      add column moderation_status text not null default 'pending'
        check (moderation_status in ('pending', 'approved', 'rejected'));
  end if;
end $$;

-- Index for backoffice queries: find all rejected uploads per creator.
create index if not exists creator_assets_moderation_status_idx
  on creator_assets (creator_id, moderation_status, created_at desc);

-- ── asset_moderation_audit_log ─────────────────────────────────────────────
-- Records every moderation call (pass or block) for uploaded creator assets.
-- No raw file bytes stored — SHA-256 hash only.
-- fan_id is null for creator-side uploads (onboarding assets are creator-owned).
create table if not exists asset_moderation_audit_log (
  id                 uuid             primary key default gen_random_uuid(),
  created_at         timestamptz      not null default now(),
  creator_id         uuid             not null references creators(id),
  asset_id           uuid             references creator_assets(id),  -- null if rejected before insert
  asset_type         text             not null check (asset_type in ('photo', 'video', 'audio')),
  channel            text             not null default 'web'          -- 'web' | 'telegram'
                       check (channel in ('web', 'telegram')),
  provider           text             not null,                       -- 'gmi' | 'metadata_only'
  passed             boolean          not null,
  flagged_categories text[]           not null default '{}',
  confidence         double precision not null check (confidence >= 0 and confidence <= 1),
  latency_ms         integer          not null,
  file_sha256        text             not null                        -- SHA-256 of file bytes
);

-- Query patterns: by creator/time, by failure.
create index if not exists asset_moderation_audit_log_creator_created
  on asset_moderation_audit_log (creator_id, created_at desc);

create index if not exists asset_moderation_audit_log_blocked
  on asset_moderation_audit_log (created_at desc)
  where not passed;

-- Append-only RLS: service role can insert; reads are creator-scoped.
alter table asset_moderation_audit_log enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'asset_moderation_audit_log' and policyname = 'asset_mod_audit_select'
  ) then
    create policy asset_mod_audit_select on asset_moderation_audit_log
      for select
      using (creator_id = current_setting('app.current_creator_id', true)::uuid);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'asset_moderation_audit_log' and policyname = 'asset_mod_audit_insert'
  ) then
    create policy asset_mod_audit_insert on asset_moderation_audit_log
      for insert with check (true);
  end if;
end $$;
