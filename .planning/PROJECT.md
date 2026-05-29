# lala.la

## What This Is

Managed AI digital-twin service for 17 LIVE influencers (JP / TW / HK). A creator brings her persona; lala.la operates her AI twin on Telegram and the web; her fans chat with the twin and get nudged toward her existing monetization platforms (Fanvue, Patreon, 17 LIVE, her personal site). The creator pays lala.la a flat fee — there is no fan payment loop.

lala.la is plumbing, not a destination. We do not own the creator's relationship with her fans. The creator owns her likeness, LoRA, voice clone, and conversation history under a non-exclusive license and can take them back at any time.

## Core Value

A fan can open Telegram or `lala.la/[handle]`, have a convincing conversation with a creator's AI twin, and get nudged to her actual monetization platform — all within 30 seconds of first message.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Creator onboarding via Lala Telegram bot (no-tech flow: consent, persona, voice sample, character card)
- [ ] AI twin chat on `lala.la/[handle]` (web funnel page with soft CTA to creator's platforms)
- [ ] AI twin chat via Telegram fan-twin bot
- [ ] Character Card V2 persona format (SillyTavern-standard, Zod-validated JSONB)
- [ ] Six-layer moderation pipeline (OpenAI L1+L3, safe deflection, audit log, Sentry alerts)
- [ ] Entitlement middleware: `creator_kyc.status = 'signed'` gates all twin chat routes (423 until signed)
- [ ] HMAC-signed `conversation_id` per session
- [ ] Voice reply via GMI Cloud XTTS zero-shot (no ElevenLabs, no GPU needed on Replit)
- [ ] Founder OCR intake + review queue for fan-name masking
- [ ] Multi-twin schema column (public + private twin per creator; security plumbing deferred)
- [ ] Creator KYC / personality-rights agreement gate
- [ ] Parallel EN + JP + ZH-TW first-class i18n from day 1
- [ ] 30-case eval suite per creator (10 in-character + 10 boundary + 10 hard-limit); 100% hard-limit pass before twin goes live
- [ ] Compliance baseline: SB 243 AI disclosure, self-harm detection + crisis helpline injection per locale, GDPR/APPI/PDPA data minimization

### Out of Scope

- Fan payment loop / Stripe Connect / fan accounts / dunning — no fan payment ever
- Letta / Graphiti memory — until creator #3-5
- AI image generation — Phase 5+ (Illustrious XL + LoRA)
- 17 LIVE / Patreon webhook attribution — Phase 5-6
- Multi-twin RLS security plumbing — schema column ships, security deferred
- `lib/twin-engine/` bespoke engine — commodity providers only
- Apple VisionKit on-device masking — deferred
- SSE streaming chat — Phase 5+ polish
- `twin_constitutions` DB table — Markdown file for v1
- LINE / WhatsApp — Phase 6
- 5 background AI agents — founder is the agents at N=1

## Context

- **Codebase state**: Active monorepo with artifacts (api-server, web, hermes, worker, admin) and libs (db, api-spec, api-zod, api-client-react, providers, queue). Existing code uses Supabase + Drizzle; north-star calls for migrating to Replit PostgreSQL + Drizzle only. `apps/web/` is a Next.js creator dashboard in early development on this branch.
- **Week-4 schedule**: 4-week sprint to first live creator. Week 1 = baseline repair (clean-slate Replit, strip Supabase). Week 2 = twin runtime core. Week 3 = voice + surfaces + moderation. Week 4 = eval pass + launch.
- **Deployment**: Replit (everything) — api-server port 8080, web SPA port 22333, admin port 3001. Port mapping fixed by `artifact.toml` + `.replit`.
- **LLM**: GMI Cloud for text; GMI Cloud XTTS for voice. Provider registry in `lib/providers/` abstracts the swap.
- **Compliance exposure**: Real on day 1 — California SB 243, TAKE IT DOWN Act (gates Phase 5+), Texas RAIGA/NY AI Companion Bills, GDPR/APPI/PDPA, personality-rights gating.
- **Brownfield**: Existing code has Supabase client, Stripe references, and prior fan-payment scaffolding — all to be stripped or left dormant.

## Constraints

- **Platform**: Replit — do not change port mapping (8080/22333/3001) without updating `artifact.toml` and `.replit`
- **Package manager**: pnpm only — preinstall hook blocks npm/yarn
- **Database**: Replit PostgreSQL + Drizzle — Supabase being replaced in Week 1; do not extend Supabase usage
- **AI providers**: GMI Cloud for LLM + XTTS; commodity-provider-only mandate (no bespoke engine)
- **Payments**: No fan payment loop, ever — Stripe/dunning code stays dormant
- **Timeline**: 4-week sprint to first live creator (started 2026-05-27)
- **Scale at N=1**: Founder operates as all 5 background agents; no automation budget for them yet
- **Generated files**: `lib/api-zod/` and `lib/api-client-react/` are generated from `openapi.yaml` — do not hand-edit

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Replit as sole platform | One platform, simple deploys, co-located DB | — Pending |
| GMI Cloud XTTS for voice | No GPU on Replit; no ElevenLabs ToS issue | — Pending |
| Character Card V2 persona format | Industry standard, portable, Zod-validated | — Pending |
| Non-exclusive creator license | Creator owns her IP; lala.la is plumbing | — Locked |
| No fan payment loop | Product charges creator flat fee; avoid payment complexity | — Locked |
| Flat fee / manual invoice for Week 4 | No real conversion signal until Phase 5-6 webhooks land | — Locked |
| Plain context window for RAG (N=1) | Graphiti+Neo4j at creator #3-5 horizon | — Locked |
| Markdown twin constitution v1 | DB table deferred; Markdown sufficient for N=1 | — Locked |
| Supabase → Replit PG (Week 1) | Simplify stack, remove external DB dependency | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-27 after initialization from north-star.md*
