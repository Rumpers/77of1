-- OF-58: Add Replit Auth user ID mapping columns
-- Maps Replit Auth identities (from x-replit-user-id header) to internal UUIDs.
-- Nullable: existing rows are unlinked until creator/fan completes onboarding auth.

alter table creators
  add column if not exists replit_user_id text unique;

alter table fan_accounts
  add column if not exists replit_user_id text;

create unique index if not exists fan_accounts_replit_creator_uidx
  on fan_accounts (replit_user_id, creator_id)
  where replit_user_id is not null;
