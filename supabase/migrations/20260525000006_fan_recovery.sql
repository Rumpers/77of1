-- OF-172: Fan account recovery — backup contacts + recovery requests (§22.4)
--
-- 1. Adds backup_email / backup_phone to fan_accounts for recovery lookup.
-- 2. Adds fan_recovery_requests to track recovery attempts, id-doc uploads,
--    fraud holds, and audit trail.

-- ── 1. Backup contacts on fan_accounts ───────────────────────────────────────

ALTER TABLE fan_accounts
  ADD COLUMN IF NOT EXISTS backup_email TEXT,
  ADD COLUMN IF NOT EXISTS backup_phone TEXT;

CREATE INDEX IF NOT EXISTS fan_accounts_backup_email_idx
  ON fan_accounts (backup_email)
  WHERE backup_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS fan_accounts_backup_phone_idx
  ON fan_accounts (backup_phone)
  WHERE backup_phone IS NOT NULL;

-- ── 2. Fan recovery requests ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fan_recovery_requests (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id            UUID          NOT NULL,
  creator_id        UUID          NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  method            TEXT          NOT NULL
                                  CHECK (method IN ('backup_email', 'backup_phone', 'id_attestation')),
  status            TEXT          NOT NULL DEFAULT 'initiated'
                                  CHECK (status IN (
                                    'initiated', 'otp_sent', 'otp_failed',
                                    'manual_review', 'completed', 'rejected'
                                  )),
  contact_used      TEXT,
  -- ID attestation fields
  id_doc_path       TEXT,
  id_doc_expires_at TIMESTAMPTZ,
  full_name         TEXT,
  dob               TEXT,
  -- Fraud flag
  fraud_hold        BOOLEAN       NOT NULL DEFAULT false,
  -- Request metadata
  ip_address        TEXT,
  user_agent        TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fan_recovery_fan_id_idx
  ON fan_recovery_requests (fan_id);

CREATE INDEX IF NOT EXISTS fan_recovery_creator_id_idx
  ON fan_recovery_requests (creator_id);

-- Drives the 30-day cleanup cron: only rows with an uploaded doc
CREATE INDEX IF NOT EXISTS fan_recovery_id_doc_expires_idx
  ON fan_recovery_requests (id_doc_expires_at)
  WHERE id_doc_path IS NOT NULL;

-- Fraud-pattern query: recent requests per fan (no doc needed, covers all methods)
CREATE INDEX IF NOT EXISTS fan_recovery_fan_created_idx
  ON fan_recovery_requests (fan_id, created_at DESC);

-- Service-role only; no direct fan access to their own recovery records
ALTER TABLE fan_recovery_requests ENABLE ROW LEVEL SECURITY;
