-- OFA-10: Stripe credits system
-- Creates credit_packs catalog, stripe_events idempotency log,
-- apply_credit_purchase RPC, and deduct_credits RPC.
-- Idempotent via IF NOT EXISTS and CREATE OR REPLACE.

-- ── credit_packs: purchasable credit pack catalog ────────────────────────────
CREATE TABLE IF NOT EXISTS credit_packs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  credits         int         NOT NULL CHECK (credits > 0),
  price_cents     int         NOT NULL CHECK (price_cents > 0),
  stripe_price_id text        NOT NULL,
  active          boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- No RLS: read-only catalog, accessible via service_role.
ALTER TABLE credit_packs ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read active packs (needed for checkout flow).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'credit_packs' AND policyname = 'credit_packs_public_select'
  ) THEN
    CREATE POLICY credit_packs_public_select ON credit_packs
      FOR SELECT USING (active = true);
  END IF;
END $$;

-- Seed the three SKUs defined in OFA-10.
-- stripe_price_id placeholders are replaced with real Stripe Price IDs via env/config.
INSERT INTO credit_packs (credits, price_cents, stripe_price_id) VALUES
  (100,   99,  'STRIPE_PRICE_100_CREDITS'),
  (500,  499,  'STRIPE_PRICE_500_CREDITS'),
  (1000, 999,  'STRIPE_PRICE_1000_CREDITS')
ON CONFLICT DO NOTHING;

-- ── stripe_events: webhook idempotency log ───────────────────────────────────
CREATE TABLE IF NOT EXISTS stripe_events (
  event_id     text        PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
-- No client policies — service_role uses BYPASSRLS for all writes.

-- ── apply_credit_purchase: idempotent credit top-up ─────────────────────────
-- Called by webhook handlers on checkout.session.completed or payment_intent.succeeded.
-- Returns: 'applied' or 'duplicate'.
CREATE OR REPLACE FUNCTION apply_credit_purchase(
  p_stripe_event_id text,
  p_fan_id          uuid,
  p_creator_id      uuid,
  p_credits         int
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Guard: insert event_id; conflict means already processed.
  INSERT INTO stripe_events (event_id)
  VALUES (p_stripe_event_id)
  ON CONFLICT DO NOTHING;

  IF NOT FOUND THEN
    RETURN 'duplicate';
  END IF;

  -- Upsert fan_credits: create row if absent, otherwise increment balance.
  INSERT INTO fan_credits (fan_id, creator_id, balance)
  VALUES (p_fan_id, p_creator_id, p_credits)
  ON CONFLICT (fan_id, creator_id)
  DO UPDATE SET
    balance    = fan_credits.balance + EXCLUDED.balance,
    updated_at = now();

  -- Write ledger entry for audit / reconciliation.
  INSERT INTO credit_transactions (fan_id, creator_id, kind, amount, stripe_event_id)
  VALUES (p_fan_id, p_creator_id, 'topup', p_credits, p_stripe_event_id);

  RETURN 'applied';
END;
$$;

-- ── deduct_credits: atomic deduction — no double-spend ──────────────────────
-- Returns JSON: { success, error?, remainingBalance? }
-- Errors: 'insufficient_credits' | 'fan_not_found' | 'duplicate_transaction'
CREATE OR REPLACE FUNCTION deduct_credits(
  p_fan_id         uuid,
  p_creator_id     uuid,
  p_interaction_id text,
  p_cost           int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_remaining int;
  v_balance   int;
BEGIN
  -- Idempotency: reject duplicate interaction IDs.
  IF EXISTS (
    SELECT 1 FROM credit_transactions
    WHERE idempotency_key = p_interaction_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'duplicate_transaction');
  END IF;

  -- Atomic balance check + deduction in one UPDATE.
  -- `balance >= p_cost` is the no-negative-balance invariant.
  UPDATE fan_credits
  SET balance = balance - p_cost, updated_at = now()
  WHERE fan_id    = p_fan_id
    AND creator_id = p_creator_id
    AND balance   >= p_cost
  RETURNING balance INTO v_remaining;

  IF NOT FOUND THEN
    -- Distinguish "fan has no row" from "fan has row but insufficient balance".
    SELECT balance INTO v_balance
    FROM fan_credits
    WHERE fan_id = p_fan_id AND creator_id = p_creator_id;

    IF v_balance IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'fan_not_found');
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'error', 'insufficient_credits',
        'remainingBalance', v_balance
      );
    END IF;
  END IF;

  -- Record the spend in the ledger.
  INSERT INTO credit_transactions (fan_id, creator_id, kind, amount, idempotency_key)
  VALUES (p_fan_id, p_creator_id, 'spend', p_cost, p_interaction_id);

  RETURN jsonb_build_object('success', true, 'remainingBalance', v_remaining);
END;
$$;
