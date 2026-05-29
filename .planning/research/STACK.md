# Technology Stack

**Project:** lala.la — managed AI digital-twin service
**Researched:** 2026-05-27
**Mode:** Brownfield — existing code confirmed, gaps identified

---

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

**Confidence: HIGH** — Sourced directly from `package.json`, `pnpm-workspace.yaml`, and running build scripts.

---

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

**Confidence: HIGH** — All confirmed from existing `package.json`.

---

### Telegram Bots

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Telegraf | ^4.16.3 | Both Hermes (creator) and fan-twin bots | **Stay on Telegraf** — already in hermes; sufficient for this use case; grammY is technically superior for large-scale but migration cost outweighs benefit for N=1 creator |
| @telegraf/session | ^1.x | Persistent session store (Redis/PG adapter) | **Add this for fan-twin**. The in-memory `Map<>` in `consent.ts` is explicitly marked TODO for Redis migration. `@telegraf/session` ships official PostgreSQL adapter via `@telegraf/session/pg` — use Replit PG, no Redis needed |

**Telegraf v4 architecture decisions:**

- **Webhook in production, long-poll in dev.** Already correctly implemented in `hermes/src/index.ts`. Webhook mode requires `WEBHOOK_URL` and a `WEBHOOK_SECRET` env var (HMAC token verification). For Replit, domain is your `.replit.app` URL.
- **Two separate bot tokens.** `TELEGRAM_BOT_TOKEN_LALA` for creator-side Hermes; `TELEGRAM_BOT_TOKEN_FAN_TWIN` for fan-facing twin. Separate tokens = separate bot personas = separate webhook URLs. Do not multiplex fan and creator traffic on one bot.
- **Scenes + WizardScene for onboarding flows.** The current consent flow uses a hand-rolled `Map`-based state machine in `consent.ts`. This works for Slice 1 but breaks on Replit restart. Replace with `Telegraf.Scenes.WizardScene` backed by `@telegraf/session/pg` for persistence. `ctx.session` = persists across commands; `ctx.scene.session` = persists only within active scene.
- **No grammY migration.** grammY has better TypeScript ergonomics and lower memory per connection, but the migration cost from Telegraf is not justified at N=1. Revisit at creator #10+.

**Confidence: HIGH for Telegraf v4 patterns** — Confirmed from codebase + official Telegraf docs.
**Confidence: MEDIUM for @telegraf/session** — Package is marked beta; PG adapter confirmed available.

---

### Database

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| PostgreSQL | Replit-managed | Sole database | Auto-injected `DATABASE_URL` by Replit; no external DB dependency; Supabase being removed in Week 1 |
| drizzle-orm | ^0.45.2 | ORM | In workspace catalog; `drizzle-zod` for schema-to-Zod bridge; schema split by domain already planned (`creators`, `twins`, `conversations`, `moderation`) |
| drizzle-kit | ^0.31.10 | Schema migrations + push | In db devDeps; `drizzle-kit push` for dev; generated migrations for prod |
| pg | ^8.20.0 | PostgreSQL driver | In lib/db; use `Pool` (not single `Client`) for connection reuse; Replit PG is a standard PG endpoint, `Pool` works correctly |
| drizzle-zod | ^0.8.3 | Drizzle → Zod schema bridge | In lib/db; derive insert/select schemas from table definitions rather than hand-writing |

**Connection pool pattern (confirmed correct for Replit PG):**
```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,           // Replit PG default limit is low; keep under 20
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export const db = drizzle({ client: pool });
```

**Do NOT use `neon-http` or `neon-websockets` drivers.** Those are for Neon serverless; Replit PG is a standard persistent Postgres endpoint. The `pg` driver Pool is correct.

**For migrations:** Use `DATABASE_URL` pointing at a **direct** (non-pooled) connection for `drizzle-kit push`/`migrate`. Pooler connections (PgBouncer) break migration transactions.

**Confidence: HIGH** — Confirmed from `lib/db/package.json` and Drizzle official docs.

---

### LLM Provider

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| GMI Cloud (via fetch) | — | Text generation (LLM) | Commodity mandate; DeepSeek-V3.2 confirmed at `https://api.gmi-serving.com/v1`; OpenAI-compatible `/chat/completions`; $0.00069/1k tokens |
| Helicone | — | LLM observability proxy | Already implemented in `GmiTextProvider` and `GmiClient`; routes via `https://custom.helicone.ai` when `HELICONE_API_KEY` set; enables per-creator cost dashboards with hashed fan IDs |

**Provider registry pattern (already implemented):**
- `lib/providers/` defines `ITextProvider`, `IVoiceProvider` interfaces
- `artifacts/api-server/src/providers/gmi/` holds concrete GMI implementations
- `TEXT_PROVIDER=mock` env var enables test mode; `TEXT_PROVIDER=gmi` activates GMI
- The registry pattern correctly separates "mock for tests" from "GMI for production" — do not collapse this

**GMI text API facts (confirmed from `GmiTextProvider.ts`):**
- Base URL: `https://api.gmi-serving.com/v1`
- Model: `deepseek-ai/DeepSeek-V3.2`
- Auth: `Bearer ${GMI_API_KEY}` header
- Request: standard OpenAI `/chat/completions` JSON body
- Temperature: 0.85 (persona roleplay sweet spot)
- Max tokens: 512 default (keep short for Telegram UX)
- Retry: 5xx → 2 retries with 500ms/1000ms backoff; 4xx → no retry

**Confidence: HIGH** — Sourced directly from `GmiTextProvider.ts` implementation.

---

### Voice Synthesis (XTTS)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| GMI Cloud XTTS (async job) | — | Zero-shot voice synthesis | No GPU needed on Replit; uses 6-second reference audio clip; XTTS-v2 supports EN/JA/ZH-TW |
| BullMQ | ^5.56.1 | Async voice job queue | Voice synthesis is slow (5-30s per clip); must not block HTTP response; already in api-server deps |
| ioredis | ^5.3.0 | Redis client for BullMQ | Already in api-server deps; use Replit's managed Redis |

**GMI XTTS integration status:** The `GmiVoiceProvider.ts` is currently a **stub** (confirmed from codebase). The interface is correct (`enqueueVoiceGeneration` / `getJobStatus`) but the HTTP calls are not yet implemented. The async job pattern (enqueue → poll or webhook → deliver audio URL) is the right architecture for XTTS because synthesis latency is 5-30 seconds per clip.

**What the real implementation needs:**
- GMI's XTTS endpoint URL is not yet publicly documented; must be confirmed with GMI support or via Helicone proxy inspection once account is provisioned
- Request format: multipart/form-data with `text`, `language`, and reference audio bytes OR signed URL pointing to stored voice sample
- Response: job ID to poll; poll `getJobStatus` until `done`, then serve `audioUrl` to fan
- Store reference audio in Replit Object Storage under `creators/{creator_id}/voice_reference.wav`

**Phase flag:** GmiVoiceProvider real implementation is a Week 3 deliverable and needs dedicated research into GMI's XTTS API once credentials are obtained. The stub is correctly wired; do not rush to fill it with guesses.

**XTTS language support (confirmed HIGH confidence):** XTTS-v2 covers EN, JA, ZH (Mandarin). ZH-TW (Traditional Chinese) uses the same Mandarin model with Traditional-character text normalization — verify with GMI support whether text normalization is handled server-side.

**Confidence: MEDIUM** — Interface pattern confirmed; endpoint URL unconfirmed (stub only).

---

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

**Confidence: HIGH** — All confirmed from `artifacts/web/package.json`.

---

### API Code Generation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Orval | — | OpenAI spec → Zod + React Query hooks | Used via `lib/api-spec/openapi.yaml`; generates `lib/api-zod/` and `lib/api-client-react/`; **never hand-edit these** |
| openapi.yaml | — | API contract source of truth | Single source for all route shapes; both bot and web consume generated types |

**Confidence: HIGH** — Confirmed from `REPLIT.md` and workspace structure.

---

### Async Processing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| BullMQ | ^5.56.1 | Voice synthesis queue, async jobs | Already in api-server; Redis-backed; supports delayed jobs, retries, rate limiting; correct for 5-30s XTTS jobs |
| ioredis | ^5.3.0 | Redis client | Already in api-server; use shared connection instance to avoid connection-per-job overhead (BullMQ "Reusing Redis Connections" pattern) |
| @bull-board | ^7.1.5 | Queue admin dashboard (port 3001) | Already in api-server; `@bull-board/express` mounts on `/admin/queues` |
| artifacts/worker | — | Standalone BullMQ worker process | Separate Replit artifact for worker; avoids blocking API server event loop during voice jobs |

**Confidence: HIGH** — All confirmed from `artifacts/api-server/package.json`.

---

### Conversation State Management

**Architecture decision:** Plain context-window accumulation for v1 (N=1 creator). No vector DB, no Graphiti/Neo4j. This is explicitly locked in `PROJECT.md`.

Pattern in use:

```
Fan sends message
  → Load last N turns from conversations table (Drizzle query)
  → Build messages[] array: system_prompt (Character Card V2) + history + new message
  → POST to GMI /chat/completions
  → Write assistant reply to conversations table
  → Return reply to fan
```

**Context window budget (DeepSeek-V3.2):** 128k token context; for fan chat keep history to last 20 turns (~8k tokens) to keep latency low and cost predictable.

**HMAC conversation_id binding (already implemented):**
- Web: `conversation_id` UUID4 + HMAC token in `httpOnly` cookie; prevents session theft
- Telegram: derived from Telegram `user_id` hash; no cookie needed
- Both gates enforced at route entry via entitlement middleware

**Confidence: HIGH** — Sourced from `PROJECT.md` architecture decisions and REPLIT.md.

---

### Moderation Pipeline

| Layer | Technology | What It Does |
|-------|-----------|-------------|
| L1 | OpenAI `omni-moderation-latest` | Input check — fan message before LLM call |
| L2 | Character Card V2 `system_prompt` field | In-character persona boundary via LLM context |
| L3 | OpenAI `omni-moderation-latest` | Output check — LLM response before delivery |
| L4 | Pre-canned deflection strings | Safe replies for boundary cases (no LLM needed) |
| L5 | Sentry + Lala bot notify | Founder alert on L1/L3 flag above threshold |
| L6 | `audit_log` table (Drizzle) | Immutable record of all moderation decisions |

**OpenAI moderation facts (confirmed):**
- Model: `omni-moderation-latest` — covers text + image, multimodal, free to use
- Categories relevant here: `self-harm`, `self-harm/intent`, `self-harm/instructions`, `sexual`, `harassment`
- **SB 243 compliance requirement:** if `self-harm` score > threshold → inject crisis helpline text per locale (JP: 惟命令苦境相談窓口 0120-783-556; TW: 1925; EN: 988); do NOT refuse silently
- SB 243 became effective **January 1, 2026** — this is Day 1 compliance, not optional

**Confidence: HIGH for pipeline design** — Confirmed from `PROJECT.md` six-layer spec and SB 243 legal analysis.
**Confidence: HIGH for SB 243 details** — Multiple law firm analyses confirm January 1, 2026 effective date and crisis helpline injection requirement.

---

### Persona Format

| Technology | Purpose | Why |
|-----------|---------|-----|
| Character Card V2 (JSON) | Creator persona specification | Industry-portable; SillyTavern-standard; Zod-validated JSONB in `twins` table |

**Required V2 fields used by lala.la:**

```typescript
interface CharacterCardV2Data {
  name: string;                    // creator handle
  description: string;             // physical + personality traits
  personality: string;             // behavioral voice
  scenario: string;                // default context / world state
  first_mes: string;               // twin's opening message
  mes_example: string;             // few-shot dialogue examples
  system_prompt: string;           // **overrides LLM system prompt at L2**
  post_history_instructions: string; // appended after conversation history
  creator_notes: string;
  alternate_greetings: string[];
  tags: string[];
  extensions: {
    "lala.la": {                   // namespace per spec requirement
      handles: { fanvue?: string; patreon?: string; seventeen_live?: string };
      cta_locale: Record<string, string>;  // EN/JA/ZH-TW CTA copy
      kill_switch_active: boolean;
    }
  }
}
```

**Use `extensions["lala.la"]` namespace** (per spec: applications SHOULD namespace extension keys). Store CTA platform links and locale-specific copy here.

**Confidence: HIGH** — V2 spec confirmed from official GitHub spec repo.

---

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

**Confidence: HIGH** — SB 243 effective date and requirements confirmed from multiple law firm analyses (Skadden, Gunderson, Jones Walker, Sheppard Health Law).

---

### i18n

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| i18next + react-i18next | ^25.x / ^15.x | Web fan page translations | Industry standard; TypeScript selector API in 2025 edition; tree-shakable ESM bundles |
| i18next-http-middleware | ^3.x | Express-side locale negotiation | Reads `Accept-Language` header; feeds `locale` field to LLM prompts and crisis helpline routing |

**Locale codes used throughout codebase:** `"en" | "ja" | "zh-TW"` — these are the three first-class locales. `zh-TW` (Traditional Chinese, BCP 47) is the canonical identifier; do not use `zh-tw` (lowercase) or `zh-Hant`. The Telegram bot's `i18n.ts` module already handles this.

**Confidence: HIGH** — Locale pattern confirmed from `interfaces.ts` and `i18n.ts`.

---

### Object Storage

| Technology | Purpose | Why |
|-----------|---------|-----|
| Replit Object Storage | Voice reference audio, creator assets (photos/videos), signed URLs | Replit-native; no S3/GCS dependency; private buckets with signed URL delivery; already referenced in `REPLIT.md` under "Object storage" |

**Pattern:** Store under `creators/{creator_id}/voice_reference.wav`. Generate signed URL when delivering to GMI XTTS API rather than piping bytes through the API server.

**Confidence: MEDIUM** — Referenced in project docs but Replit Object Storage SDK usage not yet in codebase.

---

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

---

## Installation Reference

### Core new additions not yet in codebase

```bash
# Telegraf session persistence (hermes + fan-twin)
pnpm --filter @workspace/hermes add @telegraf/session pg

# fan-twin artifact (when scaffolded)
pnpm --filter @workspace/fan-twin add telegraf @telegraf/session pg

# i18n (web fan page)
pnpm --filter @workspace/web add i18next react-i18next

# i18n (api-server, locale negotiation)
pnpm --filter @workspace/api-server add i18next i18next-http-middleware
```

### Already in place (no action needed)

```bash
# These are confirmed present in existing package.json files:
# telegraf ^4.16.3, drizzle-orm ^0.45.2, pg ^8.20.0, drizzle-kit ^0.31.10
# drizzle-zod ^0.8.3, express ^5.2.1, pino ^9.14.0, bullmq ^5.56.1
# ioredis ^5.3.0, zod ^3.25.76, react 19.1.0, vite ^7.3.2
# wouter ^3.3.5, @tanstack/react-query ^5.90.21, @sentry/node ^8
```

---

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
