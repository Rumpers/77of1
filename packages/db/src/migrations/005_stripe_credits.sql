-- OF-67: Stripe credits checkout
-- Adds credit_balance to fan_accounts, credit_packs catalogue, stripe_events idempotency,
-- and apply_credit_purchase RPC for atomic, idempotent credit grant.

-- 1. Add credit_balance to fan_accounts
ALTER TABLE fan_accounts
  ADD COLUMN IF NOT EXISTS credit_balance INT NOT NULL DEFAULT 0,
  ADD CONSTRAINT IF NOT EXISTS credit_balance_nonneg CHECK (credit_balance >= 0);

-- 2. Credit pack catalogue — one row per purchasable pack per market
CREATE TABLE IF NOT EXISTS credit_packs (
  id              TEXT PRIMARY KEY,               -- e.g. 'jp_490', 'tw_150', 'en_499'
  market          TEXT NOT NULL CHECK (market IN ('JP', 'TW', 'EN')),
  credits         INT  NOT NULL CHECK (credits > 0),
  price_cents     INT  NOT NULL CHECK (price_cents > 0), -- smallest currency unit
  currency        TEXT NOT NULL,                 -- 'JPY', 'TWD', 'USD'
  stripe_price_id TEXT NOT NULL,                 -- must be a real Stripe Price ID
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Stripe event idempotency log — one row per processed event_id
CREATE TABLE IF NOT EXISTS stripe_events (
  stripe_event_id TEXT PRIMARY KEY,
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Atomic, idempotent credit grant via DB function
--    Returns 'ok' on first processing, 'duplicate' if event was already applied.
--    The unique_violation on stripe_events INSERT guarantees at-most-once semantics
--    even under concurrent webhook retries.
CREATE OR REPLACE FUNCTION apply_credit_purchase(
  p_stripe_event_id TEXT,
  p_fan_id          TEXT,
  p_creator_id      TEXT,
  p_credits         INT
) RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  -- Insert event record first; throws unique_violation if already processed
  INSERT INTO stripe_events (stripe_event_id)
  VALUES (p_stripe_event_id);

  -- Upsert fan_account and increment balance atomically
  INSERT INTO fan_accounts (fan_id, creator_id, credit_balance)
  VALUES (p_fan_id::uuid, p_creator_id::uuid, p_credits)
  ON CONFLICT (fan_id, creator_id)
    DO UPDATE SET credit_balance = fan_accounts.credit_balance + EXCLUDED.credit_balance;

  RETURN 'ok';
EXCEPTION
  WHEN unique_violation THEN
    RETURN 'duplicate';
END;
$$;
