# REPLIT.md — Replit Environment Guide

This document records all Replit-specific adaptations made to the 7of1 repo and the commit-and-sync convention every agent working in this Replit must follow.

---

## Workspace Restructure

The original monorepo layout (`apps/`, `packages/`, `docs/`, `turbo.json`) was incompatible with Replit's pnpm workspace and artifact system. It was archived to `.migration-backup/` and a Replit-native layout was created in place:

| Path | Purpose |
|------|---------|
| `artifacts/api-server/` | Express API — Replit artifact, port 8080 |
| `artifacts/web/` | React/Vite fan page — Replit artifact, port 22333 |
| `artifacts/mockup-sandbox/` | UI component preview — Replit artifact, port 8081 |
| `lib/db/` | Drizzle ORM schema + migrations |
| `lib/api-spec/` | OpenAPI YAML + Orval codegen config |
| `lib/api-zod/` | Generated Zod schemas |
| `lib/api-client-react/` | Generated React query hooks |
| `scripts/` | Shared scripts (post-merge hook) |
| `.migration-backup/` | Archived original monorepo (reference only — do not restore) |

---

## Replit-Specific Files

These files must not be deleted or reverted — they exist only in the Replit environment:

| File | What it does |
|------|-------------|
| `.replit` | Configures Replit: `nodejs-24` module, port mappings, deployment target (autoscale), post-merge hook path, and `pnpm_workspace` agent stack |
| `artifacts/*/replit-artifact/artifact.toml` | Declares each artifact's kind, preview path, service ports, dev/prod run commands, and health check |
| `.replitignore` | Excludes `.local` (pnpm store cache) from the deployed image |
| `.npmrc` | `auto-install-peers=false`, `strict-peer-dependencies=false` — required for pnpm compatibility in Replit |
| `replit.md` | AI context file read by Replit Agent — keep this up to date as the project evolves |
| `scripts/post-merge.sh` | Run by Replit after each merge: `pnpm install --frozen-lockfile && pnpm --filter db push` |

---

## Port Assignments

| Service | Local Port | Replit External Port |
|---------|-----------|---------------------|
| API server | 8080 | 80 |
| Web (fan page) | 22333 | 3000 |
| Mockup sandbox | 8081 | — |

---

## Required Environment Variables (Replit Secrets)

These must be set as Replit Secrets (not committed to the repo):

| Secret | Description |
|--------|-------------|
| `DATABASE_URL` | PostgreSQL connection string — auto-injected by Replit Postgres integration |
| `SESSION_SECRET` | Express session signing key |
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_CONNECT_CLIENT_ID` | Stripe Connect OAuth client ID (HID-069) |
| `OAUTH_TOKEN_ENCRYPTION_KEY` | 64 hex chars (32 bytes AES-256-GCM) for token encryption at rest (HID-069) |
| `LINE_PAY_CHANNEL_ID` | LINE Pay merchant channel ID (HID-069) |
| `LINE_PAY_CHANNEL_SECRET` | LINE Pay channel secret (HID-069) |
| `LINE_PAY_ENV` | `sandbox` or `production` for LINE Pay API (HID-069) |
| `SUPABASE_URL` | Supabase project URL (for auth/storage) |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |

`DATABASE_URL` and `SESSION_SECRET` are already present in the Replit workspace secrets.

---

## Git Push Authentication

Push auth uses an SSH deploy key (read-write) registered on `Rumpers/77of1`:

- Key fingerprint: `SHA256:ER+r564hX+i+UdrzKdNrDc8SOMrvNnw4N+iCEUrjN1M`
- Key file: `~/.ssh/id_ed25519` (persisted in Replit filesystem)
- SSH config: `~/.ssh/config` sets `IdentityFile ~/.ssh/id_ed25519` for `github.com`
- Remote URL: `git@github.com:Rumpers/77of1.git` (SSH, not HTTPS)

### Recovering push auth after a full Repl reset

1. Generate a new key: `ssh-keygen -t ed25519 -C "replit-77of1-deploy" -f ~/.ssh/id_ed25519 -N ""`
2. Print the public key: `cat ~/.ssh/id_ed25519.pub`
3. Add it as a deploy key (read-write) on `Rumpers/77of1` via GitHub Settings → Deploy keys
4. Recreate `~/.ssh/config`:
   ```
   Host github.com
     HostName github.com
     User git
     IdentityFile ~/.ssh/id_ed25519
     IdentitiesOnly yes
     StrictHostKeyChecking no
   ```
5. Run: `ssh-keyscan github.com >> ~/.ssh/known_hosts`
6. Switch remote to SSH: `git remote set-url origin git@github.com:Rumpers/77of1.git`

---

## Commit-and-Sync Convention

**Every agent working in this Replit must push to GitHub at the end of each task.** Do not leave commits unreplicated.

```bash
git add -A && git commit -m "<message>" && git push origin main
```

Commit message format:
- `feat(scope): description` for new features
- `fix(scope): description` for bug fixes
- `chore: description` for maintenance

Replit Agent commits include `Replit-Commit-*` trailers automatically — do not strip these.

---

## Development Commands

```bash
# API server (dev)
pnpm --filter @workspace/api-server run dev

# Web app (dev)
pnpm --filter @workspace/web run dev

# Full typecheck
pnpm run typecheck

# Regenerate API client + Zod schemas from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Push DB schema changes (dev only)
pnpm --filter @workspace/db run push

# Install dependencies after merge
pnpm install --frozen-lockfile
```
