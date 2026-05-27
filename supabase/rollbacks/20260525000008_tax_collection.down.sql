-- Rollback: HID-022 tax collection (OF-245)

-- Restore original currency check (no 'sgd')
alter table refund_requests
  drop constraint if exists refund_requests_currency_check;
alter table refund_requests
  add constraint refund_requests_currency_check
    check (currency in ('jpy', 'twd', 'usd'));

-- Drop tax columns from fan_subscriptions
alter table fan_subscriptions
  drop column if exists tax_amount_cents,
  drop column if exists tax_rate_bps,
  drop column if exists tax_jurisdiction;

-- Drop tax columns from credit_transactions
alter table credit_transactions
  drop column if exists tax_amount_cents,
  drop column if exists tax_rate_bps,
  drop column if exists tax_jurisdiction;

-- Drop helper function
drop function if exists get_current_tax_rate(text);

-- Drop tax_rates table
drop table if exists tax_rates;

-- Remove feature flag
delete from feature_flags where key = 'tax_collection_enabled';
