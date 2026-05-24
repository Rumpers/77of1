# 7of1

AI twin platform for 17 Live creators — fans chat with a creator's AI persona, powered by a LoRA-tuned twin engine.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/web run dev` — run the fan-page web app (port 22333)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` (Postgres), `SESSION_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (`artifacts/api-server/`)
- Web: React 18 + Vite (`artifacts/web/`)
- DB: PostgreSQL (Replit-managed) + Drizzle ORM (`lib/db/`)
- Validation: Zod v4, drizzle-zod
- API codegen: Orval (from `lib/api-spec/openapi.yaml`)
- Payments: Stripe (credits model)
- Auth: Replit Auth (user IDs in `replit_user_id` column)

## Where things live

- API routes: `artifacts/api-server/src/routes/`
- DB schema: `lib/db/src/schema/`
- DB migrations: `lib/db/src/migrations/`
- OpenAPI spec: `lib/api-spec/openapi.yaml`
- Fan page: `artifacts/web/src/pages/fan-page.tsx`
- Auth middleware: `artifacts/api-server/src/lib/auth.ts`
- Payment routes: `artifacts/api-server/src/routes/payments.ts`
- Replit config: `.replit`, `artifacts/*/replit-artifact/artifact.toml`

## Architecture decisions

- **Replit-native layout**: original monorepo (`apps/`, `packages/`) archived to `.migration-backup/`; replaced with `artifacts/` + `lib/` structure that maps cleanly to Replit artifact system
- **Credits model**: fans purchase credit packs via Stripe; each AI interaction deducts credits
- **Replit Auth**: fan sign-up uses Replit's auth; `replit_user_id` is the primary fan identifier
- **Async queue**: generation jobs are queued, never blocking the HTTP path
- **SSH deploy key**: Replit pushes to GitHub via SSH deploy key (see `REPLIT.md` for recovery steps)

## Product

7of1 lets 17 Live creators offer fans an AI-powered chat experience that mirrors the creator's voice and persona. Fans buy credit packs, use credits to chat, and creators monetize their persona at scale.

## User preferences

- Always run `git add -A && git commit -m "<msg>" && git push origin main` after completing a task
- Keep `REPLIT.md` and `replit.md` updated as new Replit-specific changes are made

## Gotchas

- **Do not restore `.migration-backup/`** — that layout is incompatible with Replit's artifact system
- **Port 8080 = API, port 22333 = web** — these are fixed by `artifact.toml`; changing them requires updating both the toml and the `.replit` port mappings
- **`pnpm --frozen-lockfile`** is required in CI/post-merge; bare `pnpm install` may update the lockfile unexpectedly
- **`DATABASE_URL`** is injected automatically by Replit Postgres — do not hardcode it
- **SSH push auth** uses `~/.ssh/id_ed25519`; if lost, see `REPLIT.md` for recovery steps

## Pointers

- Replit-specific adaptations and commit-sync convention: `REPLIT.md`
- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
