-- DSAR (Data Subject Access Request) table — §16 compliance
-- Fan: 30-day delivery window; Creator: 72-hour (3-day) delivery window
create table if not exists public.dsar_requests (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  role          text not null check (role in ('fan', 'creator')),
  request_type  text not null check (request_type in ('all', 'messages', 'account', 'creator_export')),
  locale        text not null default 'en',
  status        text not null default 'pending'
                  check (status in ('pending', 'processing', 'ready', 'delivered', 'failed')),
  eta_days      int not null,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

-- Index for staff dashboard queries by email and status
create index if not exists dsar_requests_email_idx on public.dsar_requests (email);
create index if not exists dsar_requests_status_idx on public.dsar_requests (status);

-- RLS: no direct fan/creator read access — fulfilled via signed download URLs by staff/automation
alter table public.dsar_requests enable row level security;

-- Allow the service role (backend) to read and write
create policy "service_role_full_access" on public.dsar_requests
  for all
  to service_role
  using (true)
  with check (true);
