-- HID-069: OAuth token storage + refresh
-- Stores AES-256-GCM encrypted OAuth tokens for external platform integrations.
-- Initial platforms: 17live (creator payout/stream data), line (LINE Pay relay).
-- Encryption is applied at the application layer; DB stores opaque ciphertext.

create table if not exists creator_oauth_tokens (
  id                  uuid        primary key default gen_random_uuid(),
  creator_id          uuid        not null references creators(id) on delete cascade,
  platform            text        not null check (platform in ('17live', 'line', 'youtube')),

  -- Encrypted token storage (format: iv_hex:tag_hex:ciphertext_hex)
  access_token_enc    text        not null,
  refresh_token_enc   text,
  token_type          text        not null default 'Bearer',

  -- Token lifecycle
  expires_at          timestamptz,
  scope               text,

  -- External identity linkage
  platform_user_id    text,
  platform_username   text,

  -- Refresh health tracking
  last_refreshed_at   timestamptz,
  refresh_fail_count  int         not null default 0,
  refresh_failed_at   timestamptz,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (creator_id, platform)
);

-- Primary access pattern: creator + platform lookup
create index if not exists creator_oauth_tokens_creator_platform_idx
  on creator_oauth_tokens (creator_id, platform);

-- Proactive refresh worker: find tokens expiring in the next 10 minutes
create index if not exists creator_oauth_tokens_expires_soon_idx
  on creator_oauth_tokens (expires_at)
  where expires_at is not null and refresh_fail_count < 3;

-- RLS: creators can only see their own token rows (status only — no token values)
alter table creator_oauth_tokens enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'creator_oauth_tokens'
    and policyname = 'creator_row_isolation'
  ) then
    create policy creator_row_isolation on creator_oauth_tokens
      using (creator_id = current_setting('app.current_creator_id', true)::uuid);
  end if;
end $$;

-- updated_at trigger
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'creator_oauth_tokens_updated_at'
  ) then
    create trigger creator_oauth_tokens_updated_at
      before update on creator_oauth_tokens
      for each row execute function set_updated_at();
  end if;
end $$;
