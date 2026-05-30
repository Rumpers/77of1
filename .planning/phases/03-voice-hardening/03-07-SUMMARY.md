---
phase: "03"
plan: "07"
subsystem: voice
tags: [voice-proxy, hmac, openapi, codegen, fan-page, telegram-enqueue-wiring]
dependency_graph:
  requires: ["03-01", "03-06"]
  provides: ["voice-token-hmac", "voice-proxy-route", "voice-enqueue-wiring", "fan-voice-bubble"]
  affects:
    - artifacts/api-server/src/lib/voice-token.ts
    - artifacts/api-server/src/routes/voice.ts
    - artifacts/api-server/src/routes/twin.ts
    - artifacts/worker/src/workers/text-generation.ts
    - artifacts/web/src/components/fan/VoiceMessageBubble.tsx
    - lib/api-spec/openapi.yaml
    - lib/api-zod
    - lib/api-client-react
tech_stack:
  added: []
  patterns:
    - "HMAC voice URL: {jobId}.{exp} payload signed with VOICE_URL_SIGNING_SECRET (sha256, full 64-hex)"
    - "timingSafeEqual after length check (T-03-07-03)"
    - "UUID_RE validation before HMAC before DB (T-03-07-08 defense-in-depth)"
    - "Object Storage raw-fetch GET (mirrors hermes PUT pattern, no SDK needed)"
    - "VoiceMessageBubble 409 retry: 2s delay, MAX_RETRIES=5, then graceful degradation"
    - "voice_url additive to /api/twin/chat response — existing callers unaffected"
key_files:
  created:
    - artifacts/api-server/src/lib/voice-token.ts
    - artifacts/api-server/src/routes/voice.ts
    - artifacts/api-server/src/__tests__/voice-token.test.ts
    - artifacts/web/src/components/fan/VoiceMessageBubble.tsx
  modified:
    - lib/api-spec/openapi.yaml (added /voice/{jobId} path)
    - lib/api-zod/src/generated/api.ts (regenerated)
    - lib/api-zod/src/generated/types/ (regenerated, new type files)
    - lib/api-zod/src/index.ts (dropped types re-export — bug fix)
    - lib/api-client-react/src/generated/api.ts (regenerated)
    - lib/api-client-react/src/generated/api.schemas.ts (regenerated)
    - artifacts/api-server/src/routes/index.ts (registered voiceRouter)
    - artifacts/api-server/src/routes/twin.ts (voice enqueue wiring)
    - artifacts/worker/src/workers/text-generation.ts (voice enqueue wiring)
    - artifacts/web/src/pages/fan-page.tsx (VoiceMessageBubble render)
    - artifacts/web/src/lib/api.ts (voice_url field in TwinChatResponse)
decisions:
  - "Voice token file in src/lib/voice-token.ts; test in src/__tests__/ (matches vitest.config.ts glob src/__tests__/**/*.test.ts — lib/__tests__/ would be out of scope)"
  - "api-zod/src/index.ts drops types/ re-export to fix TS2308 ambiguity: orval generates same name in both api.ts (Zod) and types/ (TS type); no consumer imports from types/ barrel"
  - "Object Storage raw-fetch GET pattern (no SDK) — consistent with hermes upload pattern; @replit/object-storage was absent in 03-06 and remains absent"
  - "voice_url is undefined (not null) in response when voice is disabled — matches TypeScript optional field convention"
metrics:
  duration: 1070
  completed_date: "2026-05-30T06:15:39Z"
  tasks_completed: 4
  files_changed: 16
---

# Phase 03 Plan 07: Voice Proxy Route + End-to-End Wiring Summary

One-liner: HMAC-gated mp3 audio proxy (`/api/voice/:jobId`), OpenAPI codegen synced (audio/mpeg), shouldGenerateVoice/enqueueVoiceJob wired into web route and Telegram worker, VoiceMessageBubble fan-page component with 409-retry and transcript a11y fallback.

## What Was Built

### Task 1 — voice-token.ts HMAC sign/verify (TDD)

`artifacts/api-server/src/lib/voice-token.ts` (97 lines):
- `signVoiceUrl(jobId, ttlSeconds?)` → `/api/voice/{jobId}?exp={epoch}&token={64hexChars}`
- `verifyVoiceUrl(jobId, exp, token)` → boolean (timingSafeEqual, expiry check first)
- `VOICE_URL_SIGNING_SECRET` required (≥32 chars); `VOICE_URL_TTL_SECONDS` env override for ops/tests
- Default TTL: 86,400 seconds (24h)
- Throws on unset/short secret — callers get clear error at config time not runtime

9 Vitest tests in `artifacts/api-server/src/__tests__/voice-token.test.ts`:
round-trip, TTL variant, tampered token, mismatched jobId, unset secret, too-short secret, URL format.

### Task 2 — OpenAPI spec + codegen + mp3 proxy route

**openapi.yaml** addition: `/voice/{jobId}` GET with `audio/mpeg` response (not audio/ogg), token+exp query params, 403/404/409 error codes.

**Codegen** (`pnpm --filter @workspace/api-spec run codegen`): regenerated `lib/api-zod/` and `lib/api-client-react/` — both include `GetVoiceFileParams` and the voice endpoint client hook.

**`artifacts/api-server/src/routes/voice.ts`** (160 lines): HMAC-gated Object Storage proxy:
1. UUID_RE validates jobId BEFORE HMAC (T-03-07-08)
2. verifyVoiceUrl HMAC check → 403 on failure
3. DB lookup: `generation_jobs.result_url` + status check → 409 if not complete
4. Raw-fetch GET from Object Storage (same pattern as hermes PUT)
5. Stream ReadableStream → Express response with `Content-Type: audio/mpeg`, `Cache-Control: private, max-age=0`

Registered in `artifacts/api-server/src/routes/index.ts` before the linksRouter catch-all.

### Task 3 — Voice enqueue wiring into web route + Telegram worker

**`artifacts/api-server/src/routes/twin.ts`**:
- Replaced fire-and-forget stub with `shouldGenerateVoice` → `enqueueVoiceJob` → `signVoiceUrl`
- Twin SELECT extended to include `voiceReferenceUrl` + `handle`
- Response shape: `voice_url` (optional signed proxy URL, undefined when voice off)
- Errors swallowed (voice never breaks text delivery — SC1 pattern)

**`artifacts/worker/src/workers/text-generation.ts`**:
- Import `shouldGenerateVoice`, `enqueueVoiceJob` from `@workspace/twin-runtime/voice`
- Twin SELECT extended to include `voiceReferenceUrl`
- Voice job enqueued AFTER `persistTurn` (assistant) and BEFORE `sendMessage` outbound
- Only on non-flagged turns (L1/L3 flagged paths return early — voice never enqueued there)
- `deliveryChannel: "telegram"` → voice worker calls `bot.telegram.sendAudio` independently

### Task 4 — Fan-page VoiceMessageBubble

`artifacts/web/src/components/fan/VoiceMessageBubble.tsx`:
- `<audio controls preload="metadata">` with `<source src={voiceUrl} type="audio/mpeg">`
- `<details><summary>Transcript</summary><p>{transcript}</p></details>` a11y fallback
- SB 243 disclosure footer: `— {disclosure}` below the audio element
- 409 retry: `onError` triggers 2s timeout, re-mounts audio via `audioKey` increment; after 5 retries → "Voice unavailable — see transcript above"
- Tailwind v4 styling matching MessageBubble.tsx "ai" role (bg-[#2a2a2a], rounded-[16px_16px_16px_4px])

`artifacts/web/src/pages/fan-page.tsx`: conditional `<VoiceMessageBubble>` rendered below AI text bubble when `msg.voiceUrl` is set.

`artifacts/web/src/lib/api.ts`: `voice_url?: string` added to `TwinChatResponse` interface.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest.config.ts include glob covers src/__tests__/ only**
- **Found during:** Task 1 — plan specified `src/lib/__tests__/voice-token.test.ts`
- **Issue:** vitest.config.ts `include: ["src/__tests__/**/*.test.ts"]` does not pick up `src/lib/__tests__/`
- **Fix:** Placed test at `src/__tests__/voice-token.test.ts` matching existing test file convention
- **Commit:** 62aa57b

**2. [Rule 2 - Missing] api-zod index.ts re-exported types/ barrel causing TS2308 ambiguity**
- **Found during:** Task 2 — codegen run triggered TypeScript error
- **Issue:** Orval generates both a Zod schema const (in `api.ts`) AND a TypeScript type file (in `types/`) with identical export names. Re-exporting both from `index.ts` causes "Module already exported a member" TS2308. Pre-existing structural issue; triggered when new endpoint with query params (`GetVoiceFileParams`) was added.
- **Fix:** Removed `export * from "./generated/types"` from `lib/api-zod/src/index.ts`. No consumer imports from the types barrel (verified: only `credits.ts` and `payments.ts` import from `@workspace/api-zod`, both using Zod schemas not the types barrel).
- **Commit:** 44b6891

**3. [Rule 1 - Bug] Express 5 req.params and req.query types are string | string[] | ParsedQs**
- **Found during:** Task 2 typecheck — `req.params.jobId` and `req.query.token` assignable issues
- **Fix:** Used `req.params["jobId"]` with array check, and `typeof rawToken === "string"` guard for query params (narrower than cast, safer for non-string values)
- **Commit:** 44b6891

### Pre-existing Issues (Out of Scope — Logged to Deferred)

- `artifacts/web/src/pages/fan-dsar.tsx`: 26 TypeScript errors (missing i18n keys). Pre-existed before 03-07, not caused by our changes. Zero 03-07 files affected.
- `artifacts/web/src/pages/dashboard-security.tsx`: `setQrDataUrl` undefined (1 error). Pre-existed.
- These errors cause `pnpm run typecheck` at workspace level to exit non-zero for the web artifact, but all 03-07 source files typecheck cleanly. Api-server, worker, twin-runtime, and lib typechecks all pass.

## Deployment Gates

**[REQUIRED] VOICE_URL_SIGNING_SECRET must be provisioned in Replit Secrets before proxy goes live:**
```
openssl rand -hex 32
```
Without this env var, `signVoiceUrl` and `verifyVoiceUrl` throw at runtime. The proxy route returns 403 (verifyVoiceUrl catches the missing-secret error and returns false).

**[OPTIONAL] VOICE_URL_TTL_SECONDS** — override 24h default. Leave unset in production.

## Known Stubs

None introduced in 03-07. The `registerVoiceClone()` stub from 03-06 (in gmi-tts-client.ts) remains; voice synthesis works with preset `GMI_TTS_FALLBACK_VOICE_ID` until clone Step A shape is confirmed.

## Threat Surface Scan

No new surface beyond plan's threat model:
- `/api/voice/:jobId` is the only new public endpoint — documented in T-03-07-01 through T-03-07-10 and all mitigations implemented.
- `voice_url` added to twin chat response is a server-minted signed URL — no new input surface.

## Self-Check: PASSED

Files verified:
- `artifacts/api-server/src/lib/voice-token.ts` — FOUND
- `artifacts/api-server/src/routes/voice.ts` — FOUND
- `artifacts/api-server/src/__tests__/voice-token.test.ts` — FOUND
- `artifacts/web/src/components/fan/VoiceMessageBubble.tsx` — FOUND

Commits verified:
- 62aa57b (Task 1 voice-token.ts + tests)
- 44b6891 (Task 2 OpenAPI + codegen + voice proxy route)
- 6e74146 (Task 3 enqueue wiring)
- 306d8b9 (Task 4 VoiceMessageBubble)
