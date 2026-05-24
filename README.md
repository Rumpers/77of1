# 7of1

> *7 days, always with you.*

Off-platform monetization for live-streaming creators — an always-on AI twin in the creator's own voice, on a hosted fan page reachable from any social bio link.

## Architecture

Monorepo (pnpm + Turborepo) with three apps and four shared packages.

```
apps/
  web/       Next.js 14 — fan page + creator dashboard (Cloud Run)
  worker/    BullMQ async job worker — voice/video/image generation
  hermes/    Telegraf — single @7of1_bot creator management agent

packages/
  types/         Shared TypeScript domain types
  ai-providers/  Provider adapter interface (GMI → fallback)
  queue/         QueueAdapter + BullMQ implementation
  db/            Supabase client + initial SQL migrations
```

### Key architecture decisions

- **Provider portability**: every LLM/voice/video provider sits behind a uniform adapter. GMI Inference evaluated first; external providers fill gaps.
- **Async by default**: all voice/video/image generation is queued via BullMQ. Text replies are synchronous; everything else is async with Supabase Realtime delivery.
- **Data residency**: all creator persona data is `creator_id`-namespaced with RLS enforcement at the DB layer. Exportable and deletable on request.
- **Consent live-check**: consent verified at generation time. Revoking a grant cancels in-flight jobs within 60 seconds.
- **Webview compatibility**: fan page works inside IG/TikTok in-app browsers. Magic link auth + Stripe Embedded only.
- **Single Hermes bot**: one @7of1_bot, multi-tenant by creator_id.

### Infrastructure

**Prototype**: Replit (Replit-agnostic code)
**Production**: GCP Cloud Run (Tokyo + Taiwan regions)
**Database**: Supabase (Postgres + pgvector + RLS + Realtime + Auth)
**Queue**: BullMQ on Upstash Redis
**Storage**: GCS (signed upload URLs)

Full infrastructure decisions: `docs/PRD.md §22` and `docs/adrs/`.

## Getting started

```bash
pnpm install
pnpm dev
```

Required env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`, `TELEGRAM_BOT_TOKEN`

## Docs

- `docs/PRD.md` — canonical product requirements (v8)
- `docs/adrs/ADR-002-data-layer-job-queue.md` — Supabase + BullMQ decision
- `docs/adrs/ADR-011-async-queue-consent-gate.md` — async queue and consent gate patterns
