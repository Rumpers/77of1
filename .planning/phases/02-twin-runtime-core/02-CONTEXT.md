---
phase: 02-twin-runtime-core
status: locked
mode: auto
captured: 2026-05-28
decided_by: founder (auto-mode resolution per planning_context directives)
---

# Phase 2 — Locked Decisions

## Decisions

- **D-02-01: Single-tenant fan-twin bot per creator.** One Telegram bot token per creator at N=1. Multi-tenant routing (deep-link `/start <handle>` resolution) deferred to v2. The fan-twin artifact reads `TELEGRAM_BOT_TOKEN_FAN_TWIN` (singular) and treats the bot identity as the creator identity. Lookup via `resolveCreatorForFanTwinBot()` returns the one creator wired to this bot (resolved by `bot.botInfo.username` or via `CREATOR_HANDLE_FAN_TWIN` env override at N=1).

- **D-02-02: Voice sample upload IN SCOPE for Phase 2 (storage only — XTTS generation stays Phase 3).** Replit Object Storage bucket creation is a Wave 4 founder checkpoint. Hermes `/voice` wizard scene downloads the Telegram voice note via existing `downloadTelegramFile` pattern and writes to `creators/{creatorId}/voice_reference.wav` plus `twins.voiceReferenceUrl` column. Actual XTTS synthesis (VOICE-01/02/03) stays Phase 3.

- **D-02-03: Drop `creator_personas` and `creator_content_embeddings` tables.** Character Card V2 lives in `twins.character_card` JSONB only. The `triggerPersonaRagIngest` call in Hermes `onboarding.ts` becomes a no-op (logged-and-skipped) for v1. RAG/Graphiti returns at creator #3-5 per PROJECT.md.

- **D-02-04: L5 founder notify = direct Telegram Bot API call from api-server.** No `founder-alert` BullMQ job; no cross-artifact import of Hermes's bot instance. The new `notify-founder.ts` helper POSTs directly to `https://api.telegram.org/bot{TOKEN}/sendMessage` using the Lala token + `FOUNDER_TELEGRAM_CHAT_ID` env var. Per RESEARCH Open Q #4 — direct outbound HTTP is acceptable (one token, multiple processes for outbound calls). The same pattern is mirrored in the worker for fan-twin outbound delivery (`new Telegraf(token)` without `.launch()`).

- **D-02-05: JP crisis helpline = `0120-279-338` (よりそいホットライン).** Overrides CLAUDE.md's stale `0120-783-556`. REQUIREMENTS.md (the source of truth for COMPLY-02) wins. Helpline string in `lib/strings/helplines.ts`: `"つらいときは、よりそいホットライン 0120-279-338 に電話できるよ。24時間365日つながるからね。"`. CLAUDE.md cleanup deferred to a chore commit; not a blocker for Phase 2 ship.

- **D-02-06: Fan-twin port = 3002.** Verified against artifact.toml and .replit in Wave 0; if 3002 is taken the Wave 0 task proposes an alternative and amends this decision. Hermes already uses `process.env.PORT` (no fixed port assigned in artifact.toml — it consumes whatever Replit assigns its artifact). Adding fan-twin as a new artifact requires both `artifact.toml` and `.replit` updates atomically (Pitfall #9).

- **D-02-07: TELEGRAM_BOT_TOKEN env var renamed to TELEGRAM_BOT_TOKEN_LALA.** Hermes reads from `TELEGRAM_BOT_TOKEN_LALA` (not `TELEGRAM_BOT_TOKEN`). New `TELEGRAM_BOT_TOKEN_FAN_TWIN` added alongside. Both required at api-server cold-start (env schema validation). Founder must rename the Replit Secret in Wave 0 before deployment.

- **D-02-08: Dark-mode-only fan UI for Phase 2.** Light mode deferred to Phase 3+. CSS variables in `artifacts/web/src/index.css` `.dark` block bind the real HSL values from UI-SPEC Color section. `:root` (light) values stay placeholder until Phase 3.

- **D-02-09: One-shot (non-streaming) LLM responses.** Streaming (`STREAM-01`) is v2. Moderation L3 must run on full LLM output atomically; speculative-display rollback is too complex for Phase 2.

- **D-02-10: Monetization CTA cadence — every 5th AI reply OR persona-pivot text match.** Server (api-server) attaches `monetization_pivot: true` + `monetization_url` + `platform_name` to response. Client renders `<MonetizationCTA />` pill when flag is true. `monetization_url` lives in `creators.monetizationUrl` column (new — added in 02-02 schema task). `platform_name` and `platform_url` are CAPTURED in the persona wizard (plan 02-07) and stored in `creators.config` JSONB as `{platform_name, platform_url, ...}`. Same `platform_url` is the value written to `creators.monetizationUrl` (so they stay in sync — single source of truth at config write time).

- **D-02-11: Refactor inline-styled `fan-page.tsx` into typed components.** Per UI-SPEC Component Inventory — extract to `artifacts/web/src/components/fan/*.tsx`. Existing 813-line page becomes a composition shell. This is Phase 2 scope (folded into Wave 1 plan 02-04 and Wave 2 plan 02-05).

- **D-02-12: SB 243 disclosure footer is server-rendered, not client-computed.** Web: api-server returns `disclosure_footer` field on every `/api/twin/chat` response. Telegram: worker appends `"\n\n— " + getDisclosureFooter(locale, handle)` before `sendMessage`. Single source of truth at `api-server/src/lib/disclosure.ts` (or `lib/strings/disclosure.ts`).

- **D-02-13: PERSONA-02 constitution storage = Replit Object Storage at `creators/{creatorId}/constitution.md`.** Per RESEARCH Architectural Responsibility Map row "Persona storage": Character Card V2 in `twins.character_card` JSONB is the structured spec; PERSONA-02 constitution is a longer free-form Markdown document the creator can hand-edit (creator's voice, taboos, lore). Stored in the SAME Replit Object Storage bucket as voice samples (D-02-02) — `REPLIT_OBJECT_STORAGE_BUCKET` env var, key `creators/{creatorId}/constitution.md`. Plan 02-07 persona wizard final step writes a STUB constitution (`# {name}'s constitution\n\n(Tell me about your world, taboos, and the things only your closest fans know. Edit this file directly.)`) so the file exists. Plan 02-02 `system-prompt.ts` attempts to fetch the file via `lib/twin-runtime` object-storage helper and PREPENDS its content to the system prompt when present. Silently skip if absent (graceful degrade — Character Card V2 alone is still a valid persona).

- **D-02-14: Skip `i18next-http-middleware` install — use inline `detectLocale(req)`.** Per RESEARCH "Don't Hand-Roll" guidance balanced against the goal of minimizing new deps for a single-handler use case. The route handler in `routes/twin.ts` calls `detectLocale(req)` directly (already exists at `lib/locale.ts` from 02-02). `i18next-http-middleware` is REMOVED from plan 02-01 Task 0 legitimacy gate and NOT installed by plan 02-03. Reconsider in Phase 3 if a second consumer needs middleware-level locale negotiation.

- **D-02-15: MOD-02 ownership = plan 02-02 (system-prompt.ts is the L2 originator).** MOD-02 is the L2 layer (Character Card V2 system_prompt guardrail). `system-prompt.ts` (built in 02-02) composes the persona meta-instruction + post_history_instructions guardrails into the LLM system prompt — that IS L2. Plans 02-05 and 02-06b consume the system-prompt output but do not author L2 themselves. Listing 02-02 as MOD-02's originator removes the "claimed by 02-05/06 but delivered by 02-02" traceability mismatch.

## Deferred Ideas

- Multi-tenant fan-twin bot routing (deep-link `/start <handle>`) — v2 when scale demands
- Streaming token-by-token LLM responses — STREAM-01 / v2
- Conversation summarization at truncation boundary (Pitfall #6) — pre-Phase-4
- Conversation-level escalation scoring (Crescendo detection) — MOD-07 / Phase 3
- Pino redact extension for `req.body.message` — fold into general hygiene commit; for Phase 2 just ban any explicit `pino.info({message: req.body.message})` call site
- `audit_log` table (distinct from `safety_audit_log`) — Phase 3
- Brand color `validateCreatorBrandColor()` WCAG check — Phase 3 hygiene; current fixtures pass
- CLAUDE.md cleanup for stale JP helpline number / stale "hermes does not use @workspace/db" — chore commit, not Phase 2

## Claude's Discretion

- Exact wave packing within the constraints above (9 plans, 6 waves after revision 1)
- Test mock harness shapes (follow `safety-audit.test.ts` pattern from PATTERNS S7)
- Helicone routing toggle in `OpenAiModeratorProvider` (optional per `HELICONE_API_KEY`)
- Exact wording of safe-deflection strings beyond the UI-SPEC table — copy verbatim from UI-SPEC
- Telegraf session storage table name (default `telegraf_sessions`; let `@telegraf/session/pg` create it)
- Whether to share `lib/strings/` as a new workspace package or inline strings into `api-server/src/lib/*` — discretion says **inline** for Phase 2 (one consumer for now), promote to `lib/strings/` if fan-twin or worker need them in Phase 3
- Exact prepend format for PERSONA-02 constitution into the system prompt (suggested: `## Constitution\n\n{constitution_md}\n\n---\n\n{existing_system_prompt}`) — verify with founder smoke once a real constitution exists
