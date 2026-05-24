-- Credit pack seed data — JP / TW / EN markets (PRD §24.2)
--
-- Before running: replace STRIPE_PRICE_* placeholders with real Stripe Price IDs.
-- Create Products + Prices in the Stripe dashboard (test mode first), then copy IDs here
-- or set them as Replit Secrets and inject via the apply-seeds script.
--
-- Credit tiers: 50 / 110 / 350 credits per pack (small / medium / large)
-- Bulk bonus: medium = +10%, large = +17% over linear.

INSERT INTO credit_packs (id, market, credits, price_cents, currency, stripe_price_id) VALUES
  -- Japan (JPY)
  ('jp_490',  'JP', 50,  490,  'JPY', 'STRIPE_PRICE_JP_490'),
  ('jp_980',  'JP', 110, 980,  'JPY', 'STRIPE_PRICE_JP_980'),
  ('jp_2980', 'JP', 350, 2980, 'JPY', 'STRIPE_PRICE_JP_2980'),

  -- Taiwan (TWD)
  ('tw_150',  'TW', 50,  150,  'TWD', 'STRIPE_PRICE_TW_150'),
  ('tw_300',  'TW', 110, 300,  'TWD', 'STRIPE_PRICE_TW_300'),
  ('tw_900',  'TW', 350, 900,  'TWD', 'STRIPE_PRICE_TW_900'),

  -- English / global (USD — stored as cents)
  ('en_499',  'EN', 50,  499,  'USD', 'STRIPE_PRICE_EN_499'),
  ('en_999',  'EN', 110, 999,  'USD', 'STRIPE_PRICE_EN_999'),
  ('en_2999', 'EN', 350, 2999, 'USD', 'STRIPE_PRICE_EN_2999')

ON CONFLICT (id) DO NOTHING;
