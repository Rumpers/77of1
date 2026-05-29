-- HID-023: Invoice / receipt generation — OF-248
--
-- Changes:
--   1. invoice_kind enum — 'receipt' (per-transaction) | 'monthly_statement' (creator payout)
--   2. invoice_status enum — 'draft' | 'issued' | 'voided'
--   3. invoices — persistent store for fan receipts and creator statements.
--      JP qualified invoice fields (インボイス制度) populated for JP jurisdiction.
--      retain_until enforces APPI §8.3 5-year financial-records retention at the row level.
--   4. creator_monthly_statements — one row per creator/period for payout reconciliation.
--   5. invoice_number_seq — per-creator sequence via a sequence table (avoids serial gaps).
--   6. RLS creator_row_isolation on both tables.
--   7. feature_flags seed — invoice_generation_enabled (off by default).

-- ============================================================
-- 1. Enum types
-- ============================================================
do $$ begin
  create type invoice_kind as enum ('receipt', 'monthly_statement');
exception when duplicate_object then null; end $$;

do $$ begin
  create type invoice_status as enum ('draft', 'issued', 'voided');
exception when duplicate_object then null; end $$;

-- ============================================================
-- 2. invoices
--    One row per fan receipt (kind='receipt') or creator payout
--    summary (kind='monthly_statement').
--
--    JP qualified invoice fields (jp_*):
--      jp_registration_no — issuer registration number, format T + 13 digits.
--      jp_issuer_name     — creator's legal or registered name.
--      jp_recipient_name  — fan name; optional for B2C under JP rules.
--    These are null for non-JP jurisdictions.
--
--    retain_until is set at INSERT time to issued_at + 5 years.
--    Application layer must not purge rows before retain_until to
--    satisfy APPI §8.3 financial-records retention.
-- ============================================================
create table if not exists invoices (
  id                      uuid            primary key default gen_random_uuid(),
  invoice_number          text            not null,
  kind                    invoice_kind    not null,
  status                  invoice_status  not null default 'draft',

  creator_id              uuid            not null references creators(id),
  fan_id                  uuid            references fans(id),
  payment_transaction_id  uuid            references payment_transactions(id),
  credit_transaction_id   uuid            references credit_transactions(id),

  jurisdiction            text            not null default 'US',

  -- JP qualified invoice system (インボイス制度)
  jp_registration_no      text,
  jp_issuer_name          text,
  jp_recipient_name       text,

  -- Amounts — stored in the transaction currency, smallest unit (cents/yen/etc.)
  currency                text            not null,
  subtotal_amount         int             not null check (subtotal_amount >= 0),
  tax_rate_bps            int             not null default 0 check (tax_rate_bps >= 0),
  tax_amount              int             not null default 0 check (tax_amount >= 0),
  total_amount            int             not null check (total_amount >= 0),

  description             text,

  -- Object storage path for generated PDF; null until PDF is produced.
  asset_key               text,

  issued_at               timestamptz,
  -- APPI §8.3: financial records must be retained for 5 years.
  -- Set by trigger on insert when kind='receipt' and issued_at is known.
  -- Application layer must set explicitly when issuing a statement.
  retain_until            timestamptz,

  metadata                jsonb           not null default '{}',
  created_at              timestamptz     not null default now(),
  updated_at              timestamptz     not null default now(),

  -- Each creator's invoice numbers must be unique.
  unique (creator_id, invoice_number),
  -- A payment transaction maps to at most one receipt.
  unique (payment_transaction_id),
  -- A credit transaction maps to at most one receipt.
  unique (credit_transaction_id)
);

create index if not exists invoices_creator_id_idx
  on invoices (creator_id);
create index if not exists invoices_fan_id_idx
  on invoices (fan_id)
  where fan_id is not null;
create index if not exists invoices_issued_at_idx
  on invoices (creator_id, issued_at desc)
  where issued_at is not null;
create index if not exists invoices_retain_until_idx
  on invoices (retain_until)
  where retain_until is not null;
create index if not exists invoices_jurisdiction_idx
  on invoices (jurisdiction, creator_id);

-- Auto-update updated_at
create or replace function touch_invoices()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'invoices_updated_at'
  ) then
    create trigger invoices_updated_at
      before update on invoices
      for each row execute function touch_invoices();
  end if;
end $$;

-- Auto-populate retain_until = issued_at + 5 years when the invoice is issued.
create or replace function set_invoice_retain_until()
returns trigger language plpgsql as $$
begin
  if new.issued_at is not null and new.retain_until is null then
    new.retain_until := new.issued_at + interval '5 years';
  end if;
  return new;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'invoices_retain_until'
  ) then
    create trigger invoices_retain_until
      before insert or update on invoices
      for each row execute function set_invoice_retain_until();
  end if;
end $$;

alter table invoices enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'invoices' and policyname = 'creator_row_isolation'
  ) then
    create policy creator_row_isolation on invoices
      using (creator_id = current_setting('app.current_creator_id', true)::uuid);
  end if;
end $$;

-- ============================================================
-- 3. creator_monthly_statements
--    One row per creator per calendar month per currency.
--    Summarises all fan revenue for payout reconciliation.
--    invoice_id links back to the invoices table once generated.
-- ============================================================
create table if not exists creator_monthly_statements (
  id                    uuid        primary key default gen_random_uuid(),
  creator_id            uuid        not null references creators(id),
  invoice_id            uuid        references invoices(id),
  period_year           int         not null check (period_year >= 2024),
  period_month          int         not null check (period_month between 1 and 12),
  currency              text        not null,

  gross_revenue         int         not null default 0 check (gross_revenue >= 0),
  platform_fee          int         not null default 0 check (platform_fee >= 0),
  tax_withheld          int         not null default 0 check (tax_withheld >= 0),
  net_payout            int         not null check (net_payout >= 0),

  transaction_count     int         not null default 0 check (transaction_count >= 0),

  status                text        not null default 'draft'
                          check (status in ('draft', 'finalized', 'paid')),
  finalized_at          timestamptz,
  paid_at               timestamptz,

  -- Object storage path for the PDF monthly statement.
  asset_key             text,

  metadata              jsonb       not null default '{}',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  unique (creator_id, period_year, period_month, currency)
);

create index if not exists cms_creator_period_idx
  on creator_monthly_statements (creator_id, period_year desc, period_month desc);
create index if not exists cms_status_idx
  on creator_monthly_statements (status, finalized_at)
  where status != 'paid';

create or replace function touch_creator_monthly_statements()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'cms_updated_at'
  ) then
    create trigger cms_updated_at
      before update on creator_monthly_statements
      for each row execute function touch_creator_monthly_statements();
  end if;
end $$;

alter table creator_monthly_statements enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'creator_monthly_statements' and policyname = 'creator_row_isolation'
  ) then
    create policy creator_row_isolation on creator_monthly_statements
      using (creator_id = current_setting('app.current_creator_id', true)::uuid);
  end if;
end $$;

-- ============================================================
-- 4. invoice_number_seq
--    Per-creator sequential counter for human-readable invoice
--    numbers. Application layer calls next_invoice_number() to
--    generate "INV-<creator_handle_prefix>-<year>-<seq>".
--    Using a dedicated table avoids gaps in serial columns and
--    supports per-creator reset/custom prefix if required later.
-- ============================================================
create table if not exists invoice_number_seq (
  creator_id  uuid  not null references creators(id),
  year        int   not null,
  last_seq    int   not null default 0,
  primary key (creator_id, year)
);

create or replace function next_invoice_number(
  p_creator_id uuid,
  p_year       int default extract(year from now())::int
)
returns text
language plpgsql as $$
declare
  v_seq int;
begin
  insert into invoice_number_seq (creator_id, year, last_seq)
    values (p_creator_id, p_year, 1)
  on conflict (creator_id, year) do update
    set last_seq = invoice_number_seq.last_seq + 1
  returning last_seq into v_seq;

  return 'INV-' || p_year::text || '-' || lpad(v_seq::text, 5, '0');
end $$;

-- ============================================================
-- 5. feature_flags seed — invoice_generation_enabled
--    Off by default; enable per-market when PDF generation and
--    email delivery (HID-001) pipelines are wired up for that
--    jurisdiction.
-- ============================================================
do $$ begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'feature_flags'
  ) then
    insert into feature_flags (key, enabled, payload)
      values (
        'invoice_generation_enabled',
        false,
        '{"markets": [], "note": "enable per-market: JP first; requires HID-001 email pipeline"}'::jsonb
      )
    on conflict (key) do nothing;
  end if;
end $$;
