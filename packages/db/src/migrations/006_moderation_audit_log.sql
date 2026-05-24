-- OF-64: outbound moderation audit log
-- Every moderation call (pass or block) is recorded here.
-- Retention: 12+ months — no DELETE policy; do not add one without legal sign-off.

create table if not exists moderation_audit_log (
  id                 uuid        primary key default gen_random_uuid(),
  job_id             text        not null,
  creator_id         uuid        not null,
  fan_id             uuid        not null,
  language           text        not null check (language in ('en', 'ja', 'zh-TW')),
  provider           text        not null,   -- 'gmi' | 'azure'
  passed             boolean     not null,
  flagged_categories text[]      not null default '{}',
  confidence         double precision not null check (confidence >= 0 and confidence <= 1),
  latency_ms         integer     not null,
  text_sha256        text        not null,   -- SHA-256 of moderated text (not raw text)
  created_at         timestamptz not null default now()
);

-- Query patterns: filter by creator, time range, failures
create index moderation_audit_log_creator_created
  on moderation_audit_log (creator_id, created_at desc);

create index moderation_audit_log_blocked
  on moderation_audit_log (created_at desc)
  where not passed;

-- No RLS: audit log is service-side only, never fan-facing.
