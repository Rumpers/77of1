-- Content version history (OF-165 / OF-150)
-- Append-only immutable version tracking per asset.

-- ============================================================
-- 1. content_versions
--    Immutable snapshot per asset edit. Append-only.
-- ============================================================
create table if not exists content_versions (
  id             uuid        primary key default gen_random_uuid(),
  asset_id       uuid        not null references creator_assets(id) on delete cascade,
  version_num    integer     not null,
  content_hash   text        not null,   -- SHA-256 of body/media
  body_snapshot  jsonb       not null,   -- immutable snapshot of text/media refs
  created_by     uuid        references creators(id),
  created_at     timestamptz not null default now(),
  unique (asset_id, version_num)
);

create index if not exists content_versions_asset_id_idx
  on content_versions (asset_id, version_num);

alter table content_versions enable row level security;

-- Append-only: SELECT and INSERT only. No UPDATE or DELETE.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'content_versions' and policyname = 'content_versions_select'
  ) then
    create policy content_versions_select on content_versions
      for select
      using (
        exists (
          select 1 from creator_assets a
          where a.id = content_versions.asset_id
            and a.creator_id = current_setting('app.current_creator_id', true)::uuid
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'content_versions' and policyname = 'content_versions_insert'
  ) then
    create policy content_versions_insert on content_versions
      for insert
      with check (
        exists (
          select 1 from creator_assets a
          where a.id = content_versions.asset_id
            and a.creator_id = current_setting('app.current_creator_id', true)::uuid
        )
      );
  end if;
end $$;

-- ============================================================
-- 2. content_approvals
--    Approval records per asset version.
-- ============================================================
create table if not exists content_approvals (
  id                  uuid        primary key default gen_random_uuid(),
  asset_id            uuid        not null references creator_assets(id) on delete cascade,
  approved_version_id uuid        references content_versions(id),
  status              text        not null default 'pending'
                        check (status in ('pending', 'approved', 'rejected')),
  reviewer_id         uuid        references creators(id),
  requested_by        uuid        references creators(id),
  decided_at          timestamptz,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists content_approvals_asset_id_idx
  on content_approvals (asset_id, created_at desc);
create index if not exists content_approvals_version_id_idx
  on content_approvals (approved_version_id);

alter table content_approvals enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'content_approvals' and policyname = 'creator_row_isolation'
  ) then
    create policy creator_row_isolation on content_approvals
      using (
        exists (
          select 1 from creator_assets a
          where a.id = content_approvals.asset_id
            and a.creator_id = current_setting('app.current_creator_id', true)::uuid
        )
      );
  end if;
end $$;

-- ============================================================
-- 3. posted_content
--    Published posts linked to a specific approved version.
-- ============================================================
create table if not exists posted_content (
  id                 uuid        primary key default gen_random_uuid(),
  asset_id           uuid        not null references creator_assets(id) on delete cascade,
  posted_version_id  uuid        references content_versions(id),
  approval_id        uuid        references content_approvals(id),
  platform           text        not null default 'unknown',
  posted_at          timestamptz not null default now(),
  posted_by          uuid        references creators(id),
  created_at         timestamptz not null default now()
);

create index if not exists posted_content_asset_id_idx
  on posted_content (asset_id, posted_at desc);
create index if not exists posted_content_version_id_idx
  on posted_content (posted_version_id);

alter table posted_content enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'posted_content' and policyname = 'creator_row_isolation'
  ) then
    create policy creator_row_isolation on posted_content
      using (
        exists (
          select 1 from creator_assets a
          where a.id = posted_content.asset_id
            and a.creator_id = current_setting('app.current_creator_id', true)::uuid
        )
      );
  end if;
end $$;
