-- ============================================================
-- fan_reports
-- Stores fan-submitted reports of AI twin responses.
-- Auto-pauses creator when threshold hit (>= 5 pending in 24h).
-- ============================================================

create table if not exists fan_reports (
  id             uuid        primary key default gen_random_uuid(),
  creator_id     uuid        references creators(id) on delete cascade,
  fan_id         uuid        references fans(id) on delete set null,
  message_id     text        not null,
  category       text        not null
                               check (category in ('off_topic', 'abusive', 'inappropriate', 'fraud')),
  message_text   text,
  locale         text        not null default 'en',
  status         text        not null default 'pending'
                               check (status in ('pending', 'reviewed', 'dismissed', 'escalated')),
  reviewer_notes text,
  created_at     timestamptz not null default now(),
  reviewed_at    timestamptz
);

create index if not exists fan_reports_creator_id_idx  on fan_reports (creator_id);
create index if not exists fan_reports_status_idx      on fan_reports (status);
create index if not exists fan_reports_created_at_idx  on fan_reports (created_at desc);

alter table fan_reports enable row level security;

-- Service role only — no fan or creator direct access
create policy fan_reports_service_only on fan_reports
  using (false)
  with check (false);

-- ============================================================
-- Auto-pause trigger: suspend creator if >= 5 pending reports
-- in a rolling 24-hour window.
-- ============================================================

create or replace function check_creator_report_threshold()
returns trigger language plpgsql security definer as $$
declare
  pending_count integer;
begin
  if new.creator_id is null then
    return new;
  end if;

  select count(*) into pending_count
  from fan_reports
  where creator_id = new.creator_id
    and status = 'pending'
    and created_at >= now() - interval '24 hours';

  if pending_count >= 5 then
    update creators
    set config = jsonb_set(
      coalesce(config, '{}'),
      '{twin_suspended}',
      'true'
    )
    where id = new.creator_id
      and (config->>'twin_suspended') is distinct from 'true';
  end if;

  return new;
end;
$$;

create trigger fan_report_threshold_check
  after insert on fan_reports
  for each row execute function check_creator_report_threshold();
