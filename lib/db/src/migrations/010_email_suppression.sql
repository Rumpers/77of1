-- 010_email_suppression.sql
-- [HID-001] Transactional email infrastructure: email suppression audit log
-- Parent: OF-213
-- Suppression source-of-truth lives in Resend's API; this table is an
-- append-only audit log for DSAR compliance and reporting.

-- Requires pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- email_suppression_log: immutable record of every address suppressed.
-- source = resend_bounce | resend_complaint | api_unsubscribe | manual
-- Do NOT apply UPDATE or DELETE policies — this is a compliance audit table.
CREATE TABLE IF NOT EXISTS email_suppression_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT        NOT NULL,
  reason       TEXT        NOT NULL
                 CHECK (reason IN ('bounce', 'complaint', 'unsubscribe', 'manual')),
  source       TEXT        NOT NULL DEFAULT 'api_unsubscribe',
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookups by email address for reporting
CREATE INDEX IF NOT EXISTS email_suppression_log_email_idx
  ON email_suppression_log (email);

-- Time-range queries for compliance reporting
CREATE INDEX IF NOT EXISTS email_suppression_log_created_at_idx
  ON email_suppression_log (created_at DESC);

-- email_send_log: best-effort record of every email sent.
-- messageId is provider-assigned (Resend email ID).
-- Enables per-template open/click metric reconciliation with PostHog.
CREATE TABLE IF NOT EXISTS email_send_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id   TEXT        UNIQUE,             -- provider message ID
  recipient    TEXT        NOT NULL,
  template     TEXT        NOT NULL,
  locale       TEXT        NOT NULL DEFAULT 'en',
  suppressed   BOOLEAN     NOT NULL DEFAULT FALSE,
  metadata     JSONB,
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_send_log_recipient_idx
  ON email_send_log (recipient);

CREATE INDEX IF NOT EXISTS email_send_log_template_idx
  ON email_send_log (template);

CREATE INDEX IF NOT EXISTS email_send_log_sent_at_idx
  ON email_send_log (sent_at DESC);
