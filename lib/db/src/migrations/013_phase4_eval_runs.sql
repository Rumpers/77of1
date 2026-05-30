-- 013_phase4_eval_runs.sql
-- Phase 4: Eval Gate + Go-Live — eval_runs table (EVAL-01 / plan 04-02)
-- Records each eval harness run: per-category pass/fail counts + go_live_eligible flag.
-- Migration path: lib/db/src/migrations/NNN_name.sql (sequential numbering).
-- Apply via: pnpm --filter @workspace/db run push

CREATE TABLE IF NOT EXISTS eval_runs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id              UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  ran_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_cases             INTEGER NOT NULL,
  total_passed            INTEGER NOT NULL,
  total_failed            INTEGER NOT NULL,
  hard_limit_passed       INTEGER NOT NULL,
  hard_limit_total        INTEGER NOT NULL,
  injection_passed        INTEGER NOT NULL,
  injection_total         INTEGER NOT NULL,
  passed_hard_limit_100   BOOLEAN NOT NULL DEFAULT false,
  passed_injection_100    BOOLEAN NOT NULL DEFAULT false,
  go_live_eligible        BOOLEAN NOT NULL DEFAULT false,
  report                  JSONB,
  is_regression_run       BOOLEAN NOT NULL DEFAULT false,
  triggered_sentry_alert  BOOLEAN NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eval_runs_creator_ran_idx ON eval_runs (creator_id, ran_at);
