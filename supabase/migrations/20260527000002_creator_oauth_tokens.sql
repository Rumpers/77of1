-- HID-069: OAuth token storage + refresh
-- Stores provider OAuth tokens (Stripe Connect, LINE Pay, 17live) per creator.
-- access_token and refresh_token are AES-256-GCM encrypted at the application layer
-- before insertion; the columns store the cipher text as hex-encoded strings.

create table if not exists creator_oauth_tokens (
  id              uuid        primary key default gen_random_uuid(),
  creator_id      uuid        not null references creators(id) on delete cascade,
  provider        text        not null check (provider in ('stripe_connect', 'line_pay', '17live')),
  -- encrypted cipher texts (AES-256-GCM, app-layer encryption via OAUTH_TOKEN_ENCRYPTION_KEY)
  access_token    text        not null,
  refresh_token   text,
  token_type      text        not null default 'Bearer',
  scope           text,
  expires_at      timestamptz,
  -- provider-specific identifiers kept in plaintext for lookups
  provider_user_id text,
  raw_metadata    jsonb       not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (creator_id, provider)
);

create index if not exists creator_oauth_tokens_creator_idx
  on creator_oauth_tokens (creator_id);

create index if not exists creator_oauth_tokens_expires_idx
  on creator_oauth_tokens (expires_at)
  where expires_at is not null;

alter table creator_oauth_tokens enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'creator_oauth_tokens'
      and policyname = 'creator_self_select'
  ) then
    create policy creator_self_select on creator_oauth_tokens
      for select
      using (creator_id = nullif(current_setting('app.current_creator_id', true), '')::uuid);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'creator_oauth_tokens'
      and policyname = 'service_role_all'
  ) then
    create policy service_role_all on creator_oauth_tokens
      using (true)
      with check (true);
  end if;
end $$;

-- updated_at trigger
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger creator_oauth_tokens_updated_at
  before update on creator_oauth_tokens
  for each row execute function touch_updated_at();
