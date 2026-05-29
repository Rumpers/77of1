-- OF-159: refund_requests table + indexes + RLS
-- Parent: OF-122 (Manual refund review queue)
--
-- RLS contract:
--   service_role (BYPASSRLS) handles all INSERT/UPDATE via backend workers.
--   anon/authenticated clients cannot read or write this table.
--   Creators can SELECT their own refund requests.
--   No DELETE policy — append-only; status transitions are audited.

create table if not exists refund_requests (
  id                     uuid           primary key default gen_random_uuid(),
  creator_id             uuid           not null references creators(id),
  fan_id                 uuid           not null references fans(id),
  amount_credits         int            not null,
  amount_usd             numeric(10,2),
  reason_category        text           not null
    check (reason_category in ('unused_credits','service_quality','unauthorized','billing_error','other')),
  description            text,
  evidence_transcript    text,
  status                 text           not null default 'pending'
    check (status in ('pending','approved','denied','partial')),
  decided_by             text,
  decision_reason_code   text
    check (decision_reason_code in ('goodwill_7day','policy_exception','duplicate','out_of_policy','fraud_suspected','other')),
  decision_notes         text,
  partial_amount_credits int,
  stripe_refund_id       text,
  sla_deadline_at        timestamptz    not null default (now() + interval '72 hours'),
  notified_at            timestamptz,
  created_at             timestamptz    not null default now(),
  updated_at             timestamptz    not null default now()
);

create index if not exists idx_refund_requests_creator_id
  on refund_requests (creator_id);

create index if not exists idx_refund_requests_fan_id
  on refund_requests (fan_id);

create index if not exists idx_refund_requests_status
  on refund_requests (status);

create index if not exists idx_refund_requests_sla
  on refund_requests (sla_deadline_at)
  where status = 'pending';

alter table refund_requests enable row level security;

-- Creators may view their own refund requests.
-- service_role uses BYPASSRLS and skips all policies for writes.
-- No fan read policy → default-deny for fan clients.
-- No INSERT/UPDATE policy → default-deny for all non-service_role clients.
-- No DELETE policy → table is append-only; status transitions only.

drop policy if exists creator_select on refund_requests;

create policy creator_select on refund_requests
  for select
  using (creator_id = nullif(current_setting('app.current_creator_id', true), '')::uuid);
