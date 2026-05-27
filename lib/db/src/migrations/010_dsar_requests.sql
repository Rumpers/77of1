-- 010_dsar_requests.sql
-- [HID-035] Fan/creator DSAR self-service portal (OF-135)
-- §16 — 30-day fan data download, 72-hour creator self-export.
-- One row per DSAR request. Rate-limited at the API layer (one per 30 days per user).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- dsar_requests: tracks every DSAR submission from fans and creators.
-- auth_user_id = Supabase auth user UUID (not replit_user_id).
-- requester_type = 'fan' | 'creator'.
-- download_token = one-time secure token (SHA-256 hex) for the download link.
-- Data package is collected synchronously; token generated on first request.
CREATE TABLE IF NOT EXISTS dsar_requests (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id     TEXT        NOT NULL,
  requester_type   TEXT        NOT NULL CHECK (requester_type IN ('fan', 'creator')),
  status           TEXT        NOT NULL DEFAULT 'processing'
                               CHECK (status IN ('processing', 'ready', 'downloaded', 'expired', 'failed')),
  download_token   TEXT        UNIQUE,
  package_size     INT,                     -- bytes; set when package is ready
  requested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ready_at         TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ,             -- 30 days after ready_at
  downloaded_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dsar_requests_user_idx
  ON dsar_requests (auth_user_id, requester_type, requested_at DESC);

CREATE INDEX IF NOT EXISTS dsar_requests_token_idx
  ON dsar_requests (download_token)
  WHERE download_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS dsar_requests_expires_idx
  ON dsar_requests (expires_at)
  WHERE status = 'ready';

ALTER TABLE dsar_requests ENABLE ROW LEVEL SECURITY;
