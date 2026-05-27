-- HID-062: Creator KYC + tax-form intake
-- OF-283
--
-- Scope:
--   Region-specific income tax withholding forms for creator payouts:
--   W-9 (US persons), W-8BEN (non-US individuals), JP マイナンバー, TW National ID.
--
-- Acceptance: payout cannot be enabled without completed intake.
--
-- Changes:
--   1. creator_tax_forms — one row per creator, lifecycle-managed
--   2. check_payout_tax_eligible() — function for payout gate
--   3. RLS — creator can read own row; service role can read/write all

-- ============================================================
-- 1. creator_tax_forms
--
--    form_type values (region-specific):
--      'w9'           — IRS W-9 (US persons / entities)
--      'w8ben'        — IRS W-8BEN (non-US individuals)
--      'w8ben_e'      — IRS W-8BEN-E (non-US entities)
--      'jp_mynumber'  — JP Individual Number (マイナンバー) / corporate number
--      'tw_national'  — TW National ID (居留統一證號 / 統一編號)
--      'sg_nric'      — SG NRIC/FIN for individuals; UEN for companies
--
--    status lifecycle:
--      not_submitted → submitted → approved
--                                ↘ rejected → submitted (resubmit)
--
--    form_data JSONB holds the submitted fields (see route for per-type schema).
--    Sensitive fields (SSN/EIN/national ID numbers) stored as last-4 in
--    tax_id_last4 for ops display; full value in form_data (encrypted by the
--    application layer in Slice 3). For Slice 1 the full value is stored in
--    form_data but access is service-role only (no fan-facing exposure).
-- ============================================================
create table if not exists creator_tax_forms (
  id               uuid        primary key default gen_random_uuid(),
  creator_id       uuid        not null unique references creators(id) on delete cascade,

  -- Form identity
  form_type        text        not null check (form_type in (
                                 'w9', 'w8ben', 'w8ben_e',
                                 'jp_mynumber', 'tw_national', 'sg_nric'
                               )),
  jurisdiction     text        not null,        -- 'US', 'JP', 'TW', 'SG'

  -- Review lifecycle
  status           text        not null default 'submitted'
                                 check (status in (
                                   'submitted',   -- awaiting ops review
                                   'approved',    -- payout eligible
                                   'rejected'     -- resubmit required
                                 )),

  -- Form fields (see route for validation per form_type)
  full_name        text        not null,
  country          text        not null,        -- ISO 3166-1 alpha-2
  address          text        not null,
  tax_id_last4     text,                        -- last 4 chars of tax ID, for ops display
  form_data        jsonb       not null default '{}', -- full submitted payload

  -- Ops review
  rejection_reason text,
  reviewed_by      text,                        -- auth_user_id of reviewing ops staff
  reviewed_at      timestamptz,

  -- Audit
  submitted_at     timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create index if not exists creator_tax_forms_creator_id_idx
  on creator_tax_forms (creator_id);

create index if not exists creator_tax_forms_status_idx
  on creator_tax_forms (status);

-- ============================================================
-- 2. Updated-at trigger
-- ============================================================
create or replace function update_creator_tax_forms_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists creator_tax_forms_updated_at on creator_tax_forms;
create trigger creator_tax_forms_updated_at
  before update on creator_tax_forms
  for each row execute function update_creator_tax_forms_updated_at();

-- ============================================================
-- 3. check_payout_tax_eligible(p_creator_id uuid)
--    Returns true when the creator has submitted or approved tax form.
--    Called by the payout system before initiating any disbursement.
-- ============================================================
create or replace function check_payout_tax_eligible(p_creator_id uuid)
returns boolean
language sql stable as $$
  select exists (
    select 1 from creator_tax_forms
    where  creator_id = p_creator_id
      and  status in ('submitted', 'approved')
  );
$$;

-- ============================================================
-- 4. RLS
--    Service role bypasses RLS.
--    Creators can read their own row (for status display).
--    Mutations are service-role only (API handles auth check).
-- ============================================================
alter table creator_tax_forms enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'creator_tax_forms'
      and policyname = 'creator_read_own'
  ) then
    create policy creator_read_own on creator_tax_forms
      for select
      using (creator_id = current_setting('app.current_creator_id', true)::uuid);
  end if;
end $$;
