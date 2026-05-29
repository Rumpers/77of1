-- OF-99 RLS isolation test suite
--
-- Verifies multi-tenant isolation at the database layer.
-- Requires a role without BYPASSRLS privilege.  The test creates
-- `test_rls_user` for that purpose and drops it on exit.
--
-- Usage (against a local Supabase instance or dev PostgreSQL):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_isolation_test.sql
--
-- All data is inserted and rolled back within a single transaction.
-- The test role itself is created/dropped outside the transaction
-- (DDL on roles is non-transactional in PostgreSQL).

-- ── Pre-flight: create test role ─────────────────────────────────────────────
do $$
begin
  if not exists (select from pg_roles where rolname = 'test_rls_user') then
    execute 'create role test_rls_user nologin';
  end if;
end
$$;

grant usage  on schema public                    to test_rls_user;
grant select, insert, update, delete
      on all tables in schema public             to test_rls_user;
grant execute on all functions in schema public  to test_rls_user;

-- ── Transaction: all data changes are rolled back at the end ─────────────────
begin;

-- Seed: two creators
insert into creators (id, handle, display_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'creator-a', 'Creator A'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'creator-b', 'Creator B');

-- Seed: consent grants for each creator
insert into consent_grants (id, creator_id, modality, version) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'text',  1),
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'voice', 1);

-- Seed: one fan per creator
insert into fans (id, creator_id, locale, tier, age_verified) values
  ('ffffffff-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'en', 'subscriber', true),
  ('ffffffff-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'en', 'free',       false);

-- Seed: fan credits
insert into fan_credits (fan_id, creator_id, balance) values
  ('ffffffff-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 50),
  ('ffffffff-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 0);

-- Seed: one audit_log event per creator (inserted as superuser = BYPASSRLS)
insert into audit_log (id, creator_id, fan_id, event_type, payload) values
  ('eeeeeeee-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000001',
   'ffffffff-0000-0000-0000-000000000001',
   'consent_granted', '{}'),
  ('eeeeeeee-0000-0000-0000-000000000002',
   'aaaaaaaa-0000-0000-0000-000000000002',
   'ffffffff-0000-0000-0000-000000000002',
   'consent_granted', '{}');

-- ── Test 1: Creator A cannot see Creator B's data ────────────────────────────
set local role test_rls_user;
set local app.current_creator_id = 'aaaaaaaa-0000-0000-0000-000000000001';
set local app.current_fan_id     = '';

do $$
declare cnt int;
begin
  -- Should see only Creator A's consent grant
  select count(*) into cnt from consent_grants;
  assert cnt = 1,
    format('T1a FAIL: expected 1 consent_grant for Creator A, got %s', cnt);

  -- Creator B's grant must be invisible
  select count(*) into cnt
  from consent_grants
  where creator_id = 'aaaaaaaa-0000-0000-0000-000000000002';
  assert cnt = 0,
    format('T1b FAIL: Creator A must not see Creator B consent_grants, got %s', cnt);

  raise notice 'PASS T1: Creator A cannot see Creator B consent_grants';
end
$$;

reset role;

-- ── Test 2: Fan cannot read consent_grants ───────────────────────────────────
set local role test_rls_user;
set local app.current_creator_id = '';
set local app.current_fan_id     = 'ffffffff-0000-0000-0000-000000000001';

do $$
declare cnt int;
begin
  select count(*) into cnt from consent_grants;
  assert cnt = 0,
    format('T2 FAIL: Fan must not read consent_grants, got %s', cnt);
  raise notice 'PASS T2: Fan cannot read consent_grants';
end
$$;

reset role;

-- ── Test 3: Creator row isolation ────────────────────────────────────────────
set local role test_rls_user;
set local app.current_creator_id = 'aaaaaaaa-0000-0000-0000-000000000001';
set local app.current_fan_id     = '';

do $$
declare cnt int;
begin
  select count(*) into cnt
  from creators
  where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  assert cnt = 1,
    format('T3a FAIL: Creator A must see their own row, got %s', cnt);

  select count(*) into cnt
  from creators
  where id = 'aaaaaaaa-0000-0000-0000-000000000002';
  assert cnt = 0,
    format('T3b FAIL: Creator A must not see Creator B row, got %s', cnt);

  raise notice 'PASS T3: Creator row isolation on creators table';
end
$$;

reset role;

-- ── Test 4: Fan self-select on fans table ────────────────────────────────────
set local role test_rls_user;
set local app.current_creator_id = '';
set local app.current_fan_id     = 'ffffffff-0000-0000-0000-000000000001';

do $$
declare cnt int;
begin
  -- Fan 1 sees only their own row
  select count(*) into cnt from fans;
  assert cnt = 1,
    format('T4a FAIL: Fan 1 should see 1 row in fans, got %s', cnt);

  -- Fan 1 does NOT see Fan 2's row
  select count(*) into cnt
  from fans
  where id = 'ffffffff-0000-0000-0000-000000000002';
  assert cnt = 0,
    format('T4b FAIL: Fan 1 must not see Fan 2 row, got %s', cnt);

  raise notice 'PASS T4: Fan self-select isolation on fans table';
end
$$;

reset role;

-- ── Test 5: Creator sees their fans; not another creator's fans ──────────────
set local role test_rls_user;
set local app.current_creator_id = 'aaaaaaaa-0000-0000-0000-000000000001';
set local app.current_fan_id     = '';

do $$
declare cnt int;
begin
  -- Creator A sees their fan
  select count(*) into cnt
  from fans
  where creator_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  assert cnt = 1,
    format('T5a FAIL: Creator A should see their fan, got %s', cnt);

  -- Creator A does NOT see Creator B's fan
  select count(*) into cnt
  from fans
  where creator_id = 'aaaaaaaa-0000-0000-0000-000000000002';
  assert cnt = 0,
    format('T5b FAIL: Creator A must not see Creator B fans, got %s', cnt);

  raise notice 'PASS T5: Creator sees own fans only';
end
$$;

reset role;

-- ── Test 6: Fan cannot read creator_assets ───────────────────────────────────
set local role test_rls_user;
set local app.current_creator_id = '';
set local app.current_fan_id     = 'ffffffff-0000-0000-0000-000000000001';

do $$
declare cnt int;
begin
  select count(*) into cnt from creator_assets;
  assert cnt = 0,
    format('T6 FAIL: Fan must not read creator_assets, got %s', cnt);
  raise notice 'PASS T6: Fan cannot read creator_assets';
end
$$;

reset role;

-- ── Test 7: Fan self-select on fan_credits ───────────────────────────────────
set local role test_rls_user;
set local app.current_creator_id = '';
set local app.current_fan_id     = 'ffffffff-0000-0000-0000-000000000001';

do $$
declare cnt int;
begin
  -- Fan 1 sees their own credit row
  select count(*) into cnt from fan_credits;
  assert cnt = 1,
    format('T7a FAIL: Fan 1 should see their credit row, got %s', cnt);

  -- Fan 1 does NOT see Fan 2's credit row
  select count(*) into cnt
  from fan_credits
  where fan_id = 'ffffffff-0000-0000-0000-000000000002';
  assert cnt = 0,
    format('T7b FAIL: Fan 1 must not see Fan 2 credits, got %s', cnt);

  raise notice 'PASS T7: Fan self-select on fan_credits';
end
$$;

reset role;

-- ── Test 8: Creator sees fan_credits; fan cannot see creator's other fans ────
set local role test_rls_user;
set local app.current_creator_id = 'aaaaaaaa-0000-0000-0000-000000000001';
set local app.current_fan_id     = '';

do $$
declare cnt int;
begin
  select count(*) into cnt
  from fan_credits
  where creator_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  assert cnt = 1,
    format('T8a FAIL: Creator A should see their fan credit row, got %s', cnt);

  select count(*) into cnt
  from fan_credits
  where creator_id = 'aaaaaaaa-0000-0000-0000-000000000002';
  assert cnt = 0,
    format('T8b FAIL: Creator A must not see Creator B fan credits, got %s', cnt);

  raise notice 'PASS T8: Creator sees own fans credits only';
end
$$;

reset role;

-- ── Test 9: Service-role INSERT to audit_log succeeds ────────────────────────
-- (Runs as superuser / BYPASSRLS — simulates service_role client)

insert into audit_log (id, creator_id, fan_id, event_type, payload)
values (
  'eeeeeeee-0000-0000-0000-000000000099',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'ffffffff-0000-0000-0000-000000000001',
  'test_service_insert', '{}'
);

do $$
declare cnt int;
begin
  select count(*) into cnt
  from audit_log
  where id = 'eeeeeeee-0000-0000-0000-000000000099';
  assert cnt = 1, 'T9 FAIL: service INSERT to audit_log should succeed';
  raise notice 'PASS T9: service-role INSERT to audit_log succeeds';
end
$$;

-- ── Test 10: Non-service INSERT to audit_log is denied ───────────────────────
set local role test_rls_user;
set local app.current_creator_id = 'aaaaaaaa-0000-0000-0000-000000000001';
set local app.current_fan_id     = '';

do $$
begin
  begin
    insert into audit_log (creator_id, fan_id, event_type, payload)
    values (
      'aaaaaaaa-0000-0000-0000-000000000001',
      'ffffffff-0000-0000-0000-000000000001',
      'should_be_denied', '{}'
    );
    raise exception 'T10 FAIL: non-service INSERT to audit_log should have been denied';
  exception
    when insufficient_privilege or check_violation then
      raise notice 'PASS T10: non-service INSERT to audit_log denied';
  end;
end
$$;

reset role;

-- ── Test 11: Creator SELECT on audit_log (own events only) ───────────────────
set local role test_rls_user;
set local app.current_creator_id = 'aaaaaaaa-0000-0000-0000-000000000001';
set local app.current_fan_id     = '';

do $$
declare cnt int;
begin
  -- Creator A sees 2 rows: the seeded event + test 9 insert
  select count(*) into cnt from audit_log;
  assert cnt = 2,
    format('T11a FAIL: Creator A should see 2 audit rows, got %s', cnt);

  -- Creator B's event is invisible
  select count(*) into cnt
  from audit_log
  where creator_id = 'aaaaaaaa-0000-0000-0000-000000000002';
  assert cnt = 0,
    format('T11b FAIL: Creator A must not see Creator B audit events, got %s', cnt);

  raise notice 'PASS T11: Creator SELECT on audit_log is creator-scoped';
end
$$;

reset role;

-- ── Test 12: Fan cannot read audit_log ───────────────────────────────────────
set local role test_rls_user;
set local app.current_creator_id = '';
set local app.current_fan_id     = 'ffffffff-0000-0000-0000-000000000001';

do $$
declare cnt int;
begin
  select count(*) into cnt from audit_log;
  assert cnt = 0,
    format('T12 FAIL: Fan must not read audit_log, got %s', cnt);
  raise notice 'PASS T12: Fan cannot read audit_log';
end
$$;

reset role;

-- ── All tests passed — rollback seed data ────────────────────────────────────
rollback;

-- ── Teardown: drop test role ─────────────────────────────────────────────────
revoke all on all tables    in schema public from test_rls_user;
revoke all on all functions in schema public from test_rls_user;
revoke usage on schema public               from test_rls_user;
drop role if exists test_rls_user;

\echo 'All RLS isolation tests passed.'
