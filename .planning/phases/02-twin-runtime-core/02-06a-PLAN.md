---
phase: 02-twin-runtime-core
plan: 06a
type: execute
wave: 5
depends_on: [02-02, 02-05]
files_modified:
  - lib/twin-runtime/package.json
  - lib/twin-runtime/tsconfig.json
  - lib/twin-runtime/src/index.ts
  - lib/twin-runtime/src/moderation.ts
  - lib/twin-runtime/src/conversation.ts
  - lib/twin-runtime/src/hmac-conversation.ts
  - lib/twin-runtime/src/system-prompt.ts
  - lib/twin-runtime/src/constitution.ts
  - lib/twin-runtime/src/disclosure.ts
  - lib/twin-runtime/src/deflections.ts
  - lib/twin-runtime/src/helplines.ts
  - lib/twin-runtime/src/notify-founder.ts
  - lib/twin-runtime/src/locale.ts
  - artifacts/api-server/src/lib/moderation.ts
  - artifacts/api-server/src/lib/conversation.ts
  - artifacts/api-server/src/lib/hmac-conversation.ts
  - artifacts/api-server/src/lib/system-prompt.ts
  - artifacts/api-server/src/lib/constitution.ts
  - artifacts/api-server/src/lib/disclosure.ts
  - artifacts/api-server/src/lib/deflections.ts
  - artifacts/api-server/src/lib/helplines.ts
  - artifacts/api-server/src/lib/notify-founder.ts
  - artifacts/api-server/src/lib/locale.ts
  - artifacts/api-server/package.json
  - lib/queue/src/types.ts
  - lib/queue/package.json
  - artifacts/worker/package.json
  - artifacts/fan-twin/package.json
  - pnpm-workspace.yaml
autonomous: true
requirements: [CHAT-02, CHAT-06]
tags: [phase-2, twin-runtime, shared-lib, refactor, payload-extension]

must_haves:
  truths:
    - "lib/twin-runtime/ exists as a workspace package with the 10 lib files (moderation, conversation, hmac-conversation, system-prompt, constitution, disclosure, deflections, helplines, notify-founder, locale)"
    - "artifacts/api-server/src/lib/* are thin re-exports from @workspace/twin-runtime — existing api-server import sites unchanged"
    - "api-server typechecks AND all existing api-server tests pass after the lib move (zero regression)"
    - "TextGenerationPayload extended with locale, conversationId, deliveryChannel, telegramChatId, twinId, handle — type-checked at compile time"
    - "artifacts/worker, artifacts/fan-twin, lib/queue, artifacts/api-server all declare @workspace/twin-runtime as a workspace dep"
  artifacts:
    - path: "lib/twin-runtime/"
      provides: "New workspace package — 10 shared lib files for the twin pipeline (consumed by api-server, worker, fan-twin)"
    - path: "lib/twin-runtime/src/index.ts"
      provides: "Barrel re-export of all 10 sub-modules"
    - path: "lib/queue/src/types.ts"
      contains: "extended TextGenerationPayload with locale + conversationId + deliveryChannel + telegramChatId + twinId + handle"
  key_links:
    - from: "artifacts/api-server/src/lib/moderation.ts"
      to: "@workspace/twin-runtime moderation"
      via: "re-export"
      pattern: "export.*from.*twin-runtime"
    - from: "artifacts/worker/package.json"
      to: "@workspace/twin-runtime"
      via: "workspace:* dependency"
      pattern: "@workspace/twin-runtime"
    - from: "artifacts/fan-twin/package.json"
      to: "@workspace/twin-runtime"
      via: "workspace:* dependency"
      pattern: "@workspace/twin-runtime"
---

<objective>
Wave 5a (split out of original 02-06 per checker WARNING 7): extract the 10 twin-runtime lib files from `artifacts/api-server/src/lib/` into a new shared workspace package `@workspace/twin-runtime`. Extend `TextGenerationPayload` with the Telegram-delivery contract fields. Wire the new package into api-server / worker / fan-twin / queue manifests. NO behavior change — pure refactor + payload type extension.

Purpose: The fan-twin scaffold (02-06b) and worker text-generation pipeline (02-06b Task 2) need to import these libs. Reaching into api-server's source from sibling artifacts is brittle (the original 02-06 attempted this and the checker flagged it as oversized — 25 files in one task). Splitting the extraction into its own wave isolates the refactor and keeps each plan within ~50% context.

Output: lib/twin-runtime/ exists as a workspace package with 10 re-exported modules; api-server's existing import sites continue to resolve via thin re-export shims; TextGenerationPayload carries the Telegram fields needed by 02-06b.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-twin-runtime-core/02-CONTEXT.md
@.planning/phases/02-twin-runtime-core/02-RESEARCH.md
@.planning/phases/02-twin-runtime-core/02-PATTERNS.md
@.planning/phases/02-twin-runtime-core/02-02-SUMMARY.md
@.planning/phases/02-twin-runtime-core/02-05-SUMMARY.md
@artifacts/api-server/src/lib/moderation.ts
@artifacts/api-server/src/lib/conversation.ts
@artifacts/api-server/src/lib/hmac-conversation.ts
@artifacts/api-server/src/lib/system-prompt.ts
@artifacts/api-server/src/lib/constitution.ts
@artifacts/api-server/src/lib/disclosure.ts
@artifacts/api-server/src/lib/deflections.ts
@artifacts/api-server/src/lib/helplines.ts
@artifacts/api-server/src/lib/notify-founder.ts
@artifacts/api-server/src/lib/locale.ts
@lib/queue/src/types.ts
@lib/db/package.json
</context>

<interfaces>
<!-- The 10 files that move (all built in earlier waves) -->

From artifacts/api-server/src/lib/ (built in 02-02 + 02-05):
- moderation.ts — runL1Moderation, runL3Moderation, composeFlaggedReply, severityFromCategories
- conversation.ts — loadHistory, persistTurn
- hmac-conversation.ts — newWebConversationId, signConversationId, verifyConversationId, deriveTelegramConversationId, conversationCookieOptions
- system-prompt.ts — buildSystemPrompt(card, locale, constitution?), DEFAULT_SAFE_FALLBACK_PROMPT
- constitution.ts — readConstitution(creatorId) (NEW from 02-02 per D-02-13)
- disclosure.ts — getDisclosureFooter
- deflections.ts — getDeflection, DEFLECTIONS
- helplines.ts — getHelpline, HELPLINES
- notify-founder.ts — notifyFounder, notifyFounderAsync
- locale.ts — detectLocale, Locale type

From lib/queue/src/types.ts (current):
- TextGenerationPayload extends JobPayloadBase { type: "text-generation"; prompt: string }
- JobPayloadBase: { jobDbId, creatorId, fanId, consentGrantVersion }

From lib/db/package.json (workspace package shape — template for lib/twin-runtime/package.json)
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create @workspace/twin-runtime + move 10 lib files + thin re-exports in api-server + extend TextGenerationPayload</name>
  <files>lib/twin-runtime/package.json, lib/twin-runtime/tsconfig.json, lib/twin-runtime/src/index.ts, lib/twin-runtime/src/moderation.ts, lib/twin-runtime/src/conversation.ts, lib/twin-runtime/src/hmac-conversation.ts, lib/twin-runtime/src/system-prompt.ts, lib/twin-runtime/src/constitution.ts, lib/twin-runtime/src/disclosure.ts, lib/twin-runtime/src/deflections.ts, lib/twin-runtime/src/helplines.ts, lib/twin-runtime/src/notify-founder.ts, lib/twin-runtime/src/locale.ts, artifacts/api-server/src/lib/moderation.ts, artifacts/api-server/src/lib/conversation.ts, artifacts/api-server/src/lib/hmac-conversation.ts, artifacts/api-server/src/lib/system-prompt.ts, artifacts/api-server/src/lib/constitution.ts, artifacts/api-server/src/lib/disclosure.ts, artifacts/api-server/src/lib/deflections.ts, artifacts/api-server/src/lib/helplines.ts, artifacts/api-server/src/lib/notify-founder.ts, artifacts/api-server/src/lib/locale.ts, artifacts/api-server/package.json, lib/queue/src/types.ts, lib/queue/package.json, artifacts/worker/package.json, artifacts/fan-twin/package.json, pnpm-workspace.yaml</files>
  <read_first>
    - artifacts/api-server/src/lib/{moderation,conversation,hmac-conversation,system-prompt,constitution,disclosure,deflections,helplines,notify-founder,locale}.ts (all 10 files built in 02-02 + 02-05 — these MOVE)
    - lib/queue/src/types.ts (current TextGenerationPayload shape)
    - lib/db/package.json (workspace package shape template)
    - pnpm-workspace.yaml (packages glob — verify lib/* already covered)
  </read_first>
  <behavior>
    - After move: `import { runL1Moderation } from "@workspace/twin-runtime"` resolves from any artifact (api-server, worker, fan-twin)
    - artifacts/api-server/src/lib/moderation.ts is a single-line re-export: `export * from "@workspace/twin-runtime/moderation.js"` (or via barrel)
    - All existing api-server tests still pass — zero behavior regression
    - TextGenerationPayload at lib/queue/src/types.ts has the new fields and is type-safe at the worker call site
    - pnpm install resolves the new workspace package without errors
  </behavior>
  <action>
    Create new workspace package `lib/twin-runtime/`:
    - `package.json`: `{name: "@workspace/twin-runtime", version: "0.0.0", main: "./dist/index.js", types: "./dist/index.d.ts", scripts: {build: "tsc", typecheck: "tsc --noEmit"}, dependencies: {@workspace/db: "workspace:*", @workspace/providers: "workspace:*", drizzle-orm: "catalog:", zod: "catalog:", pino: "catalog:"}}`
    - `tsconfig.json`: extend root tsconfig.base.json (mirror lib/db/tsconfig.json)
    - `src/index.ts`: re-export everything from the 10 sub-modules (one `export * from "./X.js"` line per module)

    MOVE all 10 lib files from `artifacts/api-server/src/lib/` to `lib/twin-runtime/src/`:
    - moderation.ts, conversation.ts, hmac-conversation.ts, system-prompt.ts, constitution.ts, disclosure.ts, deflections.ts, helplines.ts, notify-founder.ts, locale.ts
    - Each file keeps its lazy-getDb pattern (PATTERNS S1) — lazy import shape unchanged
    - Update internal imports: relative `.js` extensions stay; cross-module imports adjust from `../lib/x.js` to `./x.js` (now siblings)
    - constitution.ts (NEW from 02-02 per D-02-13) uses `process.env.REPLIT_OBJECT_STORAGE_BUCKET` — move unchanged; same env var read by 02-08 helper

    Update `artifacts/api-server/src/lib/`: REPLACE each moved file with a thin re-export:
    ```ts
    // artifacts/api-server/src/lib/moderation.ts
    export * from "@workspace/twin-runtime";  // single barrel re-export
    ```
    For finer granularity, use per-module imports:
    ```ts
    export { runL1Moderation, runL3Moderation, composeFlaggedReply, severityFromCategories } from "@workspace/twin-runtime";
    ```
    Both work — discretion. Whichever keeps `artifacts/api-server/src/routes/twin.ts` import sites unchanged.

    Add `"@workspace/twin-runtime": "workspace:*"` to:
    - `artifacts/api-server/package.json` dependencies
    - `lib/queue/package.json` dependencies (queue type definitions reference Locale type — discretion: if Locale is only string-literal-type-used in payload, no dep needed)
    - `artifacts/worker/package.json` dependencies (for 02-06b Task 2)
    - `artifacts/fan-twin/package.json` dependencies (for 02-06b Task 1)

    Update `pnpm-workspace.yaml` if the `packages` array doesn't already glob `lib/*` (likely already does — verify).

    Extend `lib/queue/src/types.ts` TextGenerationPayload:
    ```ts
    export interface TextGenerationPayload extends JobPayloadBase {
      type: "text-generation";
      prompt: string;
      locale: "en" | "ja" | "zh-TW";       // NEW
      conversationId: string;                // NEW
      deliveryChannel: "web" | "telegram";  // NEW
      telegramChatId?: number;               // NEW — required when deliveryChannel="telegram"
      twinId?: string;                       // NEW — optional, resolved by worker
      handle?: string;                       // NEW — for disclosure footer
    }
    ```

    Run `pnpm install` (workspace recognizes new package). Run `pnpm --filter @workspace/twin-runtime run build` and `pnpm --filter @workspace/api-server exec tsc --noEmit` — both must pass. Then `pnpm --filter @workspace/api-server run test` — full suite must pass with zero regression.
  </action>
  <verify>
    <automated>pnpm install --frozen-lockfile=false && pnpm --filter @workspace/twin-runtime exec tsc --noEmit && pnpm --filter @workspace/api-server exec tsc --noEmit && pnpm --filter @workspace/api-server run test 2>&1 | tail -30 | grep -E "passed|fail" && test -f lib/twin-runtime/src/constitution.ts && test -f lib/twin-runtime/src/moderation.ts && grep -c "@workspace/twin-runtime" artifacts/worker/package.json | awk '{exit ($1>=1)?0:1}' && grep -c "@workspace/twin-runtime" artifacts/fan-twin/package.json | awk '{exit ($1>=1)?0:1}'</automated>
  </verify>
  <done>
    - lib/twin-runtime/ exists as a workspace package with 10 source files + barrel index.ts
    - 10 lib files moved; api-server has thin re-exports preserving import surface
    - TextGenerationPayload extended with 6 new fields (locale, conversationId, deliveryChannel, telegramChatId, twinId, handle)
    - api-server still typechecks and ALL existing tests pass (no regression)
    - lib/queue, artifacts/worker, artifacts/fan-twin all have @workspace/twin-runtime in deps
    - pnpm install resolves cleanly
  </done>
  <acceptance_criteria>
    - Per WARNING 7 split: this plan owns the extraction ONLY (no fan-twin scaffold, no worker fill — those are 02-06b)
    - Worker can `import { runL1Moderation } from "@workspace/twin-runtime"` without reaching into api-server's source
    - api-server existing source unchanged at import-site level (imports still resolve via thin re-export shims)
    - TextGenerationPayload fully types the Telegram-delivery contract for 02-06b consumers
    - constitution.ts (PERSONA-02 reader from D-02-13) is in the shared package so worker text-generation in 02-06b can call it
  </acceptance_criteria>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| moved file → consumer | refactor only; trust boundaries unchanged from original location |
| @workspace/twin-runtime → external consumers (api-server, worker, fan-twin) | trusted (same monorepo, same security posture) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-06a-01 | Tampering | broken re-export breaks api-server | mitigate | Full api-server test suite must pass before this plan marks done; CI gate |
| T-02-06a-02 | Info Disclosure | env var reads in moved files now span more processes | accept | All 10 files already read env vars in api-server; moving to a shared lib just enables more processes to read the same vars — no new attack surface |
| T-02-06a-SC | Tampering | npm installs | accept | No new package installs (only workspace deps added) |
</threat_model>

<verification>
- `pnpm --filter @workspace/twin-runtime exec tsc --noEmit` exits 0
- `pnpm --filter @workspace/api-server exec tsc --noEmit` exits 0 (regression check)
- `pnpm --filter @workspace/api-server run test` full suite still passes
- `test -d lib/twin-runtime/src` returns success
- `grep -c "@workspace/twin-runtime" artifacts/api-server/package.json` ≥ 1
- `grep -c "@workspace/twin-runtime" artifacts/worker/package.json` ≥ 1
- `grep -c "@workspace/twin-runtime" artifacts/fan-twin/package.json` ≥ 1
- `grep -c "deliveryChannel" lib/queue/src/types.ts` ≥ 1 (payload extended)
</verification>

<success_criteria>
- lib/twin-runtime/ exists as shared workspace lib
- api-server import surface preserved via re-export shims; zero test regression
- TextGenerationPayload carries Telegram fields needed by 02-06b
- All four downstream package.json files declare @workspace/twin-runtime
</success_criteria>

<output>
Create `.planning/phases/02-twin-runtime-core/02-06a-SUMMARY.md` with: package structure (file tree), api-server regression-test count (before/after = same number passing), list of imports updated in api-server re-export shims.
</output>
