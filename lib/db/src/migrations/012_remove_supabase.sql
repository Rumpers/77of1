-- OFA-49: Remove Supabase column names from fans and sessions tables.
-- Renames supabase_* columns to generic names; drops supabase_uid from fans.
-- Safe to re-run (column_exists checks).

DO $$
BEGIN
  -- sessions: rename supabase_access_token → access_token
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'supabase_access_token'
  ) THEN
    ALTER TABLE sessions RENAME COLUMN supabase_access_token TO access_token;
  END IF;

  -- sessions: rename supabase_refresh_token → refresh_token
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'supabase_refresh_token'
  ) THEN
    ALTER TABLE sessions RENAME COLUMN supabase_refresh_token TO refresh_token;
  END IF;

  -- fans: drop supabase_uid (unused since OTP auth replaced Supabase auth)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fans' AND column_name = 'supabase_uid'
  ) THEN
    ALTER TABLE fans DROP COLUMN supabase_uid;
  END IF;
END $$;
