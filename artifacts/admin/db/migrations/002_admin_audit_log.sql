-- Admin DB migration 002: admin_audit_log table
-- Append-only. The app DB user (admin_app) has INSERT-only grants — no UPDATE/DELETE.
-- §8.3 requires every mutating action + PII read signed and retained ≥ 12 months.

create extension if not exists "pgcrypto";

create type if not exists audit_action as enum (
  'VIEW_FAN_PII',
  'REFUND_APPROVE',
  'REFUND_DENY',
  'KYC_APPROVE',
  'CONTENT_OVERRIDE',
  'DSAR_OPEN',
  'PAYOUT_APPROVE',
  'STAFF_ROLE_CHANGE',
  'SYSTEM_CONFIG_CHANGE'
);

create table if not exists admin_audit_log (
  id            uuid         primary key default gen_random_uuid(),
  actor_id      uuid         not null references staff_users(id),
  actor_email   text         not null,
  action        audit_action not null,
  resource_type text         not null,
  resource_id   text         not null,
  justification text,
  payload_hmac  text         not null,
  metadata      jsonb        not null default '{}',
  created_at    timestamptz  not null default now()
);

create index if not exists audit_log_actor_id_idx on admin_audit_log (actor_id);
create index if not exists audit_log_created_at_idx on admin_audit_log (created_at);
create index if not exists audit_log_action_idx on admin_audit_log (action);

-- INSERT-only grant for the application DB user.
-- The app DB user must be created separately; substitute the correct role name.
-- Only the DB superuser can UPDATE/DELETE rows.
do $$
begin
  if not exists (
    select 1 from pg_roles where rolname = 'admin_app'
  ) then
    create role admin_app login;
  end if;
end $$;

revoke all on admin_audit_log from admin_app;
grant insert on admin_audit_log to admin_app;
grant select on admin_audit_log to admin_app;
grant usage on schema public to admin_app;
grant select on staff_users to admin_app;
grant insert on staff_users to admin_app;
grant update on staff_users to admin_app;

-- Prevent UPDATE and DELETE on audit_log even by admin_app.
-- These are revoked explicitly above; add a rule for belt-and-suspenders.
create rule no_update_audit_log as on update to admin_audit_log do instead nothing;
create rule no_delete_audit_log as on delete to admin_audit_log do instead nothing;
