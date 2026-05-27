-- OF-100: Supabase Auth — creator + fan flows
-- Adds auth_user_id columns linking Supabase auth.users to internal records.
-- Nullable: existing rows are unlinked until creator/fan completes Supabase auth.

ALTER TABLE creators
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS email TEXT;

CREATE INDEX IF NOT EXISTS creators_auth_user_idx
  ON creators (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

ALTER TABLE fan_accounts
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS fan_accounts_auth_user_creator_idx
  ON fan_accounts (auth_user_id, creator_id)
  WHERE auth_user_id IS NOT NULL;

-- RLS policy: creators can see their own row via auth.uid()
-- (replaces app.current_creator_id setting for auth-bearing requests)
CREATE POLICY IF NOT EXISTS creators_auth_uid ON creators
  FOR SELECT USING (auth_user_id = auth.uid());

-- fan_accounts: fans see only their own rows
CREATE POLICY IF NOT EXISTS fan_accounts_auth_uid ON fan_accounts
  FOR SELECT USING (auth_user_id = auth.uid());
