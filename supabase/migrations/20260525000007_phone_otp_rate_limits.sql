-- HID-002: Phone OTP rate-limit audit table
--
-- Tracks every send + verify attempt per phone number and IP address.
-- Used for:
--   - Send throttle: max 5 sends per phone per hour
--   - IP throttle:  max 3 sends per IP per 15 minutes
--   - Brute-force:  max 10 failed verifies per phone per hour
--   - Deliverability telemetry: per-region success/fallback rates

CREATE TABLE IF NOT EXISTS phone_otp_attempts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164    TEXT        NOT NULL,
  ip_address    TEXT,
  kind          TEXT        NOT NULL CHECK (kind IN ('send', 'verify')),
  success       BOOLEAN     NOT NULL DEFAULT false,
  region_code   TEXT,
  fallback_used BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-phone rate queries (send throttle + brute-force)
CREATE INDEX IF NOT EXISTS phone_otp_phone_created_idx
  ON phone_otp_attempts (phone_e164, created_at DESC);

-- Per-IP send throttle
CREATE INDEX IF NOT EXISTS phone_otp_ip_created_idx
  ON phone_otp_attempts (ip_address, created_at DESC)
  WHERE ip_address IS NOT NULL;

-- Deliverability reporting (region + fallback queries)
CREATE INDEX IF NOT EXISTS phone_otp_region_created_idx
  ON phone_otp_attempts (region_code, created_at DESC)
  WHERE region_code IS NOT NULL;

-- Service-role only; fans never read their own attempt log
ALTER TABLE phone_otp_attempts ENABLE ROW LEVEL SECURITY;
