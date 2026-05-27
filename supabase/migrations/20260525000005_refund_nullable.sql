-- OF-185: Make refund_requests financial fields nullable for email ingest path.
-- Email-ingest refunds arrive without a known Stripe payment or credit amount;
-- staff fills these in during the review step. Web-form path still populates them
-- via server-side lookup but the schema no longer enforces NOT NULL at DB level.

ALTER TABLE refund_requests
  ALTER COLUMN stripe_payment_intent_id DROP NOT NULL,
  ALTER COLUMN amount_credits           DROP NOT NULL,
  ALTER COLUMN amount_cents             DROP NOT NULL,
  ALTER COLUMN currency                 DROP NOT NULL;
