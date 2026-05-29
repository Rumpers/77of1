# lala.la

Managed AI digital-twin service for 17 LIVE influencers. Fans chat with a creator's AI twin on Telegram or the web; the twin nudges them to her existing monetization platforms (Fanvue, Patreon, 17 LIVE, her own site).

See [`docs/north-star.md`](docs/north-star.md) for product direction, locked architectural decisions, 4-week schedule, and compliance baseline.

## Run & Operate

**Run button** (`.replit` "Project" workflow) starts three processes in parallel:
- `api-server` — Express API on port 8080 (external: 80)
- `web` — fan-page SPA on port 22333 (external: 3000 — Replit preview URL)
- `hermes` — Telegram creator bot (long-poll / webhook, no browser port)

Manual dev commands:
- `pnpm --filter @workspace/api-server run dev` — API server (port 8080)
- `pnpm --filter @workspace/web run dev` — fan-page web app (port 22333)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks + Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push Drizzle schema changes (dev only)

Required env (Replit Secrets):

- `DATABASE_URL` — Replit PostgreSQL (auto-injected)
- `SESSION_SECRET` — Express session signing key
- `HMAC_CONVERSATION_SECRET` — signed conversation_id binding for fan sessions
- `GMI_API_KEY` — text + voice (XTTS) inference
- `OPENAI_API_KEY` — moderation API (L1 + L3 checks)
- `TELEGRAM_BOT_TOKEN_LALA` — creator-side bot
- `TELEGRAM_BOT_TOKEN_FAN_TWIN` — fan-side bot (separate token)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (`artifacts/api-server/`)
- Web: React 18 + Vite (`artifacts/web/`)
- DB: Replit PostgreSQL + Drizzle ORM (`lib/db/`)
- Object storage: Replit Object Storage (private buckets, signed URLs)
- Validation: Zod v4, drizzle-zod
- API codegen: Orval (from `lib/api-spec/openapi.yaml`)
- LLM: GMI Cloud (commodity, swappable via `lib/providers/`)
- Voice: GMI Cloud XTTS (zero-shot from reference audio)
- Bots: Telegraf v4
- Tests: Vitest (project-wide) + Playwright (web E2E)

## Where things live

- API routes: `artifacts/api-server/src/routes/`
- Entitlement middleware: `artifacts/api-server/src/middleware/entitlement.ts`
- DB schema (split by domain): `lib/db/src/schema/{creators,twins,conversations,moderation}.ts`
- DB queries: `lib/db/src/queries/`
- DB migrations: `lib/db/src/migrations/` (Drizzle-generated)
- OpenAPI spec: `lib/api-spec/openapi.yaml`
- Provider integrations: `lib/providers/`
- Fan page: `artifacts/web/src/pages/fan-page.tsx`
- Lala bot (creator-side): `artifacts/hermes/` (internal codename Hermes, user-visible "Lala")
- Fan-twin bot: `artifacts/fan-twin/`
- Replit config: `.replit`, `artifacts/*/replit-artifact/artifact.toml`

## Architecture decisions

- **Replit-native layout**: original monorepo (`apps/`, `packages/`) archived to `.migration-backup/`; replaced with `artifacts/` + `lib/` structure that maps cleanly to Replit's artifact system.
- **Application-layer entitlement at route entry**: every public route checks `creator_kyc.status`, `creators.kill_switch_active`, `twins.status`, and HMAC-signed conversation_id binding before serving. RLS is defense-in-depth, not the gate.
- **Multi-twin schema from day 1**: `twins` table + `twin_id` column on related tables. Security plumbing (`app.current_twin_id`) deferred until creator #2.
- **Conversation_id binding**: UUID4 + HMAC token in httpOnly cookie (web) or Telegram user_id derivation (bot). Prevents session theft.
- **Provider registry pattern**: `registry.text / voice / moderation` swappable via env var. No bespoke twin engine.
- **Six-layer moderation pipeline**: OpenAI moderation at L1 (input) and L3 (output), Character Card V2 system_prompt at L2, pre-canned safe deflection at L4, founder Sentry + Lala notify at L5, audit_log at L6.
- **Creator-owned artifacts**: training audio, character card, voice reference, future LoRA all live in creator-namespaced storage with non-exclusive license. She can take them back at any time via `/export-my-data`.

## Product

lala.la operates a creator's AI twin so she can monetize her persona at scale on her existing platforms. The creator never touches a dashboard. Onboarding is a Telegram conversation with Lala. Twin lives on `lala.la/[handle]` and a Telegram fan-twin bot. Fan-payment loop is intentionally absent — creators pay lala.la from their own platform revenue (flat fee or manual invoice for first creators; webhook-driven rev-share later).

## Gotchas

- **Do not restore `.migration-backup/`** — that layout is incompatible with Replit's artifact system. It's preserved only as reference for the old direction.
- **Port 8080 = API, port 22333 = web** — fixed by `artifact.toml`; changing them requires updating both the toml and `.replit` port mappings.
- **`pnpm --frozen-lockfile`** required in CI / post-merge; bare `pnpm install` may update the lockfile unexpectedly.
- **`DATABASE_URL`** is auto-injected by Replit Postgres — do not hardcode it.
- **SSH push auth** uses `~/.ssh/id_ed25519`; if lost, see "Git Push Authentication" below for recovery.
- **No fan payment loop** — Stripe-related code and old `creator_tax_forms`, refund, dunning, fan account recovery migrations are dormant from the prior direction. Do not extend them.

## Git Push Authentication

Push auth uses an SSH deploy key (read-write) registered on `Rumpers/77of1`:

- Key fingerprint: `SHA256:ER+r564hX+i+UdrzKdNrDc8SOMrvNnw4N+iCEUrjN1M`
- Key file: `~/.ssh/id_ed25519`
- SSH config: `~/.ssh/config` sets `IdentityFile ~/.ssh/id_ed25519` for `github.com`
- Remote URL: `git@github.com:Rumpers/77of1.git` (SSH)

### Recovering push auth after a full Repl reset

1. `ssh-keygen -t ed25519 -C "replit-77of1-deploy" -f ~/.ssh/id_ed25519 -N ""`
2. `cat ~/.ssh/id_ed25519.pub` and add as a deploy key (read-write) on `Rumpers/77of1`
3. Write `~/.ssh/config`:
   ```
   Host github.com
     HostName github.com
     User git
     IdentityFile ~/.ssh/id_ed25519
     IdentitiesOnly yes
     StrictHostKeyChecking no
   ```
4. `ssh-keyscan github.com >> ~/.ssh/known_hosts`
5. `git remote set-url origin git@github.com:Rumpers/77of1.git`

## Commit-and-Sync Convention

Every agent working in this Replit must push to GitHub at the end of each task. Do not leave commits unreplicated.

```bash
git add <files> && git commit -m "<message>" && git push origin <branch>
```

Commit message format: `feat(scope): description`, `fix(scope): description`, `chore: description`.

Replit Agent commits include `Replit-Commit-*` trailers automatically — do not strip these.
