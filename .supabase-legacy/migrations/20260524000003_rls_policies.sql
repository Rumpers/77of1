-- OF-99: Comprehensive RLS policies — per-creator and per-fan isolation
-- Replaces the single `creator_row_isolation` policies in schema_v1 with
-- granular per-operation policies that enforce multi-tenant isolation.
--
-- Session variable contract (set by the application layer before every request):
--   app.current_creator_id  UUID of the authenticated creator (creator-facing requests)
--   app.current_fan_id      UUID of the authenticated fan   (fan-facing requests)
--
-- Service-role bypass: Supabase's service_role JWT has BYPASSRLS privilege and
-- skips ALL policies.  Backend workers MUST use the service_role client.
-- Browser / fan / creator clients MUST use the anon or authenticated key.
-- Unset or empty session variables yield NULL after nullif(), making every USING
-- predicate evaluate to (col = NULL) = false → default-deny.
--
-- Tables covered (all 10 canonical tables):
--   1. creators            2. fans               3. consent_grants
--   4. generation_jobs     5. creator_assets      6. usage_counters
--   7. fan_subscriptions   8. fan_credits         9. credit_transactions
--  10. audit_log
--
-- Run via: supabase db reset  (or supabase migration up)

-- ============================================================
-- 1. creators
--    Creator can SELECT/UPDATE their own row only.
--    No fan read access — fans interact via the API layer, not direct DB.
-- ============================================================

drop policy if exists creator_row_isolation   on creators;
drop policy if exists creator_self_select     on creators;
drop policy if exists creator_self_update     on creators;

create policy creator_self_select on creators
  for select
  using (id = nullif(current_setting('app.current_creator_id', true), '')::uuid);

create policy creator_self_update on creators
  for update
  using  (id = nullif(current_setting('app.current_creator_id', true), '')::uuid)
  with check (id = nullif(current_setting('app.current_creator_id', true), '')::uuid);

-- ============================================================
-- 2. fans
--    Fan sees their own row (by id).
--    Creator sees all fans subscribed to them (by creator_id).
--    Neither can delete — service_role handles lifecycle ops.
-- ============================================================

drop policy if exists creator_row_isolation on fans;
drop policy if exists creator_sees_fans     on fans;
drop policy if exists fan_self_select       on fans;

create policy creator_sees_fans on fans
  for select
  using (creator_id = nullif(current_setting('app.current_creator_id', true), '')::uuid);

create policy fan_self_select on fans
  for select
  using (id = nullif(current_setting('app.current_fan_id', true), '')::uuid);

-- ============================================================
-- 3. consent_grants
--    Creator SELECT / INSERT / UPDATE where creator_id matches.
--    No fan read access — fans must never see consent state directly.
-- ============================================================

drop policy if exists creator_row_isolation on consent_grants;
drop policy if exists creator_select        on consent_grants;
drop policy if exists creator_insert        on consent_grants;
drop policy if exists creator_update        on consent_grants;

create policy creator_select on consent_grants
  for select
  using (creator_id = nullif(current_setting('app.current_creator_id', true), '')::uuid);

create policy creator_insert on consent_grants
  for insert
  with check (creator_id = nullif(current_setting('app.current_creator_id', true), '')::uuid);

create policy creator_update on consent_grants
  for update
  using  (creator_id = nullif(current_setting('app.current_creator_id', true), '')::uuid)
  with check (creator_id = nullif(current_setting('app.current_creator_id', true), '')::uuid);

-- ============================================================
-- 4. generation_jobs
--    Creator SELECT: monitor their jobs.
--    Fan SELECT: track their own request status.
--    INSERT / UPDATE: service_role only (via BYPASSRLS).
-- ============================================================

drop policy if exists creator_row_isolation on generation_jobs;
drop policy if exists creator_select        on generation_jobs;
drop policy if exists fan_self_select       on generation_jobs;

create policy creator_select on generation_jobs
  for select
  using (creator_id = nullif(current_setting('app.current_creator_id', true), '')::uuid);

create policy fan_self_select on generation_jobs
  for select
  using (fan_id = nullif(current_setting('app.current_fan_id', true), '')::uuid);

-- ============================================================
-- 5. creator_assets
--    Creator SELECT / INSERT where creator_id matches.
--    Fan has no access (no fan policy = default-deny).
--    consent_status='pending' blocks AI processing: the AI worker
--    must run a consent check at application level before using an
--    asset; this policy ensures fan/anonymous contexts never see
--    any assets regardless of consent_status.
-- ============================================================

drop policy if exists creator_row_isolation on creator_assets;
drop policy if exists creator_select        on creator_assets;
drop policy if exists creator_insert        on creator_assets;

create policy creator_select on creator_assets
  for select
  using (creator_id = nullif(current_setting('app.current_creator_id', true), '')::uuid);

create policy creator_insert on creator_assets
  for insert
  with check (creator_id = nullif(current_setting('app.current_creator_id', true), '')::uuid);

-- ============================================================
-- 6. usage_counters
--    Creator SELECT: see all their fans' counters.
--    Fan SELECT: see their own counter row.
--    INSERT / UPDATE: service_role only (upserted by the billing engine).
-- ============================================================

drop policy if exists creator_row_isolation  on usage_counters;
drop policy if exists creator_sees_counters  on usage_counters;
drop policy if exists fan_self_select        on usage_counters;

create policy creator_sees_counters on usage_counters
  for select
  using (creator_id = nullif(current_setting('app.current_creator_id', true), '')::uuid);

create policy fan_self_select on usage_counters
  for select
  using (fan_id = nullif(current_setting('app.current_fan_id', true), '')::uuid);

-- ============================================================
-- 7. fan_subscriptions
--    Fan sees their own subscription rows.
--    Creator sees all subscriptions for their fans.
--    Writes: service_role only.
-- ============================================================

drop policy if exists creator_row_isolation on fan_subscriptions;
drop policy if exists creator_sees_subs     on fan_subscriptions;
drop policy if exists fan_self_select       on fan_subscriptions;

create policy creator_sees_subs on fan_subscriptions
  for select
  using (creator_id = nullif(current_setting('app.current_creator_id', true), '')::uuid);

create policy fan_self_select on fan_subscriptions
  for select
  using (fan_id = nullif(current_setting('app.current_fan_id', true), '')::uuid);

-- ============================================================
-- 8. fan_credits
--    Fan sees their own balance row.
--    Creator sees all credit rows for their fans.
--    INSERT / UPDATE: service_role only (atomic via deduct_credits or webhook).
-- ============================================================

drop policy if exists creator_row_isolation on fan_credits;
drop policy if exists creator_sees_credits  on fan_credits;
drop policy if exists fan_self_select       on fan_credits;

create policy creator_sees_credits on fan_credits
  for select
  using (creator_id = nullif(current_setting('app.current_creator_id', true), '')::uuid);

create policy fan_self_select on fan_credits
  for select
  using (fan_id = nullif(current_setting('app.current_fan_id', true), '')::uuid);

-- ============================================================
-- 9. credit_transactions
--    Fan sees their own transactions.
--    Creator sees transactions for their fans.
--    INSERT: service_role only (written atomically during purchase / deduction).
-- ============================================================

drop policy if exists creator_row_isolation on credit_transactions;
drop policy if exists creator_sees_txns     on credit_transactions;
drop policy if exists fan_self_select       on credit_transactions;

create policy creator_sees_txns on credit_transactions
  for select
  using (creator_id = nullif(current_setting('app.current_creator_id', true), '')::uuid);

create policy fan_self_select on credit_transactions
  for select
  using (fan_id = nullif(current_setting('app.current_fan_id', true), '')::uuid);

-- ============================================================
-- 10. audit_log
--     Append-only event log.
--     SELECT: creator sees their own events; fan sees none.
--     INSERT: service_role only (via BYPASSRLS) — no client INSERT policy.
--     UPDATE / DELETE: NOBODY (absence of policy = default-deny).
--
--     Replaces the open audit_log_select (USING true) and
--     audit_log_insert (WITH CHECK true) policies from schema_v1.
-- ============================================================

drop policy if exists audit_log_select on audit_log;
drop policy if exists audit_log_insert on audit_log;
drop policy if exists creator_select   on audit_log;

create policy creator_select on audit_log
  for select
  using (creator_id = nullif(current_setting('app.current_creator_id', true), '')::uuid);

-- No INSERT policy for anon/authenticated — service_role uses BYPASSRLS.
-- No UPDATE or DELETE policy — append-only enforced by policy absence.
