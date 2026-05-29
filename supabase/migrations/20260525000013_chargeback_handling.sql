-- HID-026: Chargeback handling — OF-254
-- Stripe / LINE Pay dispute webhooks → internal ticket, evidence assembly,
-- ledger reversal + creator-share clawback, repeat-chargeback auto-ban.
-- Priority: P0 · PRD ref: §8.7

-- ============================================================
-- 1. payment_tx_status: add 'chargebacked' value
--    Marks the originating payment_transaction when a dispute is lost.
-- ============================================================
alter type payment_tx_status add value if not exists 'chargebacked';

-- ============================================================
-- 2. chargeback_status enum
--    Lifecycle: received → evidence_gathering → submitted → won | lost | accepted
-- ============================================================
do $$ begin
  create type chargeback_status as enum (
    'received',
    'evidence_gathering',
    'submitted',
    'won',
    'lost',
    'accepted'
  );
exception when duplicate_object then null; end $$;

-- ============================================================
-- 3. chargeback_disputes
--    One row per dispute received from a payment processor.
--    SLA: evidence must be submitted within 72h of received_at.
-- ============================================================
create table if not exists chargeback_disputes (
  id                     uuid               primary key default gen_random_uuid(),
  fan_id                 uuid               not null references fans(id),
  creator_id             uuid               not null references creators(id),
  payment_transaction_id uuid               not null references payment_transactions(id),
  provider               payment_provider   not null,
  -- Processor-native dispute identifier (Stripe: dp_xxx, LINE Pay: dispute ref)
  provider_dispute_id    text               not null unique,
  amount_cents           int                not null check (amount_cents > 0),
  currency               text               not null default 'usd',
  -- Processor-supplied reason code (e.g. 'fraudulent', 'product_not_received')
  reason                 text,
  status                 chargeback_status  not null default 'received',
  -- SLA: auto-set to created_at + 72h by trigger
  sla_deadline_at        timestamptz        not null,
  -- When evidence package was submitted to processor
  evidence_submitted_at  timestamptz,
  -- Processor's final resolution timestamp
  resolved_at            timestamptz,
  -- Staff member who took ownership (nullable until claimed)
  handled_by_staff_id    uuid               references staff_users(id),
  created_at             timestamptz        not null default now(),
  updated_at             timestamptz        not null default now()
);

create index if not exists chargeback_disputes_fan_id_idx
  on chargeback_disputes (fan_id);
create index if not exists chargeback_disputes_creator_id_idx
  on chargeback_disputes (creator_id);
-- Partial index: open disputes only — queries for ops worklist
create index if not exists chargeback_disputes_open_status_idx
  on chargeback_disputes (status, sla_deadline_at)
  where status in ('received', 'evidence_gathering', 'submitted');
create index if not exists chargeback_disputes_payment_tx_idx
  on chargeback_disputes (payment_transaction_id);

create or replace function trg_chargeback_dispute_defaults()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    new.sla_deadline_at := now() + interval '72 hours';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists chargeback_dispute_defaults on chargeback_disputes;
create trigger chargeback_dispute_defaults
  before insert or update on chargeback_disputes
  for each row execute function trg_chargeback_dispute_defaults();

alter table chargeback_disputes enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'chargeback_disputes' and policyname = 'creator_row_isolation'
  ) then
    create policy creator_row_isolation on chargeback_disputes
      using (creator_id = current_setting('app.current_creator_id', true)::uuid);
  end if;
end $$;

-- ============================================================
-- 4. chargeback_evidence
--    Evidence assembled per dispute: transcript excerpts,
--    consent snapshot, anti-fraud signals, provider payload.
--    One row per dispute (unique constraint on dispute_id).
-- ============================================================
create table if not exists chargeback_evidence (
  id                  uuid        primary key default gen_random_uuid(),
  dispute_id          uuid        not null references chargeback_disputes(id) unique,
  -- Array of {role, content, timestamp} message objects from chat log
  transcript_excerpt  jsonb       not null default '[]',
  -- Snapshot of consent_grant row at time of original purchase
  consent_snapshot    jsonb       not null default '{}',
  -- Anti-fraud signals: ip_address, device_fingerprint, velocity_score, radar_score
  anti_fraud_signals  jsonb       not null default '{}',
  -- Freeform staff notes for evidence review
  staff_notes         text,
  -- Structured payload submitted to processor (Stripe evidenceObject or LINE Pay equiv)
  provider_payload    jsonb       not null default '{}',
  assembled_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists chargeback_evidence_dispute_idx
  on chargeback_evidence (dispute_id);

alter table chargeback_evidence enable row level security;
-- Evidence is staff-ops territory; no creator-scoped policy.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'chargeback_evidence' and policyname = 'chargeback_evidence_select'
  ) then
    create policy chargeback_evidence_select on chargeback_evidence
      for select using (true);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'chargeback_evidence' and policyname = 'chargeback_evidence_insert'
  ) then
    create policy chargeback_evidence_insert on chargeback_evidence
      for insert with check (true);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'chargeback_evidence' and policyname = 'chargeback_evidence_update'
  ) then
    create policy chargeback_evidence_update on chargeback_evidence
      for update using (true);
  end if;
end $$;

-- ============================================================
-- 5. chargeback_auto_bans
--    Fans who trigger the repeat-chargeback threshold are banned
--    automatically. Lifted only by staff. Feeds into HID-031
--    platform-wide ban list when that table is created.
-- ============================================================
create table if not exists chargeback_auto_bans (
  id              uuid        primary key default gen_random_uuid(),
  fan_id          uuid        not null references fans(id),
  -- Count of chargebacks at time of ban trigger
  dispute_count   int         not null default 1,
  -- Threshold value from feature_flags at time of ban
  threshold_used  int         not null default 2,
  banned_at       timestamptz not null default now(),
  -- Staff can lift the ban; NULL means active
  lifted_at       timestamptz,
  lifted_by_staff uuid        references staff_users(id),
  lift_reason     text
);

-- At most one active ban per fan
create unique index if not exists chargeback_auto_bans_active_fan_idx
  on chargeback_auto_bans (fan_id)
  where lifted_at is null;

create index if not exists chargeback_auto_bans_fan_id_idx
  on chargeback_auto_bans (fan_id);

alter table chargeback_auto_bans enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'chargeback_auto_bans' and policyname = 'chargeback_auto_bans_select'
  ) then
    create policy chargeback_auto_bans_select on chargeback_auto_bans
      for select using (true);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'chargeback_auto_bans' and policyname = 'chargeback_auto_bans_insert'
  ) then
    create policy chargeback_auto_bans_insert on chargeback_auto_bans
      for insert with check (true);
  end if;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'chargeback_auto_bans' and policyname = 'chargeback_auto_bans_update'
  ) then
    create policy chargeback_auto_bans_update on chargeback_auto_bans
      for update using (true);
  end if;
end $$;

-- ============================================================
-- 6. fans: add chargeback_count
--    Incremented on each lost dispute. Ban triggered when this
--    reaches the chargeback_auto_ban_threshold feature flag value.
-- ============================================================
alter table fans
  add column if not exists chargeback_count int not null default 0;

-- ============================================================
-- 7. creator_ledger_entries: link chargeback clawbacks to disputes
--    Nullable FK — refund-driven clawbacks (refund_request_id) are unaffected.
--    Chargeback-driven clawbacks set chargeback_dispute_id instead.
-- ============================================================
alter table creator_ledger_entries
  add column if not exists chargeback_dispute_id uuid
    references chargeback_disputes(id);

create index if not exists ledger_chargeback_dispute_idx
  on creator_ledger_entries (chargeback_dispute_id)
  where chargeback_dispute_id is not null;

-- ============================================================
-- 8. credit_transactions: extend kind to include chargeback_reversal
--    Issued when a lost dispute zeroes/clamps a fan's credit balance.
-- ============================================================
alter table credit_transactions
  drop constraint if exists credit_transactions_kind_check;

alter table credit_transactions
  add constraint credit_transactions_kind_check
    check (kind in ('topup', 'spend', 'refund', 'chargeback_reversal'));

-- ============================================================
-- 9. Feature flags
-- ============================================================
insert into feature_flags (key, enabled, payload)
  values ('chargeback_auto_ban_threshold', true, '{"threshold": 2}')
  on conflict (key) do nothing;
