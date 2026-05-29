-- HID-022: Tax collection — JCT (JP 10%), TW VAT (5%), SG GST (9%)
-- OF-245
--
-- Changes:
--   1. tax_rates — canonical rate lookup by jurisdiction with effective-date history
--   2. get_current_tax_rate() — helper to resolve active rate for a jurisdiction
--   3. credit_transactions — tax_jurisdiction, tax_rate_bps, tax_amount_cents columns
--   4. fan_subscriptions  — tax_jurisdiction, tax_rate_bps, tax_amount_cents columns
--   5. refund_requests.currency — extend check to include 'sgd'
--   6. feature_flags seed — tax_collection_enabled (off by default for staged rollout)

-- ============================================================
-- 1. tax_rates
--    One active row per jurisdiction (effective_to IS NULL).
--    Historical rows retain effective_to for audit continuity.
-- ============================================================
create table if not exists tax_rates (
  jurisdiction   text        not null,
  tax_name       text        not null,
  rate_bps       integer     not null check (rate_bps >= 0 and rate_bps <= 10000),
  effective_from timestamptz not null default now(),
  effective_to   timestamptz,
  created_at     timestamptz not null default now(),
  primary key (jurisdiction, effective_from)
);

-- Only one active rate per jurisdiction at a time
create unique index if not exists tax_rates_active_jurisdiction_uidx
  on tax_rates (jurisdiction)
  where effective_to is null;

create index if not exists tax_rates_jurisdiction_history_idx
  on tax_rates (jurisdiction, effective_from desc);

-- ============================================================
-- 2. get_current_tax_rate helper
--    Returns (tax_name text, rate_bps integer) for the active rate.
--    Returns (NULL, 0) when no active rate exists (tax-free jurisdiction).
-- ============================================================
create or replace function get_current_tax_rate(p_jurisdiction text)
returns table (tax_name text, rate_bps integer)
language sql stable as $$
  select tr.tax_name, tr.rate_bps
  from   tax_rates tr
  where  tr.jurisdiction = upper(p_jurisdiction)
    and  tr.effective_to is null
  limit  1;
$$;

-- ============================================================
-- 3. credit_transactions — tax columns
--    Nullable: pre-HID-022 rows have no tax data.
--    Immutable at insert time (rate locked when payment occurs).
-- ============================================================
alter table credit_transactions
  add column if not exists tax_jurisdiction text,
  add column if not exists tax_rate_bps     integer check (tax_rate_bps >= 0),
  add column if not exists tax_amount_cents integer check (tax_amount_cents >= 0);

-- ============================================================
-- 4. fan_subscriptions — tax columns
--    Nullable: pre-HID-022 subscriptions have no tax data.
-- ============================================================
alter table fan_subscriptions
  add column if not exists tax_jurisdiction text,
  add column if not exists tax_rate_bps     integer check (tax_rate_bps >= 0),
  add column if not exists tax_amount_cents integer check (tax_amount_cents >= 0);

-- ============================================================
-- 5. refund_requests.currency — add 'sgd'
--    Drop inline check, re-add with SG included.
-- ============================================================
alter table refund_requests
  drop constraint if exists refund_requests_currency_check;

alter table refund_requests
  add constraint refund_requests_currency_check
    check (currency in ('jpy', 'twd', 'usd', 'sgd'));

-- ============================================================
-- 6. feature_flags seed — tax_collection_enabled
--    Disabled by default; flip to true per-market when billing
--    layer is ready to pass tax_jurisdiction on each charge.
--    Guarded: feature_flags may not exist yet in all environments.
-- ============================================================
do $$ begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'feature_flags'
  ) then
    insert into feature_flags (key, enabled, payload)
      values (
        'tax_collection_enabled',
        false,
        '{"markets": [], "note": "flip per-market: JP, TW, SG"}'::jsonb
      )
    on conflict (key) do nothing;
  end if;
end $$;

-- ============================================================
-- 7. Seed current rates (all effective immediately)
--    JP: JCT  10%  (1000 bps) — in force since 2019-10-01
--    TW: VAT   5%  ( 500 bps) — in force since 2011-01-01
--    SG: GST   9%  ( 900 bps) — in force since 2024-01-01
-- ============================================================
insert into tax_rates (jurisdiction, tax_name, rate_bps, effective_from) values
  ('JP', 'JCT', 1000, '2019-10-01 00:00:00+00'),
  ('TW', 'VAT',  500, '2011-01-01 00:00:00+00'),
  ('SG', 'GST',  900, '2024-01-01 00:00:00+00')
on conflict (jurisdiction, effective_from) do nothing;
