-- OF-117 / HID-004: Fan account recovery tables
-- Supports backup-contact recovery (email/phone) and ID-attested recovery for fans with credits.
-- Fraud-flag: rapid recovery + immediate credit liquidation triggers manual review hold.

create table if not exists fan_recovery_requests (
  id                  uuid        primary key default gen_random_uuid(),
  fan_id              uuid        references fan_accounts(id),  -- null if fan can't auth at all
  account_email       text        not null,
  method              text        not null check (method in (
                                    'backup_email', 'backup_phone', 'id_attestation', 'support'
                                  )),
  status              text        not null default 'pending' check (status in (
                                    'pending', 'otp_sent', 'otp_verified',
                                    'under_review', 'approved', 'denied', 'expired'
                                  )),
  -- Backup-contact fields
  backup_contact      text,
  otp_hash            text,
  otp_attempts        int         not null default 0,
  -- ID-attestation fields
  full_name           text,
  date_of_birth       date,
  id_document_key     text,       -- GCS/R2 object key; deleted after review
  id_document_deleted boolean     not null default false,
  -- Fraud signal
  fraud_hold          boolean     not null default false,
  -- Review
  reviewer_id         text,
  reviewer_note       text,
  -- Timestamps
  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null default now() + interval '24 hours',
  resolved_at         timestamptz
);

create index if not exists fan_recovery_requests_active_idx
  on fan_recovery_requests (status, created_at)
  where status not in ('approved', 'denied', 'expired');

create index if not exists fan_recovery_requests_account_email_idx
  on fan_recovery_requests (account_email);

alter table fan_recovery_requests enable row level security;
-- Service role only; no user-facing RLS (access is pre-auth)

-- Audit log for fan recovery events
create table if not exists fan_recovery_audit_log (
  id              uuid        primary key default gen_random_uuid(),
  request_id      uuid        references fan_recovery_requests(id),
  fan_id          uuid,
  event_type      text        not null check (event_type in (
                                'recovery_initiated', 'otp_sent', 'otp_verified', 'otp_failed',
                                'id_submitted', 'review_opened', 'review_approved',
                                'review_denied', 'session_relinked', 'fraud_hold_applied',
                                'fraud_hold_lifted', 'id_document_deleted'
                              )),
  actor_id        text,       -- staff user id or 'system'
  ip_address      inet,
  metadata        jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists fan_recovery_audit_log_request_idx
  on fan_recovery_audit_log (request_id, created_at desc);

alter table fan_recovery_audit_log enable row level security;

-- Fraud detection: flag requests where a credit-liquidation action occurs
-- within 1 hour of recovery approval. Checked by the credits service on
-- send-tip / purchase actions; fan_recovery_requests.fraud_hold must be
-- false before allowing liquidation.
comment on column fan_recovery_requests.fraud_hold is
  'Set true by credits service when rapid recovery + immediate liquidation pattern detected. '
  'Blocks send-tip and credit-purchase until manually cleared by support.';
