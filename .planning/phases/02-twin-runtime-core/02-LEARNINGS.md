---
phase: 2
phase_name: "Twin Runtime Core"
project: "lala.la"
generated: "2026-05-29"
counts:
  decisions: 12
  lessons: 12
  patterns: 10
  surprises: 8
missing_artifacts: []
---

# Phase 2 Learnings: Twin Runtime Core

## Decisions

### Single-tenant fan-twin bot per creator (D-02-01)
At N=1, one Telegram bot token equals one creator. `resolveCreatorForFanTwinBot()` returns the single creator wired to the bot via `bot.botInfo.username` or a `CREATOR_HANDLE_FAN_TWIN` env override. Deep-link `/start <handle>` multi-tenant routing deferred to v2.

**Rationale:** Avoids building a routing layer that has no consumers at N=1; bot identity = creator identity is the simplest correct model for the first creator.
**Source:** 02-CONTEXT.md

### Voice sample upload IN SCOPE; XTTS synthesis OUT (D-02-02)
Hermes `/voice` wizard downloads the Telegram voice note and writes to `creators/{creatorId}/voice_reference.wav` + `twins.voiceReferenceUrl`. Actual XTTS generation (VOICE-01/02/03) stays Phase 3. Replit Object Storage bucket creation is a founder checkpoint.

**Rationale:** Capture-now/synthesize-later lets Phase 2 close the consent + storage loop without GPU/XTTS dependency; Phase 3 can swap in the generation path against an already-populated reference URL.
**Source:** 02-CONTEXT.md

### Drop `creator_personas` and `creator_content_embeddings` tables (D-02-03)
Character Card V2 lives in `twins.character_card` JSONB only. `triggerPersonaRagIngest` becomes a logged no-op. RAG/Graphiti returns at creator #3–5 per PROJECT.md.

**Rationale:** N=1 fits in a plain context window; the second persona store + embedding pipeline would be dead infra until creator #3.
**Source:** 02-CONTEXT.md

### L5 founder-notify = direct Telegram Bot API POST, not a Hermes import (D-02-04)
`lib/twin-runtime/src/notify-founder.ts` POSTs to `https://api.telegram.org/bot{TOKEN}/sendMessage` using the Lala token + `FOUNDER_TELEGRAM_CHAT_ID`. No cross-artifact import of Hermes's bot instance; no `founder-alert` BullMQ job.

**Rationale:** One token can be reused by multiple processes for outbound calls. Avoids coupling api-server / worker to the Hermes artifact lifecycle.
**Source:** 02-CONTEXT.md

### JP crisis helpline locked to `0120-279-338` (D-02-05)
よりそいホットライン. Overrides CLAUDE.md's stale `0120-783-556`. Hardcoded in `lib/twin-runtime/src/helplines.ts`; REQUIREMENTS.md is the source of truth for COMPLY-02.

**Rationale:** SB 243 self-harm protocol requires a specific number per locale; cannot be LLM-generated (T-02-05-02). Number is locked in code + asserted by helpline-injection tests.
**Source:** 02-CONTEXT.md

### TELEGRAM_BOT_TOKEN renamed to TELEGRAM_BOT_TOKEN_LALA + new TELEGRAM_BOT_TOKEN_FAN_TWIN (D-02-07)
Two separate tokens (one creator-side Hermes bot, one fan-facing twin bot) enforced as required by the api-server env schema. Founder must rename the Replit Secret before deployment.

**Rationale:** Separate bot tokens = separate bot personas = separate webhook URLs. Multiplexing fan and creator traffic on one token is wrong by construction.
**Source:** 02-CONTEXT.md

### Dark-mode-only fan UI for Phase 2 (D-02-08)
`.dark` block in `artifacts/web/src/index.css` binds real HSL values per UI-SPEC. `:root` (light) values stay `red /*replace*/` placeholders until Phase 3.

**Rationale:** Picking one theme cuts visual QA surface in half during the 4-week sprint; light mode has no SB 243 compliance bearing.
**Source:** 02-CONTEXT.md, 02-04-SUMMARY.md

### One-shot (non-streaming) LLM responses (D-02-09)
Streaming is v2. L3 moderation must run on full LLM output atomically; speculative-display rollback is too complex for Phase 2.

**Rationale:** Streaming + moderation requires either accepting an unmoderated head-of-stream or building rollback UX. Neither is acceptable for SB 243 Day-1 compliance.
**Source:** 02-CONTEXT.md

### Monetization CTA cadence = every 5th AI reply (D-02-10)
Server attaches `monetization_pivot: true` + `monetization_url` + `platform_name` to the response. Client renders `<MonetizationCTA />` when flag true. `monetization_url` lives in `creators.monetizationUrl` column; `platform_name`/`platform_url` are CAPTURED in the persona wizard and stored in `creators.config` JSONB. The same `platform_url` is mirrored into `creators.monetizationUrl` at config write so they stay in sync (single SQL UPDATE).

**Rationale:** Server-side counter has no client-state edge cases; `(assistantTurnCount % 5 === 0)` is trivial to reason about and easy to tune later.
**Source:** 02-CONTEXT.md, 02-07-SUMMARY.md

### SB 243 disclosure footer is server-rendered (D-02-12)
api-server returns `disclosure_footer` on every `/api/twin/chat` response; worker appends `"\n\n— " + getDisclosureFooter(locale, handle)` before `sendMessage`; fan-twin `/start` appends it too. Single source of truth at `lib/twin-runtime/src/disclosure.ts`.

**Rationale:** Compliance text MUST NOT diverge across surfaces. A client-computed footer can be bypassed by a stale build; a server-rendered one cannot.
**Source:** 02-CONTEXT.md

### PERSONA-02 constitution = Replit Object Storage at `creators/{creatorId}/constitution.md` (D-02-13)
Persona wizard writes a stub on completion. `system-prompt.ts` fetches the file via `readConstitution(creatorId)` and PREPENDS its content as `## Constitution\n\n{md}\n\n---\n\n{rest}`. Silently skips if absent — Character Card V2 alone remains a valid persona.

**Rationale:** Constitution is a free-form Markdown document the creator hand-edits (voice, taboos, lore); Character Card V2 JSONB is the structured spec. Two artifacts, two storage layers, one composed prompt.
**Source:** 02-CONTEXT.md, 02-02-SUMMARY.md

### MOD-02 ownership = plan 02-02 (D-02-15)
`system-prompt.ts` (built in 02-02) is the L2 originator — it composes the persona meta-instruction + post_history_instructions guardrails into the LLM system prompt. Plans 02-05 / 02-06b consume the output but do not author L2.

**Rationale:** Removes a traceability mismatch where MOD-02 was being "claimed by 02-05/06 but delivered by 02-02". Ownership now matches authorship.
**Source:** 02-CONTEXT.md

---

## Lessons

### Schema push is a founder checkpoint, not an executor action
`pnpm --filter @workspace/db run push` requires `DATABASE_URL`, which is auto-injected only in the Replit Shell. The executor sandbox runs without it. The 02-02 plan listed schema push as `gate="blocking"` for downstream Wave 2 plans; the executor surfaced it as a non-blocking Schema Push Checkpoint and shipped lib code that uses lazy `getDb()` so unit tests pass without `DATABASE_URL`. Downstream plans needed the columns at runtime, not compile time.

**Context:** Same pattern as the Phase 1 `push-verification.txt` — schema migrations are inherently founder-bound in a Replit-only DB topology.
**Source:** 02-02-SUMMARY.md

### Vitest hoisting forbids top-level closure references inside `vi.mock`
The persona-wizard test had to push `characterCardV2Schema` *into* the `vi.mock` factory body because vitest's mock-hoisting transform raises the `vi.mock(...)` calls above all top-level imports. Any closure-captured reference to an imported symbol at the time the factory runs will be undefined. Same issue surfaced for fan-twin webhook tests where `process.env.X = "y"` assignments at the top of the test file ran AFTER `vi.mock` had already triggered module evaluation.

**Context:** Workaround for fan-twin was a `setupFiles` entry (`__tests__/setup-env.ts`) that sets env synchronously before any test module loads. Workaround for the schema reference was re-declaring it inside the mock factory.
**Source:** 02-07-SUMMARY.md, 02-06b-SUMMARY.md

### A workspace package "barrel" import pulls every leaf dep at module load
The first attempt at the twin-runtime extraction used a single barrel export (`export * from "@workspace/twin-runtime"`) in each api-server shim. Four unit tests immediately failed with `Error: DATABASE_URL must be set` because the barrel transitively pulled `safety-audit.ts → @workspace/db` at top-level — even tests that only needed pure-string helpers like `getDisclosureFooter` or `detectLocale`. Fix was a 14-entry subpath `exports` map in the package.json so each shim re-exports from `@workspace/twin-runtime/<name>` and preserves per-file load semantics.

**Context:** Per-subpath exports are the load-semantics safety net when extracting a shared library that contains both pure and DB-touching modules.
**Source:** 02-06a-SUMMARY.md

### `instanceof` checks force a single source of truth across the package boundary
`routes/twin.ts` does `err instanceof ProviderError`. When the twin-runtime extraction tried to redeclare `ProviderError` in two places (api-server + twin-runtime), the instanceof check would silently fail because class identity is per-module. Fix: created `lib/twin-runtime/src/provider-types.ts` as the canonical owner, and api-server's `providers/interfaces.ts` re-exports from there.

**Context:** Same root cause applies to any thrown error class, scene class, or anything checked with `instanceof` that crosses workspace packages.
**Source:** 02-06a-SUMMARY.md

### Vitest `vi.mock` of a sibling module replaces all exports, breaking module-load registrations
The twin-runtime moderation refactor introduced `setModeratorProviderFactory(getModeratorProvider)` at module load in the api-server shim. The existing `twin-chat.e2e.test.ts` did `vi.mock("../providers/registry.js", () => ({ getTextProvider: ... }))` — fully replacing the module, so `getModeratorProvider` became undefined. Pre-refactor the missing function silently fell through twin-runtime's FAIL-OPEN catch; the eager registration broke that. Fix: registered a factory function that does `import * as registry` and throws *inside the body* on missing export, restoring the FAIL-OPEN catch behavior bit-for-bit.

**Context:** When refactoring, preserve the failure-path shape — not just the success path — because tests mock around the success path.
**Source:** 02-06a-SUMMARY.md

### Telegraf hits `getMe` at first `handleUpdate` call
Test runs of the fan-twin webhook hit `api.telegram.org` and timed out because Telegraf's internal `getMe()` is invoked once to populate `bot.botInfo`. Workaround in the test: `(bot as unknown as { botInfo: unknown }).botInfo = { id: 1, ... }` after construction skips the network round-trip entirely.

**Context:** Any test that calls `bot.handleUpdate(...)` against a real Telegraf instance must prime `botInfo` or stub the network layer.
**Source:** 02-06b-SUMMARY.md

### `@telegraf/session/pg` requires `kysely` at runtime even though peer is "optional"
The first import of Hermes's session.ts without `kysely` installed threw `Cannot find module 'kysely'`. The package marks `kysely` as an optional peer, but the Postgres adapter is implemented on top of `KyselyStore` and is in fact mandatory. Installing `kysely@^0.27.6` in hermes resolved the runtime error but introduced a drizzle-orm peer-dedupe issue (two variants of drizzle-orm with different peer contexts → SQL<unknown> identity errors between hermes/db.ts and @workspace/db tables). Final fix: add `kysely` to lib/db's devDeps so both packages resolve drizzle-orm into the same peer variant.

**Context:** "Optional peer" in package.json is a documentation hint, not a runtime guarantee. Always import-smoke a new adapter package before treating the peer as optional.
**Source:** 02-07-SUMMARY.md

### Pre-existing `TS6305` errors from stale `dist/` outputs are an environment hygiene issue, not a code bug
Every Phase 2 plan ran into `tsc --noEmit` flagging `Output file 'lib/db/dist/index.d.ts' has not been built from source file ...` errors. Root cause: api-server's tsconfig declares project references to lib/db, lib/api-zod, lib/queue, and the worktree starts with stale or missing `dist/` outputs. Fix: a one-time `tsc -b lib/db lib/queue lib/api-zod` (or `pnpm install --frozen-lockfile`) before each typecheck. The fix is NOT committed — `dist/` regenerates from source on demand.

**Context:** Documented in 02-01-SUMMARY "Deferred Issues" and re-surfaced in every later SUMMARY. Treat it as boilerplate environment prep, not a regression.
**Source:** 02-02-SUMMARY.md, 02-06a-SUMMARY.md

### Replit's per-artifact `artifact.toml` lives under `artifacts/<name>/.replit-artifact/`, not at repo root
Plan 02-01 listed a single root `artifact.toml`. The repo actually uses one `artifact.toml` per artifact under `artifacts/<name>/.replit-artifact/`. The executor confirmed via `find .` (five existing copies under api-server, hermes, worker, web, mockup-sandbox) and created `artifacts/fan-twin/.replit-artifact/artifact.toml` to match. Atomic port allocation (Pitfall #9) still honored because port 3002 lives in both `.replit` AND the new per-artifact file, both staged in one commit.

**Context:** Path discovery beats plan-text fidelity when the plan diverges from on-disk layout.
**Source:** 02-01-SUMMARY.md

### FAIL-OPEN vs FAIL-CLOSED on moderation provider failure is a design decision, not a default
When `OpenAiModeratorProvider` throws (OpenAI 5xx, network error), the plan didn't specify behavior. Naive options: throw (fail-closed → twin dies whenever OpenAI is down) or return `flagged: true` (fail-pessimistic → twin sends a deflection to every benign message during an outage). Chose **fail-open** with documented rationale (lines 92–105 of `moderation.ts`): L2 system prompt is the in-band guardrail; L1/L3 are belt-and-braces; SB 243 self-harm coverage requires category SCORES from OpenAI — without them, the helpline cannot be meaningfully injected anyway.

**Context:** Trade-off recorded inline in code so future engineers don't "fix" it.
**Source:** 02-05-SUMMARY.md

### Monetization pivot must be suppressed on flagged turns
The original pipeline computed `monetization_pivot = assistantTurnCount % 5 === 0` unconditionally. On a flagged L3 turn this would append a sales nudge to a safety deflection. UI-SPEC State Inventory + CHAT-05 both imply trial/CTA UX is suppressed on flagged turns. Fix: `const monetization_pivot = !l3.flagged && assistantTurnCount % 5 === 0`.

**Context:** Defensive cross-feature interaction discovered while wiring L3 splice; not caught by plan review.
**Source:** 02-05-SUMMARY.md

### Workers cannot reach into a sibling artifact's `getTextProvider()` — use `@workspace/providers` `GmiClient` directly
The 02-06b plan referenced `getTextProvider()` for the worker LLM call. `getTextProvider` lives in `artifacts/api-server/src/providers/registry.ts` and is NOT exported from any shared workspace lib. `@workspace/providers` `createRegistry()` explicitly throws on `gmi` mode with a comment "GmiTextProvider is app-local". Fix: built an inline `gmiChatCompletion()` helper in the worker that uses `GmiClient.fromEnv()` directly — same DeepSeek-V3.2 model, same Helicone routing, same retry behavior.

**Context:** Reaching into a sibling artifact's source breaks workspace isolation. The provider class is correctly app-local; the GMI HTTP plumbing is the right reuse boundary.
**Source:** 02-06b-SUMMARY.md

---

## Patterns

### Per-subpath `exports` map for shared workspace packages
When extracting a lib that mixes pure helpers and DB-touching modules, publish each module under its own subpath (`@workspace/foo/disclosure`, `@workspace/foo/conversation`, …) rather than a single barrel. Each consumer imports only what it needs; pure-helper unit tests don't pay the `@workspace/db` load cost.

**When to use:** Any shared workspace package with >5 modules and mixed load semantics.
**Source:** 02-06a-SUMMARY.md

### Dependency-injection seam for provider-agnostic shared libraries
`lib/twin-runtime/src/moderation.ts` exposes `setModeratorProviderFactory(factory)`; the api-server shim registers `getModeratorProvider` at module load. twin-runtime stays provider-agnostic; concrete OpenAI/mock providers live in the consumer.

**When to use:** Any shared lib that needs to call into a consumer-owned singleton (provider, client, store). Avoids circular workspace deps.
**Source:** 02-06a-SUMMARY.md

### Lazy `getDb()` dynamic import (PATTERNS S1)
Every lib/middleware in twin-runtime uses `async function getDb() { return (await import("@workspace/db")) }` instead of a top-level import. Tests pass without `DATABASE_URL`; production behavior unchanged.

**When to use:** Any module that touches `@workspace/db` but might be imported by code paths that don't need the DB (unit tests, build-time tooling, type-only consumers).
**Source:** 02-02-SUMMARY.md, 02-06a-SUMMARY.md

### Lazy session-store proxy for `@telegraf/session/pg`
Hermes's `session.ts` wraps the Postgres adapter in a lazy proxy that defers `Postgres({ pool })` instantiation until the first session read/write. Importing the module at module load (e.g. from index.ts or vitest) does NOT throw without `DATABASE_URL`.

**When to use:** Any persistent-session adapter whose constructor touches env vars or sockets — defer to first use so test imports are cheap.
**Source:** 02-07-SUMMARY.md

### vitest `setupFiles` to set env before vi.mock hoisting
A small file like `src/__tests__/setup-env.ts` with `process.env.X ??= "test-value"` assignments, registered via vitest's `setupFiles`, runs synchronously before all test modules and beats the vi.mock hoist.

**When to use:** Any test suite whose module-under-test reads env vars at top level.
**Source:** 02-06b-SUMMARY.md

### Per-prompt capture step factory for WizardScene
Persona scene uses `makeCaptureStep(captureIndex)` to avoid hand-rolling 8 near-identical step handlers. The factory pairs each step with the matching `PROMPTS[i]` entry so the wizard sequence is data-driven.

**When to use:** Any multi-step Telegraf WizardScene with ≥4 prompts that share capture semantics.
**Source:** 02-07-SUMMARY.md

### RED test header convention
Every Wave-0 stub test starts with `// RED test for {REQ-ID} — will GREEN when plan 02-NN ships {feature}.` and uses `it.todo()` bodies so suites run green while documenting future intent.

**When to use:** Any Wave-0 plan that stages tests for downstream feature plans. Keeps CI green during the RED→GREEN transition window.
**Source:** 02-01-SUMMARY.md

### Persist-user-turn BEFORE provider call
Both `routes/twin.ts` and the worker pipeline persist the user turn into `conversation_messages` BEFORE invoking GMI. If the LLM throws, the user's input is still in the transcript — matches the CHAT-04 D-03 analytics requirement that every fan input is visible to the creator dashboard.

**When to use:** Any LLM call where input retention is a separate concern from output retention.
**Source:** 02-03-SUMMARY.md

### Async-ACK webhook + jobId-dedup pattern for Telegram bots
Fan-twin webhook handler ONLY enqueues with `jobId='tg-{update_id}'` — no `ctx.reply`, no LLM I/O, no DB writes. Returns 200 in <100ms. Worker drains and delivers via a separate outbound Telegraf instance constructed WITHOUT `.launch()` so it doesn't fight the webhook. BullMQ natively dedupes on identical jobId, so duplicate webhook deliveries (Telegram retry storms) collapse into one job.

**When to use:** Any Telegram bot whose handler does work beyond a few milliseconds — the 60s webhook timeout is too tight for LLM calls.
**Source:** 02-06b-SUMMARY.md

### Hashed `fan_id` at the provider boundary
`hashFanId(conversationId) = sha256("fan:" + conversationId).slice(0, 32)` is what's passed to GMI/Helicone — never the raw cookie, never an IP, never an email. Even though `conversation_id` is itself HMAC-derived, the second hash adds defense in depth before crossing the provider boundary.

**When to use:** Any per-user cost dashboarding via a third-party observability tool. Hash once at the boundary; never log the raw identifier alongside the hash.
**Source:** 02-03-SUMMARY.md

---

## Surprises

### Plan 02-06 split into 02-06a + 02-06b during execution
Originally a single plan covering twin-runtime extraction + fan-twin scaffolding + worker pipeline fill. Split into a refactor-only plan (02-06a) and a feature plan (02-06b) so the extraction could land cleanly without dragging in 6+ new files of pipeline logic. Tracked as wave-6-of-6 in 02-06b's "Phase status" block.

**Impact:** Two clean commits + two summaries instead of one monster commit. Kept the regression-test baseline assertable (02-06a aimed for IDENTICAL pass count vs 02-05; 02-06b added net-new tests).
**Source:** 02-06b-SUMMARY.md, 02-06a-PLAN.md

### Worker `consent-revocation.ts` was already implemented, not a stub
Plan 02-08 Task 2 said "Fill the stub" with literal code that referenced a phantom `cancelled_at` column. The existing worker was a complete implementation using `completed_at + error_message` per the actual schema (`lib/db/src/schema/index.ts:323`). Writing the plan's literal code would have regressed working logic. Executor reframed Task 2 as "enhance SLA observability" — added modality logging + 60s SLA WARN on both matched-jobs and empty-match paths.

**Impact:** Plan-spirit-over-plan-letter call; ONBOARD-03 still satisfied. Documented as Rule 3 deviation #1 in 02-08.
**Source:** 02-08-SUMMARY.md

### `fan-page.tsx` overshot the 250-line budget by 14 lines
Target was 200, hard cap 250; final landed at 264 lines. Functionally a composition shell (10 fan/* imports + LocaleSwitcher + Crisis + Monetization + minor helpers) but the budget assertion is "soft" — verification flagged PARTIAL with WARNING, not BLOCKER.

**Impact:** 02-VERIFICATION rates this as INFO-severity. Recommends WARNING-not-BLOCKER. No remediation planned for Phase 2; potential cleanup in Phase 3 component review.
**Source:** 02-04-SUMMARY.md, 02-VERIFICATION.md

### CLAUDE.md still asserts "artifacts/hermes does not use @workspace/db"
Stale assertion from Phase 1 architecture. Hermes now uses `@workspace/db` extensively (db.ts, consent.ts, all wizard scenes). Cleanup deferred to a chore commit per 02-CONTEXT.md "Deferred Ideas".

**Impact:** Docs drift; no functional issue. Future readers may be misled if they take CLAUDE.md as authoritative.
**Source:** 02-07-SUMMARY.md, 02-CONTEXT.md

### `/consent_status` command silently dropped — not re-implemented
The old `/consent_status` command was a workaround for the in-memory Map losing state on restart. With `@telegraf/session/pg`, scene state is durable, so the creator can just send `/consent` again and the wizard resumes from the right step. Executor decided re-implementing /consent_status against scene state would add no user-visible value (the scene's prompts ARE the progress indicator).

**Impact:** Command removed from index.ts; the scene's natural re-entry semantics replace it. Documented as a [Style] deviation in 02-07.
**Source:** 02-07-SUMMARY.md

### Founder-approved `@telegraf/session` at a `beta.7` version
The Wave 0 package legitimacy gate locked in `@telegraf/session@2.0.0-beta.7`. Beta software in production for an SB 243 compliance phase. Stable v2 has not shipped as of 2026-05.

**Impact:** Production session storage runs on beta code. Mitigation is the founder approval gate + the lazy proxy pattern that limits blast radius if the package misbehaves. Future stable release should be a one-line bump.
**Source:** 02-01-SUMMARY.md, 02-CONTEXT.md

### `git stash` was used twice during execution despite the worktree prohibition
Plan 02-03 and 02-05 both used `git stash` + `git stash pop` to verify whether a test failure was pre-existing on the base commit. Worktree rules prohibit stash because `refs/stash` is shared across worktrees. No leakage occurred in either case (verified via `git status --short`), but the violation was self-reported in both SUMMARYs with the sanctioned alternative: throwaway scratch branch (`git checkout -b scratch-...`) or `git show <ref>:<path>`.

**Impact:** No data loss; flagged for future executor agent guidance. Pattern is now documented twice and shouldn't recur.
**Source:** 02-03-SUMMARY.md, 02-05-SUMMARY.md

### Helpline test asserted CLAUDE.md's stale `0120-783-556` instead of D-02-05's `0120-279-338`
The Wave 0 RED stub for `helpline-injection.test.ts` was written against CLAUDE.md's number. D-02-05 (set later in CONTEXT.md) locked the correct number. Executor for 02-05 caught the mismatch when writing the GREEN body and rewrote the test against `0120-279-338` + `よりそいホットライン`, with cross-locale assertions (988, 1925, 2389 2222) to lock the entire helpline table.

**Impact:** Locked decision beats stale CLAUDE.md. Reinforces that CONTEXT.md decisions override CLAUDE.md when they conflict. CLAUDE.md cleanup still deferred.
**Source:** 02-05-SUMMARY.md
