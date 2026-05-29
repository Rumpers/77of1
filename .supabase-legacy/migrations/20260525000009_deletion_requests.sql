-- [HID-013] Data-deletion verification tooling — OF-227
-- §8.4: one-click deletion on request. §16: cascade complete within 72h of grace expiry.
--
-- deletion_requests: one row per account-deletion lifecycle.
-- Populated by the HID-006 deletion UX when a user confirms deletion intent.
-- The 7-day grace window starts at requested_at; SLA clock starts when grace expires.
-- Staff use the admin verification module to confirm each cascade completed on time.

CREATE TABLE IF NOT EXISTS deletion_requests (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- auth_user_id from Supabase Auth — links to the deleted account
  auth_user_id           TEXT        NOT NULL,
  account_type           TEXT        NOT NULL CHECK (account_type IN ('fan', 'creator')),
  -- JSON list of entity UUIDs that must be purged (creator_id or fan_ids).
  -- Stored so verification can query even after the auth user is gone.
  entity_ids             JSONB       NOT NULL DEFAULT '[]',

  -- Lifecycle status
  status                 TEXT        NOT NULL DEFAULT 'grace_pending'
                           CHECK (status IN (
                             'grace_pending',   -- within 7-day grace window; can be cancelled
                             'processing',      -- grace expired; cascade running
                             'complete',        -- cascade finished; all data purged
                             'failed',          -- cascade job errored
                             'timeout',         -- SLA breached (>72h past sla_deadline_at)
                             'cancelled'        -- user cancelled within grace window
                           )),

  -- Timeline
  requested_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  grace_period_expires_at TIMESTAMPTZ NOT NULL
                           GENERATED ALWAYS AS (requested_at + INTERVAL '7 days') STORED,
  sla_deadline_at        TIMESTAMPTZ NOT NULL
                           GENERATED ALWAYS AS (requested_at + INTERVAL '7 days' + INTERVAL '72 hours') STORED,
  cascade_started_at     TIMESTAMPTZ,
  cascade_complete_at    TIMESTAMPTZ,

  -- User-facing reference code (shown in account_deletion_complete email)
  deletion_reference     TEXT        UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),

  -- Verification result written by staff via admin panel (HID-013)
  verification_result    JSONB,
  verified_by            TEXT,   -- staff user id (UUID string)
  verified_at            TIMESTAMPTZ,

  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lookup by auth_user_id for the deletion UX (check pending requests)
CREATE INDEX IF NOT EXISTS deletion_requests_auth_user_idx
  ON deletion_requests (auth_user_id, requested_at DESC);

-- Admin view: find requests approaching or past SLA deadline
CREATE INDEX IF NOT EXISTS deletion_requests_sla_idx
  ON deletion_requests (sla_deadline_at, status)
  WHERE status IN ('grace_pending', 'processing');

-- Admin view: unverified completions
CREATE INDEX IF NOT EXISTS deletion_requests_unverified_idx
  ON deletion_requests (cascade_complete_at)
  WHERE status = 'complete' AND verified_at IS NULL;

-- RLS: append-only for normal app users; service role bypasses RLS.
-- Staff read via service role in the admin panel.
ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'deletion_requests' AND policyname = 'deletion_requests_user_select'
  ) THEN
    CREATE POLICY deletion_requests_user_select ON deletion_requests
      FOR SELECT USING (auth_user_id = auth.uid()::TEXT);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'deletion_requests' AND policyname = 'deletion_requests_user_insert'
  ) THEN
    CREATE POLICY deletion_requests_user_insert ON deletion_requests
      FOR INSERT WITH CHECK (auth_user_id = auth.uid()::TEXT);
  END IF;
END $$;
