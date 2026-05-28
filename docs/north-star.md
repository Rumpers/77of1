# lala.la — North Star

The one-screen reference for this project. If something in the codebase disagrees with this doc, this doc wins until the doc is updated.

Generated from /plan-ceo-review + /plan-eng-review (2026-05-27).

## What lala.la is

Managed AI digital-twin service for **17 LIVE influencers** (JP / TW / HK). A creator brings her persona; lala.la operates her twin on Telegram and the web; her fans chat with the twin and get nudged to her existing monetization platforms (Fanvue, Patreon, 17 LIVE itself, her personal site).

**lala.la is plumbing, not a destination.** We do not own the relationship. The creator owns her likeness, her LoRA, her voice clone, her conversation history. She can take them back at any time. Non-exclusive license.

**We are not reinventing AI girlfriend tech.** Commodity providers do the LLM, voice, RAG, and image work. Our custom code is the no-tech creator onboarding (Lala bot), attribution/billing rails, and personality-rights/consent layer.

## 11 locked strategic decisions

1. Customer = creator (not fan). Creator pays lala.la from her own platform revenue.
2. Pure rev-share, target 25-30% of attributable AI-twin-driven revenue on host platforms — but week-4 launch uses **flat fee or manual invoice** until real conversion signal (Patreon webhook, 17 LIVE webhook) lands in Phase 5-6.
3. **Lala** = creator's single agent (renamed from Hermes). 5 background agents stay deferred; founder is the agents at N=1.
4. **The Twin** is separate from Lala — fan-facing AI persona on Telegram bot, web funnel, future widget/IG.
5. Multi-twin per creator (e.g., public + hidden private). Schema column shipped from day 1; security plumbing (`app.current_twin_id`) deferred.
6. Twin has an evolvable **constitution** stored as a Markdown file v1, DB table later.
7. Telegram-first for both Lala and fan-twin. LINE / WhatsApp follow in Phase 6.
8. Languages: parallel EN + JP + ZH-TW first-class from day 1.
9. Server-side OCR + blur fan-name masking with founder-review queue for uncertain masks. Apple VisionKit on-device deferred.
10. First fan-facing surfaces: Telegram fan-twin bot + funnel page `lala.la/[handle]` (chat + soft CTA → her monetization). Page stacks alongside her existing Linktree, never replaces it.
11. No fan payment loop, ever. Fan-payment scaffolding from the prior direction stays dormant in git history.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | Replit (everything) | One platform, simple deploys |
| DB | Replit PostgreSQL | Co-located with api-server |
| ORM | Drizzle | Type-safe, lightweight, schema-as-code |
| Object storage | Replit Object Storage | S3-compatible, native |
| LLM | GMI Cloud (text) | Commodity; provider registry already abstracted |
| Voice | GMI Cloud XTTS (zero-shot) | No GPU needed on Replit; no ElevenLabs ToS issue |
| RAG | Plain context window for N=1 | Graphiti+Neo4j upgrade at creator #3-5 horizon |
| Persona format | SillyTavern Character Card V2 | Industry standard, Zod-validated JSONB |
| Moderation | OpenAI Moderation API (L1+L3) | Two checks per turn, ~$0.30/day at warm-lead scale |
| Bots | Telegraf v4 | Already in place |
| Web | React + Vite | Already in place |
| Tests | Vitest + Playwright | Vitest project-wide, Playwright for fan-page E2E |

## What we are NOT building

- Letta or Graphiti memory (until creator #3-5 lands)
- Stripe Connect creator-side billing (manual invoice for first creator)
- AI image generation (Phase 5+ with Illustrious XL + creator LoRA)
- 17 LIVE / Patreon webhook attribution (Phase 5-6)
- Multi-twin RLS security plumbing (schema column only)
- `lib/twin-engine/` bespoke engine (Reframe A — commodity providers)
- Apple VisionKit on-device masking
- SSE streaming chat (Phase 5+ polish)
- `twin_constitutions` DB table (Markdown for v1)
- Stripe / fan payments / refunds / dunning / fan account recovery (dormant from prior direction)

## Compliance baseline

We have real legal exposure on day 1, not just "lawyers will figure it out."

- **California SB 243** — AI disclosure ✓, self-harm detection (OpenAI moderation `self-harm` category), crisis helpline injection per locale, take-a-break nudge.
- **Federal TAKE IT DOWN Act** — gates Phase 5+ image gen (CSAM filter + non-consent protections).
- **Texas RAIGA, NY AI Companion Bills** — content limits, human-in-loop oversight.
- **GDPR / Japan APPI / Taiwan PDPA** — data minimization, encrypted transcripts, fan-side DSAR.
- **Personality-rights gating** — `creator_kyc.status = 'signed'` required at `/api/twin/[handle]/chat` route entry. Twin returns 423 until signed.

## Six-layer moderation pipeline (minimal form for week 4)

```
fan message → L1 OpenAI moderation (input) → L2 Character Card V2 system_prompt + post_history_instructions
            → LLM call → L3 OpenAI moderation (output) → L4 pre-canned safe deflection per locale
            → L5 founder Sentry alert + Lala notify on high-risk → L6 audit_log on every flagged turn
            → fan
```

Eval gate per creator: 30 hand-written cases (10 in-character + 10 boundary + 10 hard-limit). 100% pass on hard-limit before twin goes live. Weekly regression cron.

## 4-week schedule (Approach B — first-creator-first)

```
Week 1  Baseline repair (clean-slate Replit + Drizzle refactor; ~4 days)
        Delete apps/web/, apps/hermes/, apps/worker/; strip Supabase; init Drizzle
        schema from scratch; replace Supabase client; swap Storage; smoke test.
        LEGAL kicks off personality-rights agreement drafting.

Week 2  Twin runtime core (sync chat, Character Card V2, conversation_id HMAC,
        entitlement middleware, multi-twin schema column).

Week 3  Voice (GMI XTTS zero-shot), intake handlers (OCR + founder-review queue),
        both surfaces wiring (web funnel + Telegram fan-twin bot artifact),
        moderation layers L1-L4 wired.

Week 4  Warm-lead creator personality-rights signed, 30-case eval passes,
        twin LIVE on both surfaces, first fans chat, first attribution events
        land. Founder on 2h on-call SLA.
```

## Parallelization

```
Lane A (week 1, blocks all):       Drizzle schema + Supabase client replacement
Lane B (weeks 2-4, api-server):    twin route + entitlement + moderation + voice + attribution
Lane C (weeks 2-3, web):           fan page paywall→CTA + cookie binding
Lane D (weeks 2-3, new artifact):  fan-twin Telegram bot
Lane E (weeks 2-3, hermes):        intake handlers + character card builder + founder-notify
Lane F (weeks 3-4, launch gate):   30-case eval + native-speaker UX pass per locale
```

## Open questions tracked

- Replit "Always On" budget (~$20/mo for 3 deploys)
- pgvector availability on Replit PG — verify week 1 day 1
- GMI XTTS zero-shot contract — verify reference-audio synth works as documented
- HMAC signing key rotation + session-refresh flow
- Founder reachability across JST/CST/HKT vs US time zones during week 3-4

## Review history

- **2026-05-27 — /plan-ceo-review** — REDUCTION mode; Approach B; Reframe A; Pattern A. 33 decisions locked. CEO CLEARED.
- **2026-05-27 — /codex-plan-review** — 13 substantive issues surfaced (attribution=clicks not revenue, RLS bypassed by service role, ElevenLabs ToS, creator_kyc duality, sync chat lacking timeout/idempotency, etc.). All addressed in eng review.
- **2026-05-27 — /plan-eng-review** — Supabase dropped for Replit + Drizzle; AllTalk replaced by GMI XTTS; 11 decisions locked. 0 unresolved. ENG CLEARED.

## How to read this doc

Update this file when a locked decision changes. Never silently drift from it. If something in the code disagrees, the code is wrong until the doc is also updated to match.
