-- 011_phase3_voice_dsar_ocr.sql
-- Phase 3: Voice Hardening — schema additions (OFA-16 / plan 03-02)
-- 1. retention_category enum value: ephemeral_30d (MOD-07 non-flagged snapshots)
-- 2. safety_audit_log.category_scores (nullable jsonb — MOD-07 OpenAI scores)
-- 3. fan_name_masks table (ONBOARD-04 mask review queue)
-- 4. creator_deletion_log table (COMPLY-04 DSAR audit trail)

-- Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction block in some
-- Postgres versions. Apply this statement first if the migration runner wraps DDL
-- in a transaction (Supabase CLI does; split into a separate migration if needed).
ALTER TYPE retention_category ADD VALUE IF NOT EXISTS 'ephemeral_30d';

-- Add nullable category_scores column to safety_audit_log.
-- NULL for existing rows (back-compat with pre-Phase-3 MOD writes).
ALTER TABLE safety_audit_log
  ADD COLUMN IF NOT EXISTS category_scores jsonb;

-- fan_name_masks: OCR-extracted candidate fan names awaiting human review (ONBOARD-04).
-- Partial index on (reviewed, created_at) WHERE reviewed=false keeps queue scans O(pending).
CREATE TABLE IF NOT EXISTS fan_name_masks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id   UUID        NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  handle       TEXT        NOT NULL,
  candidate    TEXT        NOT NULL,
  source       TEXT,                     -- 'ocr-image' | 'ocr-pdf' | 'manual' | NULL
  reviewed     BOOLEAN     NOT NULL DEFAULT FALSE,
  approved     BOOLEAN,                  -- NULL until reviewed
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fan_name_masks_pending_idx
  ON fan_name_masks (reviewed, created_at)
  WHERE reviewed = FALSE;

-- creator_deletion_log: immutable DSAR deletion audit trail (COMPLY-04).
-- NO FK to creators — creator row is anonymized in-place, not deleted.
-- A cascade would destroy the audit record (Pitfall 4).
CREATE TABLE IF NOT EXISTS creator_deletion_log (
  audit_id          TEXT        PRIMARY KEY,   -- sha256(creatorId.requestedAt).slice(0,16)
  creator_id_hash   TEXT        NOT NULL,      -- sha256(creatorId) — never plaintext
  requested_at      TIMESTAMPTZ NOT NULL,
  completed_at      TIMESTAMPTZ,
  sweep_latency_ms  INTEGER,                   -- SLA tracking: ms from requested_at to completed_at
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS creator_deletion_log_completed_at_idx
  ON creator_deletion_log (completed_at);
