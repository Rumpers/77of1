---
phase: "03"
plan: "06"
subsystem: voice
tags: [voice, gmi-tts, opossum, circuit-breaker, worker, async-queue, consent, sb243]
dependency_graph:
  requires: ["03-01", "03-02"]
  provides: ["gmi-tts-client", "voice-generation-worker", "twin-runtime/voice"]
  affects: ["artifacts/worker", "lib/providers", "lib/twin-runtime", "lib/db"]
tech_stack:
  added:
    - opossum@9.0.0 (circuit breaker — in providers, worker, api-server)
    - "@types/opossum@8.1.9"
    - "@workspace/providers in api-server dependencies"
    - "@workspace/queue in twin-runtime dependencies"
  patterns:
    - "Async submit→poll→fetch: POST /requestqueue/apikey/requests → GET ./{id} → fetch outcome.media_urls[0].url"
    - "Circuit breaker: opossum with 50% errorThreshold, 60s reset, null fallback = text-only"
    - "Object Storage: raw fetch PUT to Replit Object Storage (hermes pattern)"
    - "Mid-flight consent recheck (Pitfall 7) immediately before storage write"
    - "SB 243 defense-in-depth: safety_audit_log check before any GMI call"
key_files:
  created:
    - lib/providers/src/providers/gmi-tts-client.ts
    - lib/db/src/migrations/014_twins_voice_id.sql
    - lib/twin-runtime/src/voice.ts
    - artifacts/worker/.env.example
    - artifacts/api-server/.env.example
  modified:
    - lib/db/src/schema/index.ts (added twins.voiceId column)
    - lib/providers/src/providers/index.ts (exported gmiTtsBreaker, registerVoiceClone)
    - artifacts/api-server/src/providers/gmi/GmiVoiceProvider.ts (replaced stub)
    - artifacts/worker/src/workers/voice-generation.ts (full pipeline implementation)
    - lib/twin-runtime/src/index.ts (re-exported shouldGenerateVoice, enqueueVoiceJob)
    - lib/twin-runtime/package.json (added @workspace/queue, bullmq deps, ./voice export)
    - artifacts/api-server/package.json (added @workspace/providers dep)
    - artifacts/worker/package.json (added opossum + @types/opossum)
    - lib/providers/package.json (added opossum + @types/opossum)
decisions:
  - "opossum circuit breaker wraps ENTIRE submit+poll+fetch unit (not just submit)"
  - "Object Storage upload uses raw fetch (hermes pattern) because @replit/object-storage SDK was absent from worker (03-01 precondition not met)"
  - "Tasks 3a/3b/3c committed together — partial worker implementation would not typecheck"
  - "registerVoiceClone() is a throwing stub — clone Step A request shape is unconfirmed in 03-01"
  - "mp3 delivered via sendAudio (not sendVoice) — Telegram voice notes require OGG/Opus"
  - "SB 243 60s safety_audit_log window chosen to bound the look-back without expensive full scans"
metrics:
  duration: 871
  completed_date: "2026-05-30T05:52:49Z"
  tasks_completed: 5
  files_changed: 14
---

# Phase 03 Plan 06: GMI TTS Async Client + Voice Worker Summary

One-liner: GMI TTS async submit→poll→fetch client with opossum circuit breaker, voice-generation worker with SB 243 + consent guards, twins.voice_id column, and twin-runtime enqueue helpers.

## What Was Built

### Task 1 — Env Contract (.env.example)
Both `artifacts/worker/.env.example` and `artifacts/api-server/.env.example` created from scratch (neither existed). GMI TTS env vars wired:
- `GMI_TTS_BASE_URL=https://console.gmicloud.ai` (distinct from LLM host `api.gmi-serving.com`)
- `GMI_TTS_MODEL_ID=minimax-tts-speech-2.6-hd`
- `GMI_TTS_FALLBACK_VOICE_ID=English_expressive_narrator`
- `GMI_TTS_POLL_INTERVAL_MS` (default 1500ms), `GMI_TTS_TIMEOUT_MS` (default 30000ms)

### Task 2 — Schema + opossum + GMI TTS client
- `twins.voice_id TEXT` column added to Drizzle schema + migration `014_twins_voice_id.sql`
- opossum@9 installed in providers, worker, api-server (all with @types/opossum)
- `lib/providers/src/providers/gmi-tts-client.ts` implements confirmed async contract:
  - **Submit:** `POST ${GMI_TTS_BASE_URL}/api/v1/ie/requestqueue/apikey/requests`
  - **Poll:** `GET .../requests/{request_id}` every 1500ms until `status=success|failed|cancelled`
  - **Fetch:** `fetch(outcome.media_urls[0].url)` → Buffer of mp3 bytes
  - CircuitBreaker: `errorThresholdPercentage: 50`, `resetTimeout: 60_000`, fallback `() => null`
  - `registerVoiceClone()` is a throwing STUB (TODO 03-01 OPEN ITEM — clone Step A shape unconfirmed)

### Tasks 3a/3b/3c — Voice-Generation Worker (full pipeline)
Full 12-step pipeline in `artifacts/worker/src/workers/voice-generation.ts`:
1. Mark processing
2. Cancellation check (consent-revocation interlock)
3. **SB 243 self-harm short-circuit** — queries `safety_audit_log` for (creatorId, fanIdHash) within past 60s; aborts voice if `crisis_type=self-harm` OR `categoryScores['self-harm'] > 0.5`
4. Load creator + twin; resolve `voice_id` (`twins.voiceId ?? GMI_TTS_FALLBACK_VOICE_ID`)
5. **Pre-call consent check** — `creator_kyc.voice_synthesis_consent_granted` AND active `consent_grants(voice)` row
6. `gmiTtsBreaker.fire()` — full submit→poll→fetch; null = circuit open → mark `failed: circuit-open`
7. **Mid-flight consent recheck (Pitfall 7)** — immediately before storage write; discard audio if revoked
8. Object Storage upload — `creators/{creatorId}/generations/{jobDbId}.mp3`
9. Set `result_url` to storage key (NOT the raw GCS URL — HMAC proxy in 03-07)
10. Telegram delivery — `bot.telegram.sendAudio` (mp3; not sendVoice which requires OGG/Opus); COMPLY-01 caption
11. Mark `status="complete"` (terminal enum value)
12. Failure handler (mirrors text-generation.ts pattern)

### Task 4 — twin-runtime/voice.ts
`lib/twin-runtime/src/voice.ts` with two exported helpers:
- `shouldGenerateVoice(creatorId, twin)`: checks reference URL, kill_switch_active, voice_synthesis_consent_granted, active consent grant. Returns false on any DB error (never crash text path).
- `enqueueVoiceJob(args)`: creates `generation_jobs` row (status=queued, jobType=voice) + adds BullMQ job to voiceGeneration queue.
- Subpath export `./voice` added to twin-runtime package.json exports.
- Wiring into api-server route and text-generation worker deferred to 03-07.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @replit/object-storage SDK absent from worker**
- **Found during:** Task 3b
- **Issue:** Plan stated "@replit/object-storage is already installed by 03-01 Task 2" but SDK was not present in worker's package.json or node_modules
- **Fix:** Used the raw-fetch PUT pattern from `artifacts/hermes/src/lib/object-storage.ts` which is confirmed working in production (same REPLIT_OBJECT_STORAGE_BUCKET env var, same PUT endpoint). Documented in code comments.
- **Files modified:** `artifacts/worker/src/workers/voice-generation.ts`
- **Commit:** 8383501

**2. [Rule 3 - Blocking] Tasks 3a/3b/3c consolidated into one commit**
- **Found during:** Task 3a execution
- **Issue:** Plan split the worker implementation across 3 tasks with a constraint that `gmiTtsBreaker.fire` returns 0 matches after Task 3a. A partial worker implementation without the full pipeline would fail TypeScript compilation (imports would be unused, types incomplete).
- **Fix:** Implemented the full pipeline in one pass, with all three HANDOFF markers present in the file (lines 11, 16, 282, 344). All acceptance criteria verified post-implementation.
- **Commit:** 8383501

**3. [Rule 3 - Blocking] @workspace/providers added to api-server deps**
- **Found during:** Task 3a (GmiVoiceProvider typecheck)
- **Issue:** GmiVoiceProvider.ts imports from @workspace/providers but api-server had no such dependency declared
- **Fix:** Added `"@workspace/providers": "workspace:*"` to api-server/package.json
- **Commit:** 8383501

**4. [Rule 2 - Missing] db declarations rebuilt for workers referencing twins.voiceId**
- **Found during:** Task 3a typecheck
- **Issue:** Worker TypeScript project uses `references: [lib/db]` and Drizzle's composite project emits .d.ts; old .d.ts had no voiceId column
- **Fix:** Ran `tsc -p tsconfig.json` in lib/db to rebuild declarations before worker typecheck
- **Impact:** No code change; build order documented

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| `registerVoiceClone()` throws `Error("clone-registration request shape is the one open item in 03-01-GMI-TTS-CONTRACT.md")` | `lib/providers/src/providers/gmi-tts-client.ts` | ~278 | Clone Step A request/response shape is the only unconfirmed item in the GMI contract. Do NOT invent. Synthesis path works with preset `GMI_TTS_FALLBACK_VOICE_ID`. Resolve when founder pastes Step A docs. |

## Deployment Gates

**[BLOCKING] Schema push required before worker start:**
```
pnpm --filter @workspace/db run push
```
Adds `twins.voice_id TEXT` column. Worker queries this column at job execution time; missing column causes runtime crash. The post-merge hook (`scripts/post-merge.sh`) should handle this automatically, but verify before deploying the voice worker.

## Threat Surface

All T-03-06-01 through T-03-06-11 mitigations are implemented:
- T-03-06-02: Pre-call + mid-flight consent rechecks present (lines 272, 308)
- T-03-06-04: GCS URL fetched server-side only; worker stores Object Storage key not GCS URL
- T-03-06-06: Bounded poll loop + opossum breaker at 50% over 60s
- T-03-06-07: SB 243 short-circuit at step 3 (line ~195)
- T-03-06-08: Storage key constructed as `creators/${creatorId}/generations/${jobDbId}.mp3`
- T-03-06-09: Logs reference `jobDbId` and `audioBytes.length` only; no transcript logging
- T-03-06-11: `registerVoiceClone` throws — clone shape not invented

## Self-Check: PASSED

Files verified:
- `lib/providers/src/providers/gmi-tts-client.ts` — FOUND
- `lib/db/src/migrations/014_twins_voice_id.sql` — FOUND
- `artifacts/worker/src/workers/voice-generation.ts` — FOUND
- `lib/twin-runtime/src/voice.ts` — FOUND
- `artifacts/worker/.env.example` — FOUND
- `artifacts/api-server/.env.example` — FOUND

Commits verified:
- 02b4727 (Task 1 env vars)
- fbb5dab (Task 2 schema + opossum + gmi-tts-client)
- 8383501 (Tasks 3a/3b/3c worker + GmiVoiceProvider)
- 0eeaa8c (Task 4 twin-runtime/voice.ts)

All typechecks: providers, api-server, worker, twin-runtime — PASS
