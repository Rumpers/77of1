# Walking Skeleton — lala.la

**Phase:** 1 (Baseline Repair)
**Generated:** 2026-05-27

## Capability Proven End-to-End

A creator (Telegram user) can be looked up in Replit PostgreSQL via Drizzle from the Hermes bot; the api-server twin route at `POST /api/twin/chat` reads the same creator row via Drizzle and returns HTTP 423 unless `creator_kyc.status === 'signed'`. No Supabase client participates in any read or write.

This is the thinnest stack that exercises: Drizzle schema → Replit PG → api-server route → Hermes bot → KYC gate decision → safety audit write with hashed identifiers only.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework (services) | Express 5 (api-server), Telegraf v4 (hermes), Vite+React (artifacts/web), Next.js (admin) | Already in place; Phase 1 keeps stack and only swaps DB layer |
| Data layer | Replit PostgreSQL + Drizzle ORM 0.45.2 (`drizzle-orm/node-postgres` + `pg.Pool`) | D-09; Supabase removed phase-wide; Pool singleton in `lib/db/src/index.ts` |
| Schema migration | `drizzle-kit push` against direct (non-pooled) `DATABASE_URL` | Pitfall #6; pooled URL breaks DDL transactions |
| Auth (creator side) | Replit identity headers via `getReplitUser()` exclusively for Phase 1 | RESEARCH Open Q #1; removes Supabase JWT dep without new lib |
| KYC gate | `status === 'signed'` strict positive assertion; null/pending/rejected → HTTP 423 | D-05; Pitfall #4 |
| KYC status enum | `pending \| signed \| rejected` (3-value pgEnum) | D-05; collapsed from 8-state legacy enum |
| Data minimization | `retention_category` column (`operational`/`transcript`/`audit`) on every fan-touching table; hashed identifiers only in `safety_audit_log` | D-02, D-14, COMPLY-03 |
| Async queue | BullMQ + ioredis on `REDIS_URL`; `lib/queue` queue definitions only — workers are stubs in Phase 1 | D-13, INFRA-04 |
| Deployment target | Replit; ports 8080 (api-server) / 22333 (artifacts/web) / 3001 (admin) per `artifact.toml` | INFRA-01; do not change port mapping |
| Directory layout | Monorepo: `lib/db`, `lib/queue`, `artifacts/{api-server,hermes,worker,web,admin}`; `apps/web/` deleted | D-08; `pnpm-workspace.yaml` already excludes `apps/` |

## Stack Touched in Phase 1

- [x] Project scaffold — already in place; no framework init needed
- [x] Routing — `POST /api/twin/chat` (KYC gate), `GET /api/health/db` (Drizzle Pool ping)
- [x] Database — Drizzle schema for 8 tables + `drizzle-kit push` runs clean on Replit PG; real read (`isKycSigned` queries `creator_kyc`) and real write (`safety_audit_log` insert via Drizzle, `creator_config.paused` update from Hermes)
- [x] UI — Hermes Telegram bot (Telegraf) exercises full DB stack end-to-end; the fan-facing web UI in `artifacts/web/` remains unchanged in Phase 1
- [x] Deployment — Replit dev run command: `pnpm install --frozen-lockfile && pnpm --filter @workspace/db run push && pnpm --filter @workspace/api-server run dev` (api-server) + `pnpm --filter @workspace/hermes run dev` (bot)

## Out of Scope (Deferred to Later Slices)

- Fan-facing chat (Phase 2: twin runtime + moderation pipeline)
- Voice synthesis (Phase 3: GMI XTTS + circuit breaker)
- Creator dashboard UI (Phase 5+: rebuild after admin Supabase removal)
- `artifacts/admin/` Supabase removal (CONTEXT.md deferred — Phase 2)
- `@telegraf/session/pg` migration for Hermes consent sessions (deferred — in-memory acceptable at N=1)
- pgvector / embeddings (deferred until creator #3-5)
- Fan payment loop, Stripe, fan accounts — permanently out of scope per north-star
- Replit Object Storage signed URLs for KYC document upload — stubbed 503 in Phase 1; real impl Phase 3
- Replacing Replit auth with a proper JWT library — Phase 2+

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: Twin runtime core — both chat surfaces live with six-layer moderation, SB 243 disclosure, async Telegram ack via BullMQ
- Phase 3: Voice replies via GMI XTTS, escalation scoring, OCR intake, i18n complete, DSAR deletion
- Phase 4: 30-case eval suite, weekly regression cron, first creator goes live
