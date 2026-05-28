# Phase 1: Baseline Repair - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 1-Baseline Repair
**Mode:** --auto (all areas auto-resolved with recommended defaults)
**Areas discussed:** Drizzle schema scope, KYC gate status value, apps/web/ fate, Hermes migration path, Supabase removal order

---

## Drizzle Schema Scope

| Option | Description | Selected |
|--------|-------------|----------|
| 7 core tables + creators/twins/creator_config | Only tables needed for Phases 1-4; fan-payment tables excluded | ✓ |
| Full historical table set | Include fan_credits, credit_transactions, fan_blocks for completeness | |

**Auto-selected:** 7 core tables only
**Notes:** Fan payment is permanently out of scope per north-star locked decision. Including those tables would create dead schema that contradicts the product direction.

---

## KYC Gate Status Value

| Option | Description | Selected |
|--------|-------------|----------|
| Adopt 'signed' — simplify enum | pending\|signed\|rejected; gate checks `status === 'signed'` | ✓ |
| Keep existing 'complete' | Preserve full multi-step enum; gate checks `status === 'complete'` | |

**Auto-selected:** 'signed' with simplified enum
**Notes:** The existing `isKycComplete()` naming and `'complete'` value implied an ops-approval step that doesn't exist at N=1. 'signed' accurately reflects what the gate actually checks (personality rights signed). Simplifying the enum removes dead states.

---

## apps/web/ Fate

| Option | Description | Selected |
|--------|-------------|----------|
| Delete per north-star | Remove apps/web/ entirely in Phase 1 clean-slate | ✓ |
| Preserve active dev work | Keep apps/web/ untracked files, reconcile later | |

**Auto-selected:** Delete per north-star
**Notes:** North-star Week 1 explicitly names apps/web/ deletion. The untracked files (continue-token API, open-in-browser-sheet, webview lib) represent early creator-dashboard work that will be rebuilt properly after the baseline is solid.

---

## Hermes Migration Path

| Option | Description | Selected |
|--------|-------------|----------|
| Import from @workspace/db | Hermes uses shared Drizzle lib — single schema source of truth | ✓ |
| Own Drizzle instance | Hermes gets its own DATABASE_URL connection | |

**Auto-selected:** Import from @workspace/db
**Notes:** A separate Drizzle instance in hermes would duplicate the schema and create drift risk. The shared lib pattern is already established.

---

## Supabase Removal Order

| Option | Description | Selected |
|--------|-------------|----------|
| Env vars first, then code | Remove Supabase env vars → find hidden deps → remove code | ✓ |
| Code first, then env vars | Remove imports → remove package deps → remove env vars | |

**Auto-selected:** Env vars first
**Notes:** Per PITFALLS.md finding: removing env vars first causes any missed code paths to throw at startup, surfacing hidden dependencies immediately. Code-first removal leaves dormant Supabase paths that could write to Supabase post-cutover if env vars are still present.

---

## Claude's Discretion

- **conversation_messages content storage**: Chose to store plaintext with `retention_category = 'transcript'` and 90-day TTL (vs encrypting or hashing). Encryption would complicate LLM context loading; storing hashes only would prevent context replay entirely.
- **admin/ Supabase migration timing**: Deferred to Phase 2 — admin is internal tooling with low urgency.

## Deferred Ideas

- Admin Supabase removal (3 files) — deferred to Phase 2
- `@telegraf/session/pg` migration — acceptable at N=1, noted for future
- pgvector availability check — quick verification task, not a blocker
