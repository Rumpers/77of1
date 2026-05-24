-- OF-13 / ADR-011: record which consent grant version was active at generation time
-- Allows audit of stale-grant rejections without re-querying consent_grants

alter table generation_jobs
  add column if not exists consent_grant_version int not null default 1;
