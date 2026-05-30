# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

lala.la is a managed AI digital-twin service for influencers. Creators onboard via Telegram (the "Hermes" bot, user-visible name "Lala"); fans chat with the creator's AI twin at `lala.la/[handle]` or via a fan-twin Telegram bot. The twin routes fans toward the creator's existing monetization platforms (Fanvue, Patreon, 17LIVE, etc.). Creators pay a flat fee — there is no fan payment loop.

## Project Goal

Get Claire (creator #1) live as 77of1's first paying creator — her AI twin responds to fans on Telegram and at `lala.la/[handle]`, passes the 30-case eval gate, and drives at least one attributable conversion to her monetization platform — validating the 25-30% rev-share model before opening to creator #2.

## Package Manager

**Always use `pnpm`.** A preinstall script blocks npm and yarn. Never use `npm install` or `yarn`.

```bash
pnpm install --frozen-lockfile   # post-merge / CI
```

## Commands

### Build & Typecheck

```bash
pnpm run typecheck          # typecheck all packages
pnpm run typecheck:libs     # typecheck shared libs only
pnpm run build              # typecheck then build all
```

### Dev Servers

```bash
pnpm --filter @workspace/api-server run dev   # Express API — port 8080
pnpm --filter @workspace/web run dev          # Fan SPA (Vite) — port 22333
pnpm --filter @workspace/admin dev            # Admin (Next.js) — port 3001
pnpm --filter @workspace/hermes run dev       # Telegram bot
pnpm --filter @workspace/worker run dev       # BullMQ worker
```

### Tests (Vitest)

```bash
pnpm --filter @workspace/api-server run test                                        # all api-server tests
pnpm --filter @workspace/api-server exec vitest run src/__tests__/foo.test.ts       # single test file
pnpm --filter @workspace/api-server run test:integration                            # live GMI integration tests
cd apps/web && pnpm exec vitest run                                                  # web app tests
```

### Codegen (do not hand-edit generated files)

```bash
pnpm --filter @workspace/api-spec run codegen   # regenerate lib/api-zod/ and lib/api-client-react/ from openapi.yaml
```

### Database

```bash
pnpm --filter @workspace/db run push            # Drizzle dev schema push
pnpm --filter @workspace/db run push-force      # force push
```

## Architecture

### Monorepo Layout

- `artifacts/` — runnable services (api-server, web, hermes, worker, admin, mockup-sandbox)
- `lib/` — shared libraries (db, api-spec, api-zod, api-client-react, providers, queue, admin-sdk)
- `apps/web/` — Next.js creator dashboard (active development, no package.json yet — distinct from `artifacts/web/`)
- `lib/db/src/migrations/` — canonical hand-written SQL migration path (sequential NNN numbering, e.g. `013_phase4_eval_runs.sql`), applied via `pnpm --filter @workspace/db run push` (supabase/migrations/ is retired/empty after Phase 1 Supabase removal)

### Data Flow

```
Fan (browser / Telegram)
  → artifacts/web (fan SPA, port 22333)   OR   artifacts/hermes (Telegram bot)
  → artifacts/api-server (Express, port 8080)
      → lib/db (Drizzle + Supabase/PostgreSQL)
      → lib/providers (GMI text/voice, OpenAI moderation, Resend email)
      → lib/queue → artifacts/worker (async: voice gen, video gen, dunning, revocation)
```

### Key Services

| Artifact | Role |
|---|---|
| `artifacts/api-server` | Express 5 REST API. Auth, fan sessions, KYC, personas, moderation, credits, subscriptions, assets, links. |
| `artifacts/web` | React 19 + Vite fan-facing SPA. Single entry: `src/pages/fan-page.tsx`. |
| `artifacts/hermes` | Telegraf v4 bot — creator onboarding. Has its own inline Supabase client (`src/db.ts`), does **not** use `@workspace/db`. |
| `artifacts/worker` | BullMQ worker — text/voice/video generation, dunning retry, consent revocation. |
| `artifacts/admin` | Next.js 14 internal admin panel using `react-admin`. |
| `apps/web` | Next.js creator dashboard (in active development on this branch). |

### Shared Libraries

| Library | Role |
|---|---|
| `lib/db` | Drizzle ORM schema + queries. Schema at `src/schema/index.ts`. |
| `lib/api-spec` | OpenAPI spec (`openapi.yaml`) — source of truth for codegen. |
| `lib/api-zod` | **Generated** — Zod schemas from OpenAPI. Do not hand-edit. |
| `lib/api-client-react` | **Generated** — React Query hooks from OpenAPI. Do not hand-edit. |
| `lib/providers` | Provider registry. Swaps text/voice/moderation/email providers via env var. GMI for LLM/voice. |
| `lib/queue` | BullMQ queue definitions shared between api-server and worker. |

## Migrations

After Phase 1 Supabase retirement, one system remains:

1. **Hand-written SQL migrations** (`lib/db/src/migrations/NNN_name.sql`) — canonical migration path with sequential numbering (e.g. `013_phase4_eval_runs.sql`). Apply via `pnpm --filter @workspace/db run push`. Drizzle schema at `lib/db/src/schema/index.ts` is the source of truth for types; the SQL files are the authoritative DDL applied to the live database. Rollback scripts at `supabase/rollbacks/*.down.sql` (reference only).

Note: `supabase/migrations/` is retired and empty after the Phase 1 Supabase-to-Replit-PG migration (012_remove_supabase.sql). Do not write new migrations there.

A post-merge hook (`scripts/post-merge.sh`) runs `pnpm install --frozen-lockfile && pnpm --filter db push` automatically.

## Environment Variables

Copy `.env.example` to `.env.local` for local dev. Key vars:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL` — injected by Replit Postgres in hosted environments
- `REDIS_URL` — BullMQ disabled if absent
- `GMI_API_KEY`, `GMI_API_BASE_URL` — AI generation
- `SESSION_SECRET`, `HMAC_CONVERSATION_SECRET`
- `TELEGRAM_BOT_TOKEN_LALA`, `TELEGRAM_BOT_TOKEN_FAN_TWIN`
- `OPENAI_API_KEY` — moderation pipeline

## Important Constraints

- **Do not extend Stripe / fan payment code.** The product has no fan payment loop; Stripe is dormant.
- **`lib/api-zod/` and `lib/api-client-react/` are generated.** Always regenerate via `pnpm --filter @workspace/api-spec run codegen` after editing `openapi.yaml`.
- **Port mapping is fixed** by `artifact.toml` and `.replit`. Do not change ports (8080/22333/3001) without updating both files.
- **Do not restore `.migration-backup/`** — incompatible with the Replit artifact system; kept as reference only.
- **`artifacts/hermes` does not use `@workspace/db`** — it has its own Supabase client.
- **`apps/web/`** (creator dashboard) and **`artifacts/web/`** (fan SPA) are separate apps serving different audiences.

## Moderation Pipeline

Six-layer: OpenAI at L1 (input) + L3 (output), Character Card V2 system prompt at L2, safe deflection at L4, Sentry + Lala notify at L5, `audit_log` at L6.

Every public API route checks `creator_kyc.status`, `creators.kill_switch_active`, `twins.status`, and HMAC-signed `conversation_id` at route entry. Supabase RLS is defense-in-depth only.

## TypeScript

Root `tsconfig.base.json` enforces strict mode: `noImplicitAny: true`, `strictNullChecks: true`, `es2022` target, `bundler` moduleResolution. Each artifact extends the base.

## Commit Convention

`feat(scope): description` / `fix(scope): description` / `chore: description`

<!-- GSD:project-start source:PROJECT.md -->
## Project

**lala.la**

Managed AI digital-twin service for 17 LIVE influencers (JP / TW / HK). A creator brings her persona; lala.la operates her AI twin on Telegram and the web; her fans chat with the twin and get nudged toward her existing monetization platforms (Fanvue, Patreon, 17 LIVE, her personal site). The creator pays lala.la a flat fee — there is no fan payment loop.

lala.la is plumbing, not a destination. We do not own the creator's relationship with her fans. The creator owns her likeness, LoRA, voice clone, and conversation history under a non-exclusive license and can take them back at any time.

**Core Value:** A fan can open Telegram or `lala.la/[handle]`, have a convincing conversation with a creator's AI twin, and get nudged to her actual monetization platform — all within 30 seconds of first message.

### Constraints

- **Platform**: Replit — do not change port mapping (8080/22333/3001) without updating `artifact.toml` and `.replit`
- **Package manager**: pnpm only — preinstall hook blocks npm/yarn
- **Database**: Replit PostgreSQL + Drizzle — Supabase being replaced in Week 1; do not extend Supabase usage
- **AI providers**: GMI Cloud for LLM + XTTS; commodity-provider-only mandate (no bespoke engine)
- **Payments**: No fan payment loop, ever — Stripe/dunning code stays dormant
- **Timeline**: 4-week sprint to first live creator (started 2026-05-27)
- **Scale at N=1**: Founder operates as all 5 background agents; no automation budget for them yet
- **Generated files**: `lib/api-zod/` and `lib/api-client-react/` are generated from `openapi.yaml` — do not hand-edit
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Runtime & Tooling
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js | 24 (LTS) | Runtime for all artifacts | Replit's current default; native ESM; `node --enable-source-maps` already in use in start scripts |
| TypeScript | ~5.9.3 | Type safety | Already locked in workspace root `package.json`; `~` pin avoids minor breakage on minor bumps |
| pnpm | 9+ | Package manager | **Required** — preinstall hook blocks npm/yarn; `minimumReleaseAge: 1440` supply-chain guard in place |
| esbuild | 0.27.3 | Build (api-server, hermes) | **Exact pin required** — workspace overrides freeze this for Replit linux-x64; do not bump without updating all overrides |
| tsx | ^4.21.0 | Dev runner / watch mode | Already in catalog; also used as `@esbuild-kit/esm-loader` override |
| Vitest | ^3.2.3 | Unit + integration tests | Already in api-server devDeps; consistent with ESM-first stack |
### API Server
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Express | ^5.2.1 | HTTP server (port 8080) | Already adopted; v5 is stable release (Oct 2024); async error handling built-in (no need for `express-async-errors` wrapper); Zod replaces `express-validator` for type inference |
| Zod | ^3.25.76 | Request validation | In workspace catalog; integrates with `drizzle-zod` and Orval-generated OpenAPI schemas; Zod v4 API (`zod/v4`) already used in schema comments |
| pino | ^9.14.0 | Structured logging | Already in api-server deps; `pino-http` for request logging; `esbuild-plugin-pino` for tree-shaking transport workers at build time |
| Sentry | ^8 | Error tracking + AI span monitoring | Already in `@sentry/node` api-server dep and `@sentry/react` web dep; v8 ships AI Agent Monitoring with `setConversationId()` for multi-turn tracing; call `Sentry.init` before all other imports |
| cookie-parser | ^1.4.7 | `httpOnly` cookie for conversation_id | Already in api-server; used for HMAC-signed `conversation_id` binding |
| cors | ^2.8.6 | CORS | Already in api-server |
| multer | ^1.4.5-lts.1 | File uploads (voice samples) | Already in api-server; 1.4.5-lts.1 is the maintained security backport for v1 |
### Telegram Bots
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Telegraf | ^4.16.3 | Both Hermes (creator) and fan-twin bots | **Stay on Telegraf** — already in hermes; sufficient for this use case; grammY is technically superior for large-scale but migration cost outweighs benefit for N=1 creator |
| @telegraf/session | ^1.x | Persistent session store (Redis/PG adapter) | **Add this for fan-twin**. The in-memory `Map<>` in `consent.ts` is explicitly marked TODO for Redis migration. `@telegraf/session` ships official PostgreSQL adapter via `@telegraf/session/pg` — use Replit PG, no Redis needed |
- **Webhook in production, long-poll in dev.** Already correctly implemented in `hermes/src/index.ts`. Webhook mode requires `WEBHOOK_URL` and a `WEBHOOK_SECRET` env var (HMAC token verification). For Replit, domain is your `.replit.app` URL.
- **Two separate bot tokens.** `TELEGRAM_BOT_TOKEN_LALA` for creator-side Hermes; `TELEGRAM_BOT_TOKEN_FAN_TWIN` for fan-facing twin. Separate tokens = separate bot personas = separate webhook URLs. Do not multiplex fan and creator traffic on one bot.
- **Scenes + WizardScene for onboarding flows.** The current consent flow uses a hand-rolled `Map`-based state machine in `consent.ts`. This works for Slice 1 but breaks on Replit restart. Replace with `Telegraf.Scenes.WizardScene` backed by `@telegraf/session/pg` for persistence. `ctx.session` = persists across commands; `ctx.scene.session` = persists only within active scene.
- **No grammY migration.** grammY has better TypeScript ergonomics and lower memory per connection, but the migration cost from Telegraf is not justified at N=1. Revisit at creator #10+.
### Database
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| PostgreSQL | Replit-managed | Sole database | Auto-injected `DATABASE_URL` by Replit; no external DB dependency; Supabase being removed in Week 1 |
| drizzle-orm | ^0.45.2 | ORM | In workspace catalog; `drizzle-zod` for schema-to-Zod bridge; schema split by domain already planned (`creators`, `twins`, `conversations`, `moderation`) |
| drizzle-kit | ^0.31.10 | Schema migrations + push | In db devDeps; `drizzle-kit push` for dev; generated migrations for prod |
| pg | ^8.20.0 | PostgreSQL driver | In lib/db; use `Pool` (not single `Client`) for connection reuse; Replit PG is a standard PG endpoint, `Pool` works correctly |
| drizzle-zod | ^0.8.3 | Drizzle → Zod schema bridge | In lib/db; derive insert/select schemas from table definitions rather than hand-writing |
### LLM Provider
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| GMI Cloud (via fetch) | — | Text generation (LLM) | Commodity mandate; DeepSeek-V3.2 confirmed at `https://api.gmi-serving.com/v1`; OpenAI-compatible `/chat/completions`; $0.00069/1k tokens |
| Helicone | — | LLM observability proxy | Already implemented in `GmiTextProvider` and `GmiClient`; routes via `https://custom.helicone.ai` when `HELICONE_API_KEY` set; enables per-creator cost dashboards with hashed fan IDs |
- `lib/providers/` defines `ITextProvider`, `IVoiceProvider` interfaces
- `artifacts/api-server/src/providers/gmi/` holds concrete GMI implementations
- `TEXT_PROVIDER=mock` env var enables test mode; `TEXT_PROVIDER=gmi` activates GMI
- The registry pattern correctly separates "mock for tests" from "GMI for production" — do not collapse this
- Base URL: `https://api.gmi-serving.com/v1`
- Model: `deepseek-ai/DeepSeek-V3.2`
- Auth: `Bearer ${GMI_API_KEY}` header
- Request: standard OpenAI `/chat/completions` JSON body
- Temperature: 0.85 (persona roleplay sweet spot)
- Max tokens: 512 default (keep short for Telegram UX)
- Retry: 5xx → 2 retries with 500ms/1000ms backoff; 4xx → no retry
### Voice Synthesis (XTTS)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| GMI Cloud XTTS (async job) | — | Zero-shot voice synthesis | No GPU needed on Replit; uses 6-second reference audio clip; XTTS-v2 supports EN/JA/ZH-TW |
| BullMQ | ^5.56.1 | Async voice job queue | Voice synthesis is slow (5-30s per clip); must not block HTTP response; already in api-server deps |
| ioredis | ^5.3.0 | Redis client for BullMQ | Already in api-server deps; use Replit's managed Redis |
- GMI's XTTS endpoint URL is not yet publicly documented; must be confirmed with GMI support or via Helicone proxy inspection once account is provisioned
- Request format: multipart/form-data with `text`, `language`, and reference audio bytes OR signed URL pointing to stored voice sample
- Response: job ID to poll; poll `getJobStatus` until `done`, then serve `audioUrl` to fan
- Store reference audio in Replit Object Storage under `creators/{creator_id}/voice_reference.wav`
### Fan-Facing Web (Fan Page)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React | 19.1.0 | UI | Exact version pinned in workspace catalog (expo requires it); already in use |
| Vite | ^7.3.2 | Build tool + dev server (port 22333) | In catalog; ESM-native; `artifacts/web/` already scaffolded; `--host 0.0.0.0` for Replit |
| wouter | ^3.3.5 | Client-side routing | Lightweight alternative to react-router; already in web deps; 2kB vs 50kB; correct for a small SPA |
| TanStack Query | ^5.90.21 | Server state + API calls | In catalog; pairs with Orval-generated hooks in `lib/api-client-react/`; handles retry, loading states, cache invalidation |
| Tailwind CSS | ^4.1.14 | Styling | In catalog; v4 uses CSS-native cascade layers; `@tailwindcss/vite` plugin |
| Radix UI | various | Headless components | Already in web devDeps; 20+ primitives installed; pair with `class-variance-authority` + `cn()` utility |
| Framer Motion | ^12.23.24 | Animations | In catalog; use sparingly for fan page entrance animations; do not over-animate |
| react-hook-form + @hookform/resolvers | ^7.55.0 | Forms | Already in web; resolver bridges Zod schemas; use for any onboarding form |
| Sentry React | ^8 | Frontend error tracking | Already in web devDeps; initialize before React tree mounts |
### API Code Generation
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Orval | — | OpenAI spec → Zod + React Query hooks | Used via `lib/api-spec/openapi.yaml`; generates `lib/api-zod/` and `lib/api-client-react/`; **never hand-edit these** |
| openapi.yaml | — | API contract source of truth | Single source for all route shapes; both bot and web consume generated types |
### Async Processing
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| BullMQ | ^5.56.1 | Voice synthesis queue, async jobs | Already in api-server; Redis-backed; supports delayed jobs, retries, rate limiting; correct for 5-30s XTTS jobs |
| ioredis | ^5.3.0 | Redis client | Already in api-server; use shared connection instance to avoid connection-per-job overhead (BullMQ "Reusing Redis Connections" pattern) |
| @bull-board | ^7.1.5 | Queue admin dashboard (port 3001) | Already in api-server; `@bull-board/express` mounts on `/admin/queues` |
| artifacts/worker | — | Standalone BullMQ worker process | Separate Replit artifact for worker; avoids blocking API server event loop during voice jobs |
### Conversation State Management
- Web: `conversation_id` UUID4 + HMAC token in `httpOnly` cookie; prevents session theft
- Telegram: derived from Telegram `user_id` hash; no cookie needed
- Both gates enforced at route entry via entitlement middleware
### Moderation Pipeline
| Layer | Technology | What It Does |
|-------|-----------|-------------|
| L1 | OpenAI `omni-moderation-latest` | Input check — fan message before LLM call |
| L2 | Character Card V2 `system_prompt` field | In-character persona boundary via LLM context |
| L3 | OpenAI `omni-moderation-latest` | Output check — LLM response before delivery |
| L4 | Pre-canned deflection strings | Safe replies for boundary cases (no LLM needed) |
| L5 | Sentry + Lala bot notify | Founder alert on L1/L3 flag above threshold |
| L6 | `audit_log` table (Drizzle) | Immutable record of all moderation decisions |
- Model: `omni-moderation-latest` — covers text + image, multimodal, free to use
- Categories relevant here: `self-harm`, `self-harm/intent`, `self-harm/instructions`, `sexual`, `harassment`
- **SB 243 compliance requirement:** if `self-harm` score > threshold → inject crisis helpline text per locale (JP: 惟命令苦境相談窓口 0120-783-556; TW: 1925; EN: 988); do NOT refuse silently
- SB 243 became effective **January 1, 2026** — this is Day 1 compliance, not optional
### Persona Format
| Technology | Purpose | Why |
|-----------|---------|-----|
| Character Card V2 (JSON) | Creator persona specification | Industry-portable; SillyTavern-standard; Zod-validated JSONB in `twins` table |
### Compliance Tooling
| Concern | Tool / Pattern | Why |
|---------|--------------|-----|
| California SB 243 AI disclosure | Inline disclosure footer on every message: "AI twin · @{handle}_ai" | Already stubbed in `twin.ts`; mandatory for any "companion chatbot" that a reasonable person might mistake for human — effective Jan 1, 2026 |
| SB 243 minor protections | Age check gate; 3-hour reminder injection | Not yet implemented; required if any minor can access the twin |
| SB 243 self-harm protocol | Crisis helpline injection (per locale) when L1/L3 `self-harm` flag | Must be in production on Day 1; $1,000 per violation private right of action |
| GDPR/APPI/PDPA | `dsar-portal.tsx` + `fan-dsar.tsx` already scaffolded | Data minimization; right to erasure; consent receipts via `consent_grants` table |
| Consent audit log | `consent_grants` table with `consent_version`, `ip_hash`, `granted_at` | `telegramIpHash()` already implemented for Telegram channel; `CONSENT_VERSION = 'v1.0'` versioned |
| Creator KYC gate | Entitlement middleware: `creator_kyc.status = 'signed'` blocks all twin routes with 423 | Already in `REPLIT.md` architecture decisions; every public route checks this |
| Personality rights | Non-exclusive license; export endpoint `/api/creator/export-my-data` | Locked decision in `PROJECT.md` |
### i18n
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| i18next + react-i18next | ^25.x / ^15.x | Web fan page translations | Industry standard; TypeScript selector API in 2025 edition; tree-shakable ESM bundles |
| i18next-http-middleware | ^3.x | Express-side locale negotiation | Reads `Accept-Language` header; feeds `locale` field to LLM prompts and crisis helpline routing |
### Object Storage
| Technology | Purpose | Why |
|-----------|---------|-----|
| Replit Object Storage | Voice reference audio, creator assets (photos/videos), signed URLs | Replit-native; no S3/GCS dependency; private buckets with signed URL delivery; already referenced in `REPLIT.md` under "Object storage" |
## What NOT to Use
| Technology | Why Not |
|-----------|---------|
| Supabase | Being removed Week 1 — still present in `hermes` deps and `consent.ts` DB calls (Supabase client must be replaced with Drizzle + Replit PG) |
| ElevenLabs | Explicit ToS concern for creator monetization use case; GMI XTTS is the mandate |
| Neon / Neon serverless driver | Wrong driver — Replit PG is standard Postgres, not serverless; `@neondatabase/serverless` would fail |
| Next.js | Over-engineered for a fan landing page SPA; Vite + React + wouter is already chosen and deployed; SSR not needed |
| grammY | Superior framework but migration cost from Telegraf v4 not justified at N=1 |
| Letta / Graphiti / Neo4j | Deferred to creator #3-5 per `PROJECT.md`; plain context window sufficient at N=1 |
| Stripe / dunning | No fan payment loop; Stripe references in codebase are dormant — do not extend |
| OpenAI for LLM (text generation) | GMI Cloud is the mandate; OpenAI key is **only** for the moderation API |
| Redis for session storage (short term) | Use `@telegraf/session/pg` with Replit PG instead of adding a Redis dependency for Telegraf sessions; BullMQ already uses Redis but don't add Redis for sessions too |
## Installation Reference
### Core new additions not yet in codebase
# Telegraf session persistence (hermes + fan-twin)
# fan-twin artifact (when scaffolded)
# i18n (web fan page)
# i18n (api-server, locale negotiation)
### Already in place (no action needed)
# These are confirmed present in existing package.json files:
# telegraf ^4.16.3, drizzle-orm ^0.45.2, pg ^8.20.0, drizzle-kit ^0.31.10
# drizzle-zod ^0.8.3, express ^5.2.1, pino ^9.14.0, bullmq ^5.56.1
# ioredis ^5.3.0, zod ^3.25.76, react 19.1.0, vite ^7.3.2
# wouter ^3.3.5, @tanstack/react-query ^5.90.21, @sentry/node ^8
## Sources
- Codebase: `pnpm-workspace.yaml` (catalog versions), `lib/db/package.json`, `artifacts/api-server/package.json`, `artifacts/hermes/package.json`, `artifacts/web/package.json` — HIGH confidence
- `lib/providers/src/providers/GmiTextProvider.ts` — GMI API endpoint, model, auth pattern — HIGH confidence
- `lib/providers/src/providers/GmiVoiceProvider.ts` — stub; endpoint TBD — MEDIUM confidence
- `artifacts/hermes/src/consent.ts` — in-memory session state machine (TODO: Redis migration noted inline) — HIGH confidence
- `REPLIT.md` — architecture decisions, port mapping, env vars — HIGH confidence
- `.planning/PROJECT.md` — constraints, out-of-scope decisions — HIGH confidence
- [California SB 243 — Skadden analysis](https://www.skadden.com/insights/publications/2025/10/new-california-companion-chatbot-law) — Jan 1 2026 effective date — HIGH confidence
- [California SB 243 — Jones Walker analysis](https://www.joneswalker.com/en/insights/blogs/ai-law-blog/ai-regulatory-update-californias-sb-243-mandates-companion-ai-safety-and-accoun.html) — self-harm protocol requirement — HIGH confidence
- [Character Card V2 spec](https://github.com/malfoyslastname/character-card-spec-v2/blob/main/spec_v2.md) — V2 field definitions — HIGH confidence
- [Telegraf v4 official docs — WizardContext](https://telegraf.js.org/interfaces/Scenes.WizardContext.html) — scene/session patterns — HIGH confidence
- [@telegraf/session](https://github.com/telegraf/session) — official PG adapter — MEDIUM confidence (beta)
- [Drizzle ORM PostgreSQL docs](https://orm.drizzle.team/docs/get-started-postgresql) — Pool pattern — HIGH confidence
- [OpenAI Moderation API](https://developers.openai.com/api/docs/guides/moderation) — omni-moderation-latest categories — HIGH confidence
- [Helicone observability docs](https://docs.helicone.ai/guides/cookbooks/cost-tracking) — per-user cost tracking — HIGH confidence
- [GMI Cloud docs](https://docs.gmicloud.ai/) — XTTS model availability confirmed; endpoint URL not yet publicly documented — LOW confidence for XTTS endpoint
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
