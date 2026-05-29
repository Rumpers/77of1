-- Creator KYC / onboarding gate  (OF-124)
-- Adds creator_kyc table. Idempotent.

create table if not exists creator_kyc (
  id                           uuid        primary key default gen_random_uuid(),
  creator_id                   uuid        not null references creators(id) on delete cascade,

  -- Overall gate status
  status                       text        not null default 'pending'
                                 check (status in (
                                   'pending',           -- no action taken yet
                                   'id_submitted',      -- ID doc uploaded, awaiting ops verification
                                   'id_verified',       -- ops confirmed identity
                                   'signing_initiated', -- SignWell personality-rights link sent to creator
                                   'rights_signed',     -- creator signed the personality-rights doc
                                   'tax_submitted',     -- tax form uploaded
                                   'ops_approved',      -- ops signed off on full packet
                                   'complete',          -- all gates cleared; twin production may proceed
                                   'rejected'           -- ops rejected; see ops_notes
                                 )),

  -- Identity document
  id_doc_type                  text,                   -- 'passport' | 'national_id' | 'drivers_license'
  id_doc_region                text,                   -- ISO 3166-1 alpha-2: 'JP' | 'TW' | 'HK' | 'SG' ...
  id_doc_storage_path          text,                   -- encrypted Supabase Storage path
  id_doc_submitted_at          timestamptz,

  -- Personality-rights e-signature (SignWell)
  signwell_doc_id              text        unique,     -- SignWell document ID
  signwell_signing_url         text,                   -- one-time signing URL for creator
  signwell_status              text,                   -- 'pending' | 'signed' | 'declined'
  personality_rights_signed_at timestamptz,
  personality_rights_ip_hash   text,                   -- SHA-256 of creator IP at time of signing event

  -- Tax form (§HID-062 — separate child issue)
  tax_form_type                text,                   -- 'W9' | 'W8BEN' | 'W8BENE'
  tax_form_storage_path        text,
  tax_form_submitted_at        timestamptz,

  -- Ops review queue
  ops_notes                    text,
  ops_reviewed_by              text,                   -- ops user identifier (Replit user ID)
  ops_reviewed_at              timestamptz,

  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now(),

  unique (creator_id)
);

create index if not exists creator_kyc_status_idx
  on creator_kyc (status, created_at desc);

alter table creator_kyc enable row level security;

-- Creators can read and write their own KYC row
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'creator_kyc' and policyname = 'creator_own_kyc'
  ) then
    create policy creator_own_kyc on creator_kyc
      using (creator_id = current_setting('app.current_creator_id', true)::uuid)
      with check (creator_id = current_setting('app.current_creator_id', true)::uuid);
  end if;
end $$;

-- Service role bypasses RLS (used by server-side ops routes and webhooks)
-- No additional policy needed — supabase service_role key bypasses RLS automatically.

-- Updated-at trigger (reuse pattern from schema_v1)
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ begin
  if not exists (
    select 1 from information_schema.triggers
    where trigger_name = 'creator_kyc_updated_at'
  ) then
    create trigger creator_kyc_updated_at
      before update on creator_kyc
      for each row execute procedure set_updated_at();
  end if;
end $$;
