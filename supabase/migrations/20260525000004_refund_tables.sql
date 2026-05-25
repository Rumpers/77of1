-- HID-011-A: refund_requests + refund_decisions tables
-- OF-182 — manual refund review queue (§10.9 goodwill / technical / policy refunds)
-- FK targets: fans (fan_id), creators (creator_id), staff_users (decided_by_staff_id)

-- ============================================================
-- Enum types
-- ============================================================
do $$ begin
  create type refund_reason_category as enum (
    'goodwill_7day',
    'technical_failure',
    'creator_no_show',
    'duplicate_charge',
    'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type refund_inbound_channel as enum (
    'web_form',
    'email'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type refund_status as enum (
    'pending',
    'approved',
    'partially_approved',
    'denied',
    'processing',
    'done',
    'failed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type refund_decision_outcome as enum (
    'approved',
    'partially_approved',
    'denied'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type refund_reason_code as enum (
    'policy_goodwill',
    'policy_technical',
    'policy_no_show',
    'policy_duplicate',
    'policy_other',
    'abuse_suspected',
    'outside_window',
    'already_refunded'
  );
exception when duplicate_object then null; end $$;

-- ============================================================
-- staff_users
-- Internal staff accounts that action refund decisions.
-- Minimal — extended by identity/auth work later.
-- ============================================================
create table if not exists staff_users (
  id         uuid        primary key default gen_random_uuid(),
  email      text        not null unique,
  name       text        not null,
  role       text        not null default 'support'
               check (role in ('support', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- refund_requests
-- One row per fan-initiated refund request.
-- sla_deadline_at auto-set to created_at + 72h via trigger.
-- ============================================================
create table if not exists refund_requests (
  id                        uuid                    primary key default gen_random_uuid(),
  fan_id                    uuid                    not null references fans(id),
  creator_id                uuid                    not null references creators(id),
  stripe_payment_intent_id  text                    not null,
  credit_pack_id            uuid,
  amount_credits            integer                 not null,
  amount_cents              integer                 not null,
  currency                  text                    not null
                              check (currency in ('jpy', 'twd', 'usd')),
  reason_category           refund_reason_category  not null,
  fan_notes                 text,
  transcript_excerpt        text,
  inbound_channel           refund_inbound_channel  not null,
  status                    refund_status           not null default 'pending',
  sla_deadline_at           timestamptz             not null,
  created_at                timestamptz             not null default now(),
  updated_at                timestamptz             not null default now()
);

create index if not exists refund_requests_status_created_idx
  on refund_requests (status, created_at);

create index if not exists refund_requests_sla_deadline_idx
  on refund_requests (sla_deadline_at);

create index if not exists refund_requests_fan_id_idx
  on refund_requests (fan_id);

create index if not exists refund_requests_creator_id_idx
  on refund_requests (creator_id);

-- Auto-set sla_deadline_at = created_at + 72 hours on INSERT
create or replace function trg_refund_request_set_sla()
returns trigger language plpgsql as $$
begin
  new.sla_deadline_at := new.created_at + interval '72 hours';
  return new;
end;
$$;

drop trigger if exists refund_request_set_sla on refund_requests;
create trigger refund_request_set_sla
  before insert on refund_requests
  for each row execute function trg_refund_request_set_sla();

-- Auto-update updated_at on row change
create or replace function trg_refund_request_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists refund_request_updated_at on refund_requests;
create trigger refund_request_updated_at
  before update on refund_requests
  for each row execute function trg_refund_request_updated_at();

alter table refund_requests enable row level security;

-- Staff access: unrestricted (no creator isolation — refunds are cross-creator ops)
-- Fan-facing read: own requests only
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'refund_requests' and policyname = 'refund_requests_creator_isolation'
  ) then
    create policy refund_requests_creator_isolation on refund_requests
      using (creator_id = current_setting('app.current_creator_id', true)::uuid);
  end if;
end $$;

-- ============================================================
-- refund_decisions
-- One decision per refund request (staff outcome record).
-- ============================================================
create table if not exists refund_decisions (
  id                    uuid                     primary key default gen_random_uuid(),
  refund_request_id     uuid                     not null references refund_requests(id),
  decided_by_staff_id   uuid                     not null references staff_users(id),
  decision              refund_decision_outcome  not null,
  reason_code           refund_reason_code       not null,
  refund_amount_cents   integer,
  stripe_refund_id      text,
  staff_notes           text,
  fan_message           text,
  notified_at           timestamptz,
  decided_at            timestamptz              not null default now()
);

create index if not exists refund_decisions_request_id_idx
  on refund_decisions (refund_request_id);

create index if not exists refund_decisions_staff_id_idx
  on refund_decisions (decided_by_staff_id);

alter table refund_decisions enable row level security;

-- Staff ops are performed outside fan RLS context; no creator-scoped policy here.
-- Select open for audit/reporting.
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'refund_decisions' and policyname = 'refund_decisions_select'
  ) then
    create policy refund_decisions_select on refund_decisions
      for select using (true);
  end if;
end $$;
