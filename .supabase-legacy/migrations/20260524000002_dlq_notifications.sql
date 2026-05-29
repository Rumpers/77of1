-- OF-105: DLQ status + creator notification table (Slice 2.3)
-- Adds 'dlq' to generation_jobs.status and a lightweight polling table
-- so the creator dashboard can surface persistent job failures within 2 min (PRD §16).

-- 1. Extend generation_jobs.status to include 'dlq'
alter table generation_jobs drop constraint if exists generation_jobs_status_check;
alter table generation_jobs
  add constraint generation_jobs_status_check
  check (status in ('queued', 'processing', 'done', 'failed', 'cancelled', 'dlq'));

-- Index for DLQ dashboard queries: "all failed jobs for this creator"
create index if not exists generation_jobs_dlq_creator_idx
  on generation_jobs (creator_id, created_at desc)
  where status = 'dlq';

-- 2. creator_notifications: per-creator DLQ alert flag (Slice 2.3 stub)
--    Full Hermes push notification is Slice 4.  Dashboard polls
--    GET /api/creator/notifications which reads has_dlq_jobs.
create table if not exists creator_notifications (
  creator_id   uuid        not null references creators(id) on delete cascade,
  has_dlq_jobs boolean     not null default false,
  last_dlq_at  timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (creator_id)
);

create index if not exists creator_notifications_has_dlq_idx
  on creator_notifications (creator_id)
  where has_dlq_jobs = true;

alter table creator_notifications enable row level security;

create policy creator_self_select on creator_notifications
  for select
  using (creator_id = nullif(current_setting('app.current_creator_id', true), '')::uuid);

create policy creator_self_update on creator_notifications
  for update
  using  (creator_id = nullif(current_setting('app.current_creator_id', true), '')::uuid)
  with check (creator_id = nullif(current_setting('app.current_creator_id', true), '')::uuid);
