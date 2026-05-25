-- Admin DB migration 001: staff_users table
-- Apply to the dedicated admin Cloud SQL Postgres instance (not the consumer Supabase DB).

create type if not exists staff_role as enum ('support', 'ops', 'engineering', 'finance');

create table if not exists staff_users (
  id         uuid        primary key default gen_random_uuid(),
  email      text        not null unique,
  role       staff_role  not null,
  created_at timestamptz not null default now()
);

create index if not exists staff_users_email_idx on staff_users (email);
