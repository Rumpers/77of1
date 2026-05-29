-- HID-005: Session Management
-- https://github.com/Rumpers/77of1
--
-- Tracks authenticated sessions per Replit user with device/IP/UA metadata.
-- Enables "active sessions" visibility and "log out everywhere" revocation.
-- Revocation propagates on the next protected API request (<60s).

-- ── 1. user_sessions ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_sessions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  replit_user_id  TEXT        NOT NULL,
  -- SHA-256 hex of the session token (never store the raw token)
  token_hash      TEXT        NOT NULL UNIQUE,
  -- ms timestamp extracted from the signed token payload
  created_at_ms   BIGINT      NOT NULL,
  device_hint     TEXT        NOT NULL DEFAULT 'unknown'
                              CHECK (device_hint IN ('mobile', 'desktop', 'bot', 'unknown')),
  ip_address      TEXT,
  user_agent      TEXT,
  last_active_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- List sessions for a user, newest first
CREATE INDEX IF NOT EXISTS user_sessions_user_active_idx
  ON user_sessions (replit_user_id, last_active_at DESC)
  WHERE revoked_at IS NULL;

-- Revocation propagation lookup (keyed by hash — called on every protected req)
CREATE INDEX IF NOT EXISTS user_sessions_token_hash_idx
  ON user_sessions (token_hash)
  WHERE revoked_at IS NULL;

-- Service-role only: fans/creators should not read each other's sessions
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- ── 2. Audit log entry on session creation ────────────────────────────────────
-- Handled at the application layer via the existing audit_log table;
-- no extra table needed here.

-- ── 3. Verify migration ───────────────────────────────────────────────────────
DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'user_sessions'
  ), 'user_sessions table must exist';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_sessions' AND column_name = 'token_hash'
  ), 'user_sessions.token_hash column must exist';

  RAISE NOTICE 'HID-005 migration: user_sessions created OK';
END $$;
