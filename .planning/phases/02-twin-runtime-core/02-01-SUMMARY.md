---
phase: 02-twin-runtime-core
plan: 01
subsystem: infra
tags: [phase-2, infrastructure, env, vitest, package-audit, telegraf, fan-twin]

requires:
  - phase: 01-baseline-repair
    provides: api-server/config/env.ts (Supabase-required Zod schema), hermes (TELEGRAM_BOT_TOKEN reader), .replit (8080/22333/3001 port allocations)
provides:
  - Phase-2 ready env schema (Supabase removed, OPENAI + HMAC + LALA/FAN_TWIN tokens required)
  - Hermes bot reads renamed TELEGRAM_BOT_TOKEN_LALA env var (D-02-07)
  - fan-twin workspace package scaffold (package.json + tsconfig.json + build.mjs + vitest.config.ts + placeholder src/index.ts)
  - fan-twin port 3002 reserved atomically in .replit AND artifacts/fan-twin/.replit-artifact/artifact.toml
  - 10 RED test files (it.todo) for downstream Phase 2 plans (CHAT-01/03/04/06, MOD-01/03, COMPLY-01/02, I18N-02, ONBOARD-01)
  - @telegraf/session@2.0.0-beta.7 + pg@8.20.0 + telegraf@4.16.3 deps registered in fan-twin (install gated by founder legitimacy approval)
affects: [02-02, 02-03, 02-05, 02-06, 02-07, all-phase-02-plans]

tech-stack:
  added:
    - "@telegraf/session@2.0.0-beta.7 (founder-approved Wave 0 legitimacy gate)"
    - "pg@8.20.0 (for @telegraf/session/pg PostgreSQL adapter)"
    - "@types/pg@^8.11.10 (dev)"
    - "vitest@^3.2.3 (added to fan-twin devDeps)"
  patterns:
    - "Per-artifact .replit-artifact/artifact.toml shape (mirrors hermes layout)"
    - "RED test file convention: top-of-file comment naming REQ-ID + target plan, body uses it.todo() so suites run green"
    - "PATTERNS S7 applied: vi.mock(\"@workspace/db\", ...) header on every new unit test"

key-files:
  created:
    - artifacts/fan-twin/package.json
    - artifacts/fan-twin/tsconfig.json
    - artifacts/fan-twin/build.mjs
    - artifacts/fan-twin/vitest.config.ts
    - artifacts/fan-twin/src/index.ts
    - artifacts/fan-twin/.replit-artifact/artifact.toml
    - artifacts/api-server/src/__tests__/twin-chat.e2e.test.ts
    - artifacts/api-server/src/__tests__/hmac-conversation.test.ts
    - artifacts/api-server/src/__tests__/conversation-history.test.ts
    - artifacts/api-server/src/__tests__/moderation-l1.test.ts
    - artifacts/api-server/src/__tests__/moderation-l3.test.ts
    - artifacts/api-server/src/__tests__/disclosure-footer.test.ts
    - artifacts/api-server/src/__tests__/helpline-injection.test.ts
    - artifacts/api-server/src/__tests__/locale-detection.test.ts
    - artifacts/fan-twin/src/__tests__/webhook-ack.test.ts
    - artifacts/hermes/src/__tests__/persona-wizard.test.ts
  modified:
    - artifacts/api-server/src/config/env.ts (rewrite — Supabase out, Phase 2 vars in)
    - artifacts/hermes/src/index.ts (TELEGRAM_BOT_TOKEN → TELEGRAM_BOT_TOKEN_LALA)
    - .env.example (add FOUNDER_TELEGRAM_CHAT_ID)
    - .replit (add [[ports]] 3002)
    - pnpm-lock.yaml (record new fan-twin deps)

key-decisions:
  - "Founder approved @telegraf/session at exact version 2.0.0-beta.7 (matches RESEARCH expectation of ^2.0.0-beta.x as of 2026-05)."
  - "Fan-twin port is 3002 — no collision on .replit. Allocated to both .replit and per-artifact artifact.toml in one commit (Pitfall #9 atomic update)."
  - "Per D-02-14: i18next-http-middleware NOT installed; locale-detection.test.ts targets an inline detectLocale(req) helper to ship in 02-02."
  - "Per D-02-07: OPENAI_API_KEY and HMAC_CONVERSATION_SECRET (≥32 chars) promoted to required env vars at startup; api-server now fails fast if either is missing."
  - "Replit's per-artifact artifact.toml lives under artifacts/<name>/.replit-artifact/ (not at repo root). Plan referenced a single root artifact.toml but the actual layout uses one file per artifact — followed the existing convention."

patterns-established:
  - "RED test header: `// RED test for {REQ-ID} — will GREEN when plan 02-NN ships {feature}.` Every it.todo() row also references the target plan."
  - "fan-twin scaffold = verbatim hermes copy + renamed `name` field + extra deps (@telegraf/session, pg) — sets the template for any future artifact that needs Telegraf session persistence."

requirements-completed: []

duration: 13min
completed: 2026-05-28
---

# Phase 02 Plan 01: Wave 0 Unblock Summary

**Phase 2 prereqs unblocked: api-server boots without Supabase env vars, Hermes reads renamed TELEGRAM_BOT_TOKEN_LALA, fan-twin artifact scaffolded on port 3002, 10 RED test files staged for Waves 1+.**

## Performance

- **Duration:** 13 minutes
- **Started:** 2026-05-28T04:31:50Z
- **Completed:** 2026-05-28T04:44:55Z
- **Tasks:** 2 (Task 0 checkpoint resolved via founder approval message; Tasks 1–2 auto-executed)
- **Files modified:** 21 (16 created, 5 modified)

## Accomplishments

### Task 0 — @telegraf/session legitimacy verification (founder-resolved)
- Founder message of record: "approved — @telegraf/session: v2.0.0-beta.7"
- Mitigates T-02-01-01 (npm tampering) and T-02-01-SC (supply-chain) per plan threat register.
- Per D-02-14 the gate did NOT include i18next-http-middleware (dropped — inline detectLocale used instead).

### Task 1 — Env schema rewrite + Hermes token rename + fan-twin scaffold
- **`artifacts/api-server/src/config/env.ts` (rewrite):** removed `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Added `OPENAI_API_KEY` (required), `HMAC_CONVERSATION_SECRET` (required, ≥32 chars), `TELEGRAM_BOT_TOKEN_LALA` (required), `TELEGRAM_BOT_TOKEN_FAN_TWIN` (required), `FOUNDER_TELEGRAM_CHAT_ID` (optional). Preserved existing optional vars: REDIS_URL, GMI_API_BASE_URL, NEXT_PUBLIC_APP_URL, SENTRY_DSN, HELICONE_API_KEY, SAFETY_ALERT_WEBHOOK_URL, HEALTH_SECRET.
- **`artifacts/hermes/src/index.ts`:** renamed `process.env.TELEGRAM_BOT_TOKEN` → `process.env.TELEGRAM_BOT_TOKEN_LALA` and updated the throw message. Final grep state: 2 hits for `TELEGRAM_BOT_TOKEN_LALA`, 0 hits for bare `TELEGRAM_BOT_TOKEN[^_]`.
- **`.env.example`:** added `FOUNDER_TELEGRAM_CHAT_ID` entry. (LALA + FAN_TWIN token entries were already present from prior planning.)
- **`artifacts/fan-twin/`:** new workspace package. `package.json` declares `@telegraf/session@2.0.0-beta.7`, `pg@^8.20.0`, `telegraf@^4.16.3`, `@workspace/db@workspace:*`, plus vitest devDep. `tsconfig.json` + `build.mjs` copied verbatim from hermes. `vitest.config.ts` mirrors api-server. `src/index.ts` exports `FAN_TWIN_PLACEHOLDER = true` so tsc/vitest find a symbol to compile (real bot lands in plan 02-06).
- **Smoke tests run inline:**
  - ✓ Cold-start with no `SUPABASE_*` env: `env` parsed; HMAC_len=32; LALA token visible.
  - ✓ Missing `OPENAI_API_KEY`: schema throws ZodError naming `OPENAI_API_KEY`.
  - ✓ `HMAC_CONVERSATION_SECRET=short`: schema throws ZodError naming `HMAC_CONVERSATION_SECRET`.
- **Typecheck:** `pnpm --filter @workspace/fan-twin exec tsc --noEmit` → exit 0. `pnpm --filter @workspace/hermes exec tsc --noEmit` → exit 0.
- **Commit:** `c0f2bfa` (9 files, +213/-12)

### Task 2 — Fan-twin port 3002 + 10 RED test files
- **`.replit`:** added `[[ports]]` block mapping `localPort=3002` → `externalPort=3002`.
- **`artifacts/fan-twin/.replit-artifact/artifact.toml`:** new per-artifact manifest (`kind="api"`, `services localPort=3002`, `paths=["/fan-twin"]`, dev/prod commands mirroring hermes).
- **10 RED test files** created — each with a top-of-file `// RED test for {REQ-ID} — will GREEN when plan 02-NN ships {feature}` comment and only `it.todo()` bodies:
  | Test file | REQ-ID | Target plan |
  | --- | --- | --- |
  | `artifacts/api-server/src/__tests__/twin-chat.e2e.test.ts` | CHAT-01 | 02-03 |
  | `artifacts/api-server/src/__tests__/hmac-conversation.test.ts` | CHAT-03 | 02-02 |
  | `artifacts/api-server/src/__tests__/conversation-history.test.ts` | CHAT-04 | 02-02 |
  | `artifacts/api-server/src/__tests__/moderation-l1.test.ts` | MOD-01 | 02-05 |
  | `artifacts/api-server/src/__tests__/moderation-l3.test.ts` | MOD-03 | 02-05 |
  | `artifacts/api-server/src/__tests__/disclosure-footer.test.ts` | COMPLY-01 | 02-03 |
  | `artifacts/api-server/src/__tests__/helpline-injection.test.ts` | COMPLY-02 | 02-05 |
  | `artifacts/api-server/src/__tests__/locale-detection.test.ts` | I18N-02 | 02-02 |
  | `artifacts/fan-twin/src/__tests__/webhook-ack.test.ts` | CHAT-06 | 02-06 |
  | `artifacts/hermes/src/__tests__/persona-wizard.test.ts` | ONBOARD-01 | 02-07 |
- **vitest run on the 8 new api-server files:** 30 todos, 0 failures, 0 errors.
- **Commit:** `96049b6` (12 files, +246)

## Deviations from Plan

### [Rule 3 — Path discovery] Per-artifact `artifact.toml` layout, not a root file
- **Found during:** Task 2 (looking for `artifact.toml` per plan `<files>` list)
- **Issue:** The plan lists a single root `artifact.toml`. Repo actually uses one `artifact.toml` per artifact under `artifacts/<name>/.replit-artifact/` (confirmed via `find .` — five existing copies under api-server, hermes, worker, web, mockup-sandbox).
- **Fix:** Created `artifacts/fan-twin/.replit-artifact/artifact.toml` matching the existing per-artifact convention. Atomic port allocation invariant (Pitfall #9) is still honoured — port 3002 lives in both `.replit` AND the new per-artifact file, both staged in the same commit.
- **Files modified:** `artifacts/fan-twin/.replit-artifact/artifact.toml` (new), `.replit` (modified)
- **Commit:** `96049b6`

### [Rule 3 — Auth gate avoided] env.ts smoke test moved from `node -e` to `tsx -e`
- **Found during:** Task 1 verification
- **Issue:** Plan's `<verify>` block uses `node -e "require('./artifacts/api-server/dist/config/env.js')"`. There is no `dist/` (no build was run yet — Wave 0 deliberately avoids building because pre-existing TS6305 stale-dist errors on `lib/api-zod` and `lib/db` block the api-server build).
- **Fix:** Ran the same env-schema parse via `pnpm exec tsx -e "import('./src/config/env.ts').then(...)"` — equivalent behaviour, no build dependency.
- **Outcome:** All three required env-schema assertions (cold-start without Supabase / missing OPENAI / short HMAC) verified.

## Known Stubs

- `artifacts/fan-twin/src/index.ts` exports a single `FAN_TWIN_PLACEHOLDER = true` constant. Intentional — real Telegraf bot lives in plan 02-06 (CHAT-06 webhook handler). Documented in the file's leading comment.

## Deferred Issues (out of scope for this plan)

Logged separately in `.planning/phases/02-twin-runtime-core/deferred-items.md` if the founder wants them in Phase 2 backlog; otherwise these are pre-existing Phase 1 carryovers, not Wave 0 regressions:

- **api-server typecheck:** TS6305 errors for `lib/api-zod/dist/index.d.ts` and `lib/db/dist/index.d.ts` (stale build artefacts; `pnpm --filter @workspace/api-spec run codegen` + `pnpm -r build` will refresh). Existed before this plan.
- **api-server typecheck:** TS7006 implicit-any in `creator.ts`, `kyc.ts`, `twin.ts`, `revocation.ts`. Existed before this plan (not in the files we touched).
- **kyc-gate.e2e.test.ts** fails in a no-DB environment — pre-existing Phase 1 behaviour (`DATABASE_URL` must be set). Not caused by our changes.

## Threat Flags

None — no new network endpoints, no auth paths, no file-access surface, no schema changes. The new fan-twin scaffold has no runtime behaviour yet (placeholder export only). Existing T-02-01-01 / T-02-01-SC threats mitigated by founder approval at Task 0.

## TDD Gate Compliance

This plan had Task 1 marked `tdd="true"`. The standard RED→GREEN→REFACTOR cycle was deliberately collapsed into a single `feat(...)` commit because:
- "Tests" for Task 1 (env schema cold-start, hermes grep, fan-twin tsc) are infra-shape assertions verified inline with `tsx -e` / `grep` / `tsc --noEmit`, not feature behaviour.
- No new unit tests exist for `env.ts` itself — the RED→GREEN test cohort lives in Task 2 (10 `it.todo` files that will turn GREEN as Waves 1+ ship).
- Per the plan's `<behavior>` block, Tests 1–5 are verification checks, not authored vitest files for env.ts.

Future Phase 2 plans (02-02 onward) will perform proper RED→GREEN by turning the Task-2 `it.todo()` rows into real assertions before implementation.

## Self-Check

- ✓ `artifacts/api-server/src/config/env.ts` — present, Supabase-free
- ✓ `artifacts/hermes/src/index.ts` — `TELEGRAM_BOT_TOKEN_LALA` present, bare `TELEGRAM_BOT_TOKEN` absent
- ✓ `artifacts/fan-twin/package.json` — present, declares `@telegraf/session@2.0.0-beta.7`
- ✓ `artifacts/fan-twin/.replit-artifact/artifact.toml` — present, port 3002
- ✓ `.replit` — contains `localPort = 3002`
- ✓ All 10 RED test files present
- ✓ Commit `c0f2bfa` exists on `worktree-agent-aa5cfc042b4afd7a3`
- ✓ Commit `96049b6` exists on `worktree-agent-aa5cfc042b4afd7a3`

**Self-Check: PASSED**
