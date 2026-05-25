-- 009_creator_recovery.sql
-- [HID-003-A] Creator account recovery: creator_recovery_requests + lockout_audit_log
-- Parent: OF-116 (Creator account recovery without Telegram)
-- CTO-approved (OF-175). Do not modify without CTO sign-off.
-- Ref: OF-116#document-plan §1, §3, §5

-- Requires pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- creators stub (FK anchor for the two new tables below).
-- In production (Supabase) this table already exists with the full schema.
-- On a clean staging DB this ensures FK constraints resolve correctly.
CREATE TABLE IF NOT EXISTS creators (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id TEXT        UNIQUE,
  display_name     TEXT        NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- §1 — Recovery contact columns on creators (onboarding data capture).
-- Verified OTP timestamps are set only after successful OTP round-trip.
-- identity_sig_hash is SHA-256(legal name || dob) — never stored in plaintext.
ALTER TABLE creators ADD COLUMN IF NOT EXISTS recovery_email                TEXT;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS recovery_email_verified_at    TIMESTAMPTZ;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS recovery_phone                TEXT;  -- E.164 format
ALTER TABLE creators ADD COLUMN IF NOT EXISTS recovery_phone_verified_at    TIMESTAMPTZ;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS identity_sig_hash             TEXT;  -- SHA-256, never plaintext

-- §3 — creator_recovery_requests: one row per recovery session.
-- Tracks the full lifecycle: OTP issuance → verification → magic-link → relink.
-- creator_id is nullable: set after the recovery contact matches a known creator.
CREATE TABLE IF NOT EXISTS creator_recovery_requests (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id            UUID        REFERENCES creators(id) ON DELETE SET NULL,
  status                TEXT        NOT NULL DEFAULT 'initiated'
                          CHECK (status IN (
                            'initiated', 'otp_sent', 'otp_verified', 'otp_failed',
                            'manual_review', 'completed', 'rejected'
                          )),
  recovery_method       TEXT        NOT NULL
                          CHECK (recovery_method IN ('email', 'phone')),
  contact_used          TEXT        NOT NULL,
  otp_hash              TEXT,                     -- bcrypt or SHA-256 of raw OTP; never plaintext
  otp_attempts          INT         NOT NULL DEFAULT 0,
  otp_verified_at       TIMESTAMPTZ,
  magic_link_token_hash TEXT,                     -- SHA-256 of JWT; never plaintext
  magic_link_expires_at TIMESTAMPTZ,
  ip_address            TEXT,
  user_agent            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS creator_recovery_requests_creator_id_idx
  ON creator_recovery_requests (creator_id);
CREATE INDEX IF NOT EXISTS creator_recovery_requests_status_idx
  ON creator_recovery_requests (status);
-- Index supports lookup by contact during OTP verification
CREATE INDEX IF NOT EXISTS creator_recovery_requests_contact_method_idx
  ON creator_recovery_requests (recovery_method, contact_used);

-- §5 — lockout_audit_log: append-only audit trail for every recovery event.
-- Maps to creator_recovery_events in OF-116#document-plan.
-- Immutable: no UPDATE or DELETE policies should be applied to this table.
CREATE TABLE IF NOT EXISTS lockout_audit_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id   UUID        NOT NULL REFERENCES creators(id),
  request_id   UUID        REFERENCES creator_recovery_requests(id) ON DELETE SET NULL,
  event_type   TEXT        NOT NULL
                 CHECK (event_type IN (
                   'initiated', 'otp_sent', 'otp_verified', 'otp_failed',
                   'manual_review', 'relinked', 'rejected'
                 )),
  contact_type TEXT        CHECK (contact_type IN ('email', 'phone')),
  ip_address   TEXT,
  user_agent   TEXT,
  actor        TEXT,       -- 'system' | ops-agent-id (UUID as string)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lockout_audit_log_creator_id_idx
  ON lockout_audit_log (creator_id);
CREATE INDEX IF NOT EXISTS lockout_audit_log_request_id_idx
  ON lockout_audit_log (request_id);
CREATE INDEX IF NOT EXISTS lockout_audit_log_event_type_idx
  ON lockout_audit_log (event_type);
-- Time-range queries for audit reporting
CREATE INDEX IF NOT EXISTS lockout_audit_log_created_at_idx
  ON lockout_audit_log (created_at DESC);
