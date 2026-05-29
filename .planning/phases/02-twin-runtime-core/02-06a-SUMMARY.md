---
phase: 02-twin-runtime-core
plan: 06a
subsystem: shared-lib-extraction
tags: [phase-2, twin-runtime, shared-lib, refactor, payload-extension]
requirements:
  completed: [CHAT-02, CHAT-06]
  note: "Pure refactor + payload type extension. CHAT-02/CHAT-06 are scaffolded here; consumed in 02-06b (fan-twin scaffold + worker text-generation fill)."
dependency-graph:
  requires:
    - "artifacts/api-server/src/lib/{moderation,conversation,hmac-conversation,system-prompt,constitution,disclosure,deflections,helplines,notify-founder,locale}.ts (built in 02-02 + 02-05 — these MOVE)"
    - "artifacts/api-server/src/lib/{safety-audit,logger}.ts (Rule 3 deviation — moved too)"
    - "artifacts/api-server/src/providers/interfaces.ts (ModerationResult / IModeratorProvider / ProviderError / ProviderTransientError now imported from twin-runtime)"
    - "lib/queue/src/types.ts (TextGenerationPayload extended)"
    - "lib/db (@workspace/db — twin-runtime depends on it for conversation + safety-audit)"
  provides:
    - "@workspace/twin-runtime — new workspace package, 13 source files"
    - "13 named subpath exports + barrel: . / conversation / constitution / deflections / disclosure / helplines / hmac-conversation / locale / logger / moderation / notify-founder / provider-types / safety-audit / system-prompt"
    - "setModeratorProviderFactory — dependency-injection seam for the provider-agnostic moderation pipeline"
    - "Extended TextGenerationPayload with 6 Telegram-delivery contract fields"
  affects:
    - "artifacts/api-server/src/lib/{moderation,conversation,hmac-conversation,system-prompt,constitution,disclosure,deflections,helplines,notify-founder,locale,safety-audit,logger}.ts — now 1-2 line re-export shims pointing at twin-runtime subpaths"
    - "artifacts/api-server/src/providers/interfaces.ts — re-exports moderation/provider symbols from twin-runtime so `instanceof ProviderError` keeps working across the package boundary"
    - "artifacts/worker — gains @workspace/twin-runtime workspace dep (consumed in 02-06b)"
    - "artifacts/fan-twin — gains @workspace/twin-runtime + @workspace/queue workspace deps (consumed in 02-06b)"
tech-stack:
  added: []  # no new npm installs — only new workspace packages
  patterns:
    - "PATTERNS S1 (lazy Drizzle import) preserved in moved files"
    - "PATTERNS A8 (env-driven singleton provider selection) preserved via injection seam"
    - "PATTERNS S4 (.js extensions on relative imports) preserved"
    - "Subpath exports (lib/twin-runtime/package.json `exports` map) — keeps per-module load semantics so unit tests that don't mock @workspace/db continue to load"
    - "Dependency-injection via setModeratorProviderFactory — twin-runtime is provider-agnostic; the OpenAI / mock providers stay in api-server"
key-files:
  created:
    - "lib/twin-runtime/package.json (workspace manifest + 14-entry exports map)"
    - "lib/twin-runtime/tsconfig.json (extends root tsconfig.base.json)"
    - "lib/twin-runtime/src/index.ts (barrel — re-exports all 13 sub-modules)"
    - "lib/twin-runtime/src/moderation.ts (189→201 lines: added setModeratorProviderFactory + getRegisteredModeratorProvider)"
    - "lib/twin-runtime/src/conversation.ts (68 lines — unchanged from 02-03)"
    - "lib/twin-runtime/src/hmac-conversation.ts (97 lines — unchanged from 02-02)"
    - "lib/twin-runtime/src/system-prompt.ts (81 lines — unchanged from 02-02)"
    - "lib/twin-runtime/src/constitution.ts (91 lines — unchanged from 02-02)"
    - "lib/twin-runtime/src/disclosure.ts (22 lines — unchanged from 02-02)"
    - "lib/twin-runtime/src/deflections.ts (69 lines — unchanged from 02-05)"
    - "lib/twin-runtime/src/helplines.ts (41 lines — unchanged from 02-05)"
    - "lib/twin-runtime/src/notify-founder.ts (54 lines — unchanged from 02-05)"
    - "lib/twin-runtime/src/locale.ts (75 lines — unchanged from 02-02)"
    - "lib/twin-runtime/src/safety-audit.ts (97 lines — Rule 3 add)"
    - "lib/twin-runtime/src/logger.ts (25 lines — Rule 3 add)"
    - "lib/twin-runtime/src/provider-types.ts (52 lines — Rule 3 add)"
  modified:
    - "artifacts/api-server/src/lib/moderation.ts (189 → 30 lines: shim + factory registration)"
    - "artifacts/api-server/src/lib/{conversation,hmac-conversation,system-prompt,constitution,disclosure,deflections,helplines,notify-founder,locale,safety-audit,logger}.ts (each → 2-line re-export shim)"
    - "artifacts/api-server/src/providers/interfaces.ts (ModerationResult / IModeratorProvider / ProviderError / ProviderTransientError → re-exported from @workspace/twin-runtime/provider-types)"
    - "artifacts/api-server/package.json (+ @workspace/twin-runtime: workspace:*)"
    - "artifacts/worker/package.json (+ @workspace/twin-runtime: workspace:*)"
    - "artifacts/fan-twin/package.json (+ @workspace/twin-runtime + @workspace/queue)"
    - "lib/queue/src/types.ts (TextGenerationPayload + 6 fields: locale, conversationId, deliveryChannel, telegramChatId, twinId, handle)"
    - "pnpm-lock.yaml (resolves new workspace package)"
decisions:
  - "Per-subpath exports (not just barrel `.`) — twin-runtime publishes 14 named entry points so api-server's existing per-file import sites can swap to `@workspace/twin-runtime/<name>` without pulling the whole barrel (which would transitively load safety-audit → @workspace/db at module load and break unit tests that don't mock the DB)"
  - "Dependency-injection seam (`setModeratorProviderFactory`) for the OpenAI provider — twin-runtime is provider-agnostic. The api-server shim at `lib/moderation.ts` registers `getModeratorProvider` at module load via a tolerant lookup that throws inside the factory body, letting twin-runtime's FAIL-OPEN catch preserve the pre-refactor test behaviour bit-for-bit"
  - "Single source of truth for ProviderError / ProviderTransientError / ModerationResult / IModeratorProvider — moved into `lib/twin-runtime/src/provider-types.ts` and re-exported by api-server's `providers/interfaces.ts`. Class identity matters because `routes/twin.ts` does `instanceof ProviderError` and the worker (02-06b) will too"
  - "Rule 3 (blocking) deviation: also moved safety-audit.ts + logger.ts into twin-runtime. moderation.ts imports `writeSafetyAuditLog` + `CrisisLevel`; constitution.ts and moderation.ts both import `logger`. These are leaf deps — splitting them across the package boundary would require either dependency-injection seams (over-engineered for static helpers) or duplication. Moving them is the simplest correct path"
  - "pnpm-workspace.yaml was NOT modified — the existing `packages: lib/*` glob auto-discovers the new lib/twin-runtime/ directory"
  - "lib/queue/package.json was NOT given a @workspace/twin-runtime dep — the extended TextGenerationPayload uses string-literal types (`'en' | 'ja' | 'zh-TW'`) inline rather than importing Locale, so no dep is needed (plan-allowed discretion)"
metrics:
  duration: "~35min wall clock (file moves + shim rewrites + factory injection seam + 2 round-trips on test failures + summary)"
  completed: "2026-05-28T14:25:00Z"
  commits: 1
  tasks: "1/1"
  files_created: 17  # 13 source + index.ts + provider-types + package.json + tsconfig.json
  files_modified: 17 # 11 api-server shims + 1 interfaces re-export + 4 package.jsons + 1 queue/types
  new_workspace_packages: 1
  payload_fields_added: 6
  api_server_test_suite_baseline: "13/14 files pass, 116 tests pass, 3 skipped — IDENTICAL to 02-05 baseline (1 pre-existing kyc-gate.e2e DATABASE_URL failure, deferred-items.md)"
---

# Phase 02 Plan 06a: Extract @workspace/twin-runtime shared lib Summary

## One-liner

Lifted the 10 twin-pipeline lib files out of `artifacts/api-server/src/lib/` into a new `@workspace/twin-runtime` workspace package with 14 subpath exports, plus 2 Rule 3 (blocking) additions for `safety-audit.ts` + `logger.ts`, a dependency-injection seam (`setModeratorProviderFactory`) so the moderation pipeline stays provider-agnostic, and a 6-field extension to `TextGenerationPayload` for the upcoming fan-twin → worker Telegram delivery contract.

## Package structure (file tree)

```
lib/twin-runtime/
├── package.json              # 14-entry exports map (. + 13 subpaths)
├── tsconfig.json             # extends root tsconfig.base.json
└── src/
    ├── index.ts              # barrel — re-exports all 13 sub-modules
    ├── conversation.ts       # loadHistory + persistTurn (lazy @workspace/db)
    ├── constitution.ts       # readConstitution (Replit Object Storage GET)
    ├── deflections.ts        # L4 safe-deflection strings per locale × category
    ├── disclosure.ts         # getDisclosureFooter (SB 243 AI disclosure)
    ├── helplines.ts          # COMPLY-02 crisis helpline strings (D-02-05 JP)
    ├── hmac-conversation.ts  # CHAT-03 HMAC sign/verify + cookie options
    ├── locale.ts             # I18N-02 inline locale detection
    ├── logger.ts             # Rule 3: pino structured logger (was leaf dep)
    ├── moderation.ts         # L1+L3+L4+L5+L6 pipeline + new factory seam
    ├── notify-founder.ts     # L5 fire-and-forget Telegram POST
    ├── provider-types.ts     # Rule 3: ModerationResult + IModeratorProvider + Provider{,Transient}Error
    ├── safety-audit.ts       # Rule 3: L6 hashed audit-log writer (was leaf dep)
    └── system-prompt.ts      # buildSystemPrompt (Character Card V2 + constitution)
```

## What shipped

### New workspace package (1)

| File | Lines | Role |
|---|---|---|
| `lib/twin-runtime/package.json` | 28 | Workspace manifest with 14-entry exports map |
| `lib/twin-runtime/tsconfig.json` | 10 | Extends root tsconfig.base.json |
| `lib/twin-runtime/src/index.ts` | 47 | Barrel — re-exports all 13 sub-modules |

### Lib files moved (13)

| File | Source plan | Treatment | Notes |
|---|---|---|---|
| `moderation.ts` | 02-05 | MOVED + extended | Added `setModeratorProviderFactory` (DI seam) + `getRegisteredModeratorProvider` helper. Behaviour unchanged for callers. |
| `conversation.ts` | 02-03 | MOVED verbatim | Lazy @workspace/db pattern preserved |
| `hmac-conversation.ts` | 02-02 | MOVED verbatim | |
| `system-prompt.ts` | 02-02 | MOVED verbatim | Imports CharacterCardV2 type from @workspace/db |
| `constitution.ts` | 02-02 | MOVED verbatim | Imports logger from sibling — local path updated to ./logger.js |
| `disclosure.ts` | 02-02 | MOVED verbatim | Imports Locale from sibling — local path updated to ./locale.js |
| `deflections.ts` | 02-05 | MOVED verbatim | |
| `helplines.ts` | 02-05 | MOVED verbatim | D-02-05 JP number preserved (0120-279-338) |
| `notify-founder.ts` | 02-05 | MOVED verbatim | |
| `locale.ts` | 02-02 | MOVED verbatim | |
| `safety-audit.ts` | Phase 1 | MOVED (Rule 3) | Required by moderation.ts; no api-server-specific deps |
| `logger.ts` | Phase 1 | MOVED (Rule 3) | Required by constitution.ts + moderation.ts; pino + pino-pretty |
| `provider-types.ts` | NEW (Rule 3) | Created | Owns the canonical ModerationResult / IModeratorProvider / ProviderError / ProviderTransientError. Class identity matters for `instanceof` checks crossing the package boundary. |

### api-server re-export shims (11 modified)

Each file becomes a 1-2 line re-export targeting a specific twin-runtime subpath. Existing import sites in `routes/twin.ts`, `middlewares/*`, and the test suite are **unchanged** at the call surface.

| Shim file | Re-exports from |
|---|---|
| `lib/conversation.ts` | `@workspace/twin-runtime/conversation` |
| `lib/hmac-conversation.ts` | `@workspace/twin-runtime/hmac-conversation` |
| `lib/system-prompt.ts` | `@workspace/twin-runtime/system-prompt` |
| `lib/constitution.ts` | `@workspace/twin-runtime/constitution` |
| `lib/disclosure.ts` | `@workspace/twin-runtime/disclosure` |
| `lib/deflections.ts` | `@workspace/twin-runtime/deflections` |
| `lib/helplines.ts` | `@workspace/twin-runtime/helplines` |
| `lib/notify-founder.ts` | `@workspace/twin-runtime/notify-founder` |
| `lib/locale.ts` | `@workspace/twin-runtime/locale` |
| `lib/safety-audit.ts` | `@workspace/twin-runtime/safety-audit` |
| `lib/logger.ts` | `@workspace/twin-runtime/logger` |
| `lib/moderation.ts` | `@workspace/twin-runtime/moderation` **PLUS** registers `getModeratorProvider` factory via `setModeratorProviderFactory()` |

### Provider interface re-export (1 modified)

| File | Change |
|---|---|
| `providers/interfaces.ts` | Removed inline class definitions for `ModerationResult` / `IModeratorProvider` / `ProviderError` / `ProviderTransientError`. Now re-exports them from `@workspace/twin-runtime/provider-types`. **Single source of truth** — `instanceof ProviderError` in `routes/twin.ts` (api-server) and 02-06b worker stays valid because both packages share the same class identity. |

### Manifest updates (4 package.jsons)

| Package | Change |
|---|---|
| `artifacts/api-server/package.json` | + `@workspace/twin-runtime: workspace:*` |
| `artifacts/worker/package.json` | + `@workspace/twin-runtime: workspace:*` (for 02-06b Task 2) |
| `artifacts/fan-twin/package.json` | + `@workspace/twin-runtime: workspace:*` + `@workspace/queue: workspace:*` (for 02-06b Task 1) |
| `lib/queue/package.json` | **UNCHANGED** — extended TextGenerationPayload uses string-literal types inline; no twin-runtime dep needed |

### Payload extension (lib/queue/src/types.ts)

```typescript
export interface TextGenerationPayload extends JobPayloadBase {
  type: "text-generation";
  prompt: string;
  // ─── Phase 2 Telegram-delivery contract (added in 02-06a) ────────────────
  locale: "en" | "ja" | "zh-TW";
  conversationId: string;
  deliveryChannel: "web" | "telegram";
  telegramChatId?: number; // required when deliveryChannel="telegram"
  twinId?: string;         // optional — worker can resolve via creatorId
  handle?: string;         // required for the disclosure footer
}
```

6 new fields, all required at the type level except `telegramChatId` / `twinId` / `handle` which are optional because the (reserved-for-future) web delivery path doesn't need them.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Also moved safety-audit.ts and logger.ts into twin-runtime**

- **Found during:** Task 1, when twin-runtime's `moderation.ts` failed to typecheck because it imports `writeSafetyAuditLog` + `CrisisLevel` from `./safety-audit.js` and `logger` from `./logger.js` — both of which the plan left in api-server.
- **Issue:** Splitting these symbols across the package boundary would require either dependency-injection seams (over-engineered for static helpers that have no provider variability) or duplication (two source-of-truth violations).
- **Fix:** Moved both files into `lib/twin-runtime/src/` and added 2-line re-export shims at `artifacts/api-server/src/lib/{safety-audit,logger}.ts`. Both files had no api-server-specific deps (safety-audit uses `@workspace/db` and `crypto`; logger uses `pino` + `pino-pretty`).
- **Files modified:** `lib/twin-runtime/src/{safety-audit,logger}.ts` (created); `artifacts/api-server/src/lib/{safety-audit,logger}.ts` (now shims).
- **Commit:** `c0edcf5`

**2. [Rule 3 — Blocking] Created provider-types.ts module + re-exported from api-server's providers/interfaces.ts**

- **Found during:** Task 1, when twin-runtime's `moderation.ts` failed to typecheck because it imports `ModerationResult`, `ProviderError`, `ProviderTransientError`, `IModeratorProvider` from `../providers/interfaces.js` — an api-server-specific path that can't be reached from a sibling workspace package.
- **Issue:** Duplicating these classes in twin-runtime would break the `instanceof ProviderError` check in `artifacts/api-server/src/routes/twin.ts` (line 219, 227) because each package would have its own class identity. The worker (02-06b) would have a third copy. `instanceof` requires a single class definition.
- **Fix:** Created `lib/twin-runtime/src/provider-types.ts` as the **single source of truth** for these 4 symbols. api-server's `providers/interfaces.ts` now re-exports them from `@workspace/twin-runtime/provider-types`. `instanceof` works across all 3 packages because they all reference the same class object.
- **Files modified:** `lib/twin-runtime/src/provider-types.ts` (created); `artifacts/api-server/src/providers/interfaces.ts` (re-exports instead of redeclares).
- **Commit:** `c0edcf5`

**3. [Rule 3 — Blocking] Used per-subpath exports instead of single barrel `.`**

- **Found during:** Task 1 first test run — 4 unit test files (`disclosure-footer.test.ts`, `locale-detection.test.ts`, `openai-moderator-provider.test.ts`, `system-prompt-constitution.test.ts`) failed to load with `Error: DATABASE_URL must be set` because the api-server shims initially did `export * from "@workspace/twin-runtime"` (the barrel), which pulls in `safety-audit.ts` → `@workspace/db` at top-level. These tests don't mock `@workspace/db` because they don't touch it directly — they only import string helpers like `getDisclosureFooter` or `detectLocale`.
- **Fix:** Added a 14-entry `exports` map to `lib/twin-runtime/package.json` exposing each sub-module under its own subpath (e.g. `@workspace/twin-runtime/disclosure`). Updated every api-server shim to re-export from the **specific** subpath rather than the barrel, preserving the per-file load semantics of the pre-refactor code.
- **Files modified:** `lib/twin-runtime/package.json` (14-entry exports map); all 12 api-server shims.
- **Commit:** `c0edcf5`

**4. [Rule 3 — Blocking] Tolerant factory lookup for getModeratorProvider**

- **Found during:** Task 1 second test run — `twin-chat.e2e.test.ts` failed with `No "getModeratorProvider" export is defined on the "../providers/registry.js" mock`. The test does `vi.mock("../providers/registry.js", () => ({ getTextProvider: ... }))` which fully replaces the module — only `getTextProvider` is exposed; `getModeratorProvider` becomes undefined.
- **Why the original code worked:** Pre-02-06a, `lib/moderation.ts` did `import { getModeratorProvider } from "../providers/registry.js"`. With the vi.mock above, `getModeratorProvider` was undefined → calling `getModeratorProvider()` threw `TypeError: getModeratorProvider is not a function` → moderation.ts's FAIL-OPEN catch block returned `{flagged: false}` → tests proceeded with mock-OK behaviour.
- **My initial fix broke this:** `setModeratorProviderFactory(getModeratorProvider)` at module load failed Vitest's mock resolution check with a clearer error.
- **Final fix:** Refactored the shim to do `import * as registry from "../providers/registry.js"` then register a factory that does `if (typeof registry.getModeratorProvider !== "function") throw ...`. The throw fires inside the factory body, which is invoked from `runModeration()` inside its try block — twin-runtime's FAIL-OPEN catch fires exactly as before. Pre-refactor test behaviour preserved bit-for-bit.
- **Files modified:** `artifacts/api-server/src/lib/moderation.ts`.
- **Commit:** `c0edcf5`

### Out-of-scope discoveries (Scope Boundary — logged, not fixed)

Pre-existing test failure already tracked in `.planning/phases/02-twin-runtime-core/deferred-items.md`:

- `kyc-gate.e2e.test.ts` — requires `DATABASE_URL`; fails in test env without provisioned PG (not a unit test). **Identical baseline to 02-05.**

Pre-existing typecheck failures in unrelated `artifacts/web` files also remain (posthog-js, dashboard-security setQrDataUrl, fan-dsar Messages.dsar). Out of scope for this refactor.

## Verification

| Gate | Result |
|---|---|
| `pnpm install` | PASS — workspace resolves new `@workspace/twin-runtime` package; no new npm packages added |
| `pnpm --filter @workspace/twin-runtime exec tsc --noEmit` | PASS — zero diagnostics |
| `pnpm --filter @workspace/api-server exec tsc --noEmit` | PASS — zero diagnostics (after building composite refs) |
| `pnpm --filter @workspace/worker exec tsc --noEmit` | PASS — zero diagnostics |
| `pnpm --filter @workspace/fan-twin exec tsc --noEmit` | PASS — zero diagnostics |
| `pnpm --filter @workspace/hermes exec tsc --noEmit` | PASS — zero diagnostics (sanity — hermes does not depend on twin-runtime) |
| `pnpm --filter @workspace/api-server run test` | 13/14 files PASS, 116 tests pass, 3 skipped — **IDENTICAL** to 02-05 baseline. Only failure is the pre-existing `kyc-gate.e2e.test.ts` DATABASE_URL gate. |
| `test -d lib/twin-runtime/src` | PASS |
| `grep -c "@workspace/twin-runtime" artifacts/api-server/package.json` | PASS — 1 |
| `grep -c "@workspace/twin-runtime" artifacts/worker/package.json` | PASS — 1 |
| `grep -c "@workspace/twin-runtime" artifacts/fan-twin/package.json` | PASS — 1 |
| `grep -c "deliveryChannel" lib/queue/src/types.ts` | PASS — 2 (interface field + comment) |
| `grep -c "0120-279-338" lib/twin-runtime/src/helplines.ts` | PASS — 2 (D-02-05 JP helpline preserved) |

## api-server regression-test count (before / after)

| Metric | Before (02-05 baseline) | After (02-06a) | Delta |
|---|---|---|---|
| Test files passed | 13 | 13 | 0 |
| Test files failed | 1 (kyc-gate.e2e DATABASE_URL — deferred) | 1 (same — deferred) | 0 |
| Tests passed | 116 | 116 | 0 |
| Tests skipped | 3 | 3 | 0 |

**Zero regression.** Every assertion that was green before is green after.

## Imports updated in api-server re-export shims

12 shims modified — each one is now 1-2 substantive lines:

```ts
// Example: artifacts/api-server/src/lib/disclosure.ts (was 22 lines, now 2):
// Re-export shim — moved to @workspace/twin-runtime in plan 02-06a.
export * from "@workspace/twin-runtime/disclosure";
```

The moderation shim is slightly larger (29 lines) because it also registers the provider factory:

```ts
// artifacts/api-server/src/lib/moderation.ts:
import type { IModeratorProvider } from "@workspace/twin-runtime/provider-types";
import { setModeratorProviderFactory } from "@workspace/twin-runtime/moderation";
import * as registry from "../providers/registry.js";

setModeratorProviderFactory((): IModeratorProvider => {
  const getter = (registry as { getModeratorProvider?: () => IModeratorProvider }).getModeratorProvider;
  if (typeof getter !== "function") {
    throw new Error("getModeratorProvider is not available on ../providers/registry.js — test mock or registry stub is missing the export.");
  }
  return getter();
});

export * from "@workspace/twin-runtime/moderation";
```

Plus `providers/interfaces.ts` now re-exports the moderation types instead of redeclaring them. No call sites changed.

## Authentication Gates

None encountered. The plan is a pure refactor + type extension — no new env vars, no new outbound calls.

## Known Stubs

None introduced. This plan strictly preserves the existing pipeline behaviour; no placeholder data was added.

## Threat Flags

No new threat surface — the threat model in 02-06a-PLAN.md `<threat_model>` covers:

| Threat | Mitigation applied |
|---|---|
| T-02-06a-01 (broken re-export breaks api-server) | Full api-server test suite executed — 13/14 files pass, IDENTICAL to 02-05 baseline. Zero regression. |
| T-02-06a-02 (env var reads now span more processes) | Accepted in plan — env vars are read at runtime by whichever process loads the shared lib; no new attack surface |
| T-02-06a-SC (npm install supply chain) | No new npm packages — only workspace deps added |

## Commits

1. `c0edcf5` — `feat(02-06a): extract @workspace/twin-runtime shared lib + extend TextGenerationPayload`

## Self-Check

- [x] `lib/twin-runtime/package.json` → FOUND (14-entry exports map)
- [x] `lib/twin-runtime/tsconfig.json` → FOUND
- [x] `lib/twin-runtime/src/index.ts` → FOUND (barrel re-exporting 13 sub-modules)
- [x] `lib/twin-runtime/src/moderation.ts` → FOUND
- [x] `lib/twin-runtime/src/conversation.ts` → FOUND
- [x] `lib/twin-runtime/src/hmac-conversation.ts` → FOUND
- [x] `lib/twin-runtime/src/system-prompt.ts` → FOUND
- [x] `lib/twin-runtime/src/constitution.ts` → FOUND
- [x] `lib/twin-runtime/src/disclosure.ts` → FOUND
- [x] `lib/twin-runtime/src/deflections.ts` → FOUND
- [x] `lib/twin-runtime/src/helplines.ts` → FOUND
- [x] `lib/twin-runtime/src/notify-founder.ts` → FOUND
- [x] `lib/twin-runtime/src/locale.ts` → FOUND
- [x] `lib/twin-runtime/src/safety-audit.ts` → FOUND (Rule 3 add)
- [x] `lib/twin-runtime/src/logger.ts` → FOUND (Rule 3 add)
- [x] `lib/twin-runtime/src/provider-types.ts` → FOUND (Rule 3 add)
- [x] All 12 api-server shims → FOUND (2-line re-exports + 1 with factory injection)
- [x] `artifacts/api-server/src/providers/interfaces.ts` → re-exports moderation types from `@workspace/twin-runtime/provider-types`
- [x] `lib/queue/src/types.ts` contains `deliveryChannel` → FOUND
- [x] `artifacts/api-server/package.json` contains `@workspace/twin-runtime` → FOUND
- [x] `artifacts/worker/package.json` contains `@workspace/twin-runtime` → FOUND
- [x] `artifacts/fan-twin/package.json` contains `@workspace/twin-runtime` → FOUND
- [x] commit `c0edcf5` → FOUND in git log

## Self-Check: PASSED
