-- OF-73: Credit deduction API + creator ledger (80/20 split enforcement)
-- Schema changes require CTO approval — do not modify without sign-off.

-- creator_ledger: one row per successful fan interaction charge
CREATE TABLE IF NOT EXISTS creator_ledger (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id             UUID        NOT NULL REFERENCES creators(id),
  fan_id                 UUID        NOT NULL,
  interaction_id         TEXT        NOT NULL UNIQUE,       -- idempotency key
  amount_credits         INT         NOT NULL CHECK (amount_credits > 0),
  creator_share          NUMERIC(12,4) NOT NULL,            -- always amount * 0.80
  platform_share         NUMERIC(12,4) NOT NULL,            -- amount * 0.20 - processing fee
  payment_processing_fee NUMERIC(12,4) NOT NULL DEFAULT 0
                           CHECK (payment_processing_fee >= 0),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS creator_ledger_creator_id_idx ON creator_ledger (creator_id);
CREATE INDEX IF NOT EXISTS creator_ledger_fan_id_idx     ON creator_ledger (fan_id);

ALTER TABLE creator_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY creator_row_isolation ON creator_ledger
  USING (creator_id = current_setting('app.current_creator_id', true)::uuid);

-- deduct_credits: atomic credit deduction + ledger write in a single transaction.
-- Uses SELECT … FOR UPDATE to serialize concurrent deductions for the same fan.
--
-- Returns JSONB:
--   { "success": true,  "remainingBalance": N }
--   { "success": false, "error": "insufficient_credits", "remainingBalance": N }
--   { "success": false, "error": "fan_not_found" }
--   { "success": false, "error": "duplicate_transaction" }
--   { "success": false, "error": "invalid_cost" }
CREATE OR REPLACE FUNCTION deduct_credits(
  p_fan_id         UUID,
  p_creator_id     UUID,
  p_interaction_id TEXT,
  p_cost           INT
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_balance   INT;
  v_remaining INT;
BEGIN
  IF p_cost <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_cost');
  END IF;

  -- Lock the fan_account row; serializes concurrent deductions for the same fan.
  -- Two simultaneous calls will queue here; the second sees the updated balance.
  SELECT credit_balance INTO v_balance
  FROM   fan_accounts
  WHERE  fan_id = p_fan_id AND creator_id = p_creator_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'fan_not_found');
  END IF;

  IF v_balance < p_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',            'insufficient_credits',
      'remainingBalance', v_balance
    );
  END IF;

  -- Atomic decrement
  UPDATE fan_accounts
  SET    credit_balance = credit_balance - p_cost
  WHERE  fan_id = p_fan_id AND creator_id = p_creator_id
  RETURNING credit_balance INTO v_remaining;

  -- 80/20 split: creator always gets 80%; platform gets 20% minus processing fees.
  -- payment_processing_fee is 0 at this layer (Stripe charged at purchase time).
  -- Slice 2 payout logic will factor in real processing costs against platform_share.
  INSERT INTO creator_ledger (
    creator_id,             fan_id,
    interaction_id,         amount_credits,
    creator_share,          platform_share,  payment_processing_fee
  ) VALUES (
    p_creator_id,           p_fan_id,
    p_interaction_id,       p_cost,
    p_cost * 0.80,          p_cost * 0.20,   0
  );

  RETURN jsonb_build_object('success', true, 'remainingBalance', v_remaining);

EXCEPTION
  -- unique_violation on interaction_id: duplicate request.
  -- The subtransaction (decrement + ledger insert) is rolled back automatically.
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'duplicate_transaction');
END;
$$;
