---
phase: 02-twin-runtime-core
plan: 08
subsystem: hermes
tags: [phase-2, hermes, voice-sample, object-storage, revoke-voice, consent-revocation, onboard-01, onboard-03]

requires:
  - phase: 02-twin-runtime-core
    plan: 02
    provides: |
      twins.voiceReferenceUrl column (POPULATED by this plan);
      consent_grants table with modality=voice (CONSUMED by /revoke_voice)
  - phase: 02-twin-runtime-core
    plan: 07
    provides: |
      artifacts/hermes/src/lib/object-storage.ts — uploadVoiceReference helper
      (CONSUMED, not re-authored). Scene mounts onto the same Scenes.Stage
      consent.scene + persona.scene live on (02-07's session.ts wiring).
provides:
  - "/voice WizardScene — downloads creator's Telegram voice note, uploads to
    Replit Object Storage at creators/{id}/voice_reference.{ogg|wav}, writes
    URL onto twins.voice_reference_url. Closes voice-sample component of
    ONBOARD-01 per D-02-02."
  - "/revoke_voice command — marks consent_grants(voice).granted=false +
    revokedAt=now(), clears twins.voice_reference_url, enqueues a
    consent-revocation BullMQ job. Closes ONBOARD-03."
  - "Consent-revocation worker SLA logging — warns when sweep exceeds 60s
    (ONBOARD-03 contract). Logs modality so /revoke_voice sweeps are
    distinguishable from /kill_switch sweeps in the log stream."
  - "hermes db helpers: writeVoiceReferenceUrl, findActiveVoiceConsentGrant,
    markVoiceConsentRevoked, clearVoiceReferenceUrl"
  - "hermes revoke-voice.ts orchestration module (extracted for unit-testability)"
affects: []

tech-stack:
  added:
    - "@workspace/queue (workspace:*) — runtime dep on hermes for enqueueRevocation"
    - "bullmq ^5.56.1 — runtime dep on hermes for Queue.add"
  patterns:
    - "Voice scene graceful-degrade: catch error matching /REPLIT_OBJECT_STORAGE_BUCKET/
      from object-storage.ts and reply 'Voice upload not yet available' — keeps
      the scene non-fatal when the founder defers bucket creation (per plan
      <must_haves.truths>). uploadVoiceReference is the throw-path; the catch
      maps to the friendly reply."
    - "Revoke orchestration extracted: revoke-voice.ts is a pure async function
      taking creatorId and returning a discriminated result ({ok, reason?,
      consentGrantId?, queued?, dbWriteMs?, elapsedMs?}). The Telegraf command
      handler is a 10-line wrapper over it — testable via vi.mock without
      booting the bot. Mirrors the api-server/routes/consent.ts pattern but
      scoped to the single voice modality."
    - "BullMQ dedupe via jobId='rev:{creatorId}:{grantId}' — identical
      /revoke_voice invocations within BullMQ's retention window collapse into
      one job (same scheme as api-server/routes/consent.ts uses for PATCH
      /consent/:modality)."

key-files:
  created:
    - artifacts/hermes/src/scenes/voice.scene.ts
    - artifacts/hermes/src/revoke-voice.ts
    - artifacts/hermes/src/__tests__/voice-wizard.test.ts
    - artifacts/hermes/src/__tests__/revoke-voice.test.ts
    - .planning/phases/02-twin-runtime-core/02-08-SUMMARY.md
  modified:
    - artifacts/hermes/src/db.ts (writeVoiceReferenceUrl + findActiveVoiceConsentGrant
      + markVoiceConsentRevoked + clearVoiceReferenceUrl helpers added)
    - artifacts/hermes/src/index.ts (voiceWizard mounted on Scenes.Stage;
      /voice + /revoke_voice commands registered)
    - artifacts/hermes/package.json (+@workspace/queue, +bullmq)
    - artifacts/worker/src/workers/consent-revocation.ts (modality logged in
      both processing log lines; 60s SLA WARN added for matched-jobs and
      no-op early-return paths)
    - pnpm-lock.yaml

key-decisions:
  - "Founder checkpoint surfaced as deferred — Replit Object Storage bucket
    creation was NOT performed in this plan. The plan's <must_haves.truths>
    EXPLICITLY contemplates this branch ('Voice scene defers gracefully if
    Replit Object Storage bucket not yet set up — replies with \"Voice upload
    not yet available\"'), and the implementation matches. Per the plan's
    Task 0 resume-signal, this is the 'defer — voice intake skipped this
    plan (degraded /voice scene)' branch. The /revoke_voice flow + worker
    SLA polish are bucket-independent and ship fully. Founder must complete
    the Replit Object Storage bucket creation before /voice happy-path
    functionality reaches creators — see 'Awaiting Founder Action' below."
  - "Revoke orchestration extracted to its own module (revoke-voice.ts)
    instead of inlining in index.ts. Cleaner unit testing (no Telegraf mock
    needed), and the same module can be re-used by an admin tool or a future
    revocation REST endpoint without duplicating logic. The Telegraf command
    handler stays in index.ts as the thin wrapper."
  - "Worker enhancement is a deviation-via-Rule-2 — the existing worker
    (shipped pre-Phase-2) does not log modality and does not warn on the 60s
    SLA. The plan said 'Fill the stub' but the worker is already filled and
    correct. Reframed as 'enhance SLA observability' to honor the spirit of
    ONBOARD-03 (60s SLA is part of the requirement, not just the plan text)."
  - "Test fixture used a non-blocking mock (mockResolvedValueOnce({elapsed:
    2500})) for the >2s SLA case. Initially asserted elapsedMs >= 2500, which
    failed because real wallclock doesn't tick. Relaxed the assertion to
    'elapsedMs is a number' and kept the WARN-emission assertion as the real
    contract. The wallclock SLA verification belongs in an integration test
    with a real slow DB driver — not appropriate for a unit suite."

requirements-completed: [ONBOARD-01, ONBOARD-03]

duration: 11min
completed: 2026-05-28
---

# Phase 02 Plan 08: Voice Sample + Revoke Voice + Worker SLA Summary

**/voice WizardScene now downloads creator voice notes from Telegram and uploads to Replit Object Storage at `creators/{id}/voice_reference.{ext}` (graceful-degrade when bucket env unset). /revoke_voice retires the voice consent grant, clears `twins.voice_reference_url`, and enqueues the consent-revocation BullMQ job; the worker now logs modality and warns when the cancellation sweep exceeds the 60s ONBOARD-03 SLA. All 12 new tests GREEN; 27 hermes tests total passing.**

## Performance

- **Duration:** 11 minutes
- **Started:** 2026-05-28T05:28:03Z
- **Tasks:** 2 implementation + 1 founder checkpoint (deferred)
- **Files modified:** 9 (4 created, 5 modified)
- **Commits:** 4 (2 RED test commits + 2 implementation commits)

## Accomplishments

### Task 0 (founder checkpoint) — Replit Object Storage bucket
**DEFERRED.** Surfaced via the `## CHECKPOINT REACHED` section below. The plan's `<must_haves.truths>` explicitly designs the /voice scene to degrade gracefully when `REPLIT_OBJECT_STORAGE_BUCKET` (or `REPLIT_OBJECT_STORAGE_BASE_URL`) is unset — the scene catches the missing-bucket error and replies "Voice upload not yet available — your other onboarding is complete." Founder action is required before /voice happy-path functionality reaches creators, but Tasks 1 & 2 ship cleanly without it.

### Task 1 — /voice WizardScene + voice-reference writer
- **`artifacts/hermes/src/scenes/voice.scene.ts`:** Telegraf `Scenes.WizardScene<Scenes.WizardContext>` with two step handlers:
  - **Step 0 (enter):** validates `s.creatorId` is set; prompts "Send me a 6+ second voice note in your natural speaking voice. I'll use it as the reference clip for your AI twin's voice. Record directly in Telegram (microphone icon → hold to record)."
  - **Step 1 (capture):** reads `ctx.message.voice`; rejects non-voice messages with re-prompt (stay in scene); rejects `duration < MIN_VOICE_DURATION_SECONDS` (6) with retry prompt; downloads file via `ctx.telegram.getFileLink` + `fetch` + `arrayBuffer` (mirrors existing `downloadTelegramFile` pattern); calls `uploadVoiceReference(creatorId, buffer, { mimeType })` from `lib/object-storage.ts` (shipped in 02-07); calls `writeVoiceReferenceUrl(creatorId, url)`; on success replies "Voice sample stored. Use /done to finish onboarding…" and leaves.
  - **Graceful-degrade:** `isMissingBucketError(err)` detects the `/REPLIT_OBJECT_STORAGE_BUCKET/` error from `uploadVoiceReference` and replies "Voice upload not yet available — your other onboarding is complete. We'll set this up before launch." then leaves the scene.
  - **`MIN_VOICE_DURATION_SECONDS = 6`** exported for the unit suite.
- **`artifacts/hermes/src/db.ts` — `writeVoiceReferenceUrl(creatorId, url)`:** Drizzle update on `twinsTable` keyed by `creatorId`; returns `{updated: boolean}` so the scene can surface a "Please run /persona first" message when no twin row exists yet (defensive — the persona wizard normally creates the twin row before /voice is invoked).
- **`artifacts/hermes/src/index.ts`:** `voiceWizard` mounted on `Scenes.Stage` alongside `consentWizard` and `personaWizard` (02-07 wiring). `bot.command("voice", ...)` resolves the creator by Telegram user ID and enters `"voice-wizard"` with `{ creatorId }` state.
- **`artifacts/hermes/src/__tests__/voice-wizard.test.ts`:** 7 GREEN tests:
  - scene id = `"voice-wizard"`
  - `MIN_VOICE_DURATION_SECONDS === 6`
  - Step 0 prompt mentions "voice note" and the 6s threshold; advances wizard
  - Step 1 rejects 3s voice note (stays in scene; no upload attempted)
  - Step 1 rejects non-voice messages with re-prompt
  - Step 1 graceful-degrade path: `uploadVoiceReference` mockRejectedValueOnce → friendly reply + scene.leave
  - Step 1 happy path: upload called with `(creatorId, Buffer, {mimeType: 'audio/ogg'})`; `writeVoiceReferenceUrl` called with returned URL; success reply emitted; scene.leave
- **Typecheck:** `pnpm --filter @workspace/hermes exec tsc --noEmit` → exit 0
- **Commits:** `1c81a47` (RED test), `078f679` (GREEN scene + writer + wiring)

### Task 2 — /revoke_voice + consent-revocation worker 60s SLA
- **`artifacts/hermes/src/revoke-voice.ts`:** Pure orchestration module — exports `revokeVoice(creatorId): Promise<RevokeVoiceResult>`. Flow:
  1. `findActiveVoiceConsentGrant(creatorId)` — null → return `{ok: false, reason: 'no_active_grant'}`
  2. `markVoiceConsentRevoked(grantId)` — captures `elapsed`; warns if >2000ms (SLA mirror of `setPaused`)
  3. `clearVoiceReferenceUrl(creatorId)` — nulls `twins.voice_reference_url` so the L2/L3 voice-synth path stops finding a reference clip
  4. `enqueueRevocation(creatorId, grantId)` — dynamic `import('bullmq')` (matches api-server/routes/consent.ts pattern); BullMQ priority=1; `jobId='rev:{creatorId}:{grantId}'` for dedup; 5 attempts with exponential backoff. Returns `queued=false` if `REDIS_URL` unset OR `Queue.add` throws.
- **`artifacts/hermes/src/db.ts` — three new revocation helpers:**
  - `findActiveVoiceConsentGrant(creatorId)` — selects the `(modality='voice', granted=true, revokedAt IS NULL)` row
  - `markVoiceConsentRevoked(grantId)` — sets `granted=false, revokedAt=now()`; returns `{elapsed}` for SLA logging
  - `clearVoiceReferenceUrl(creatorId)` — sets `twins.voice_reference_url = NULL`
- **`artifacts/hermes/src/index.ts`:** `bot.command("revoke_voice", ...)` — thin wrapper that resolves the creator, calls `revokeVoice(creator.id)`, branches on:
  - `!ok && reason === 'no_active_grant'` → "Voice consent is not currently active — nothing to revoke."
  - `ok && queued` → "Voice consent revoked. In-flight voice generations are being cancelled now."
  - `ok && !queued` → "Voice consent revoked. DB grant updated. (Queue worker offline — manual sweep may be needed.)"
- **`artifacts/hermes/package.json`:** added `@workspace/queue` (workspace:*) and `bullmq ^5.56.1` as runtime deps. `bullmq` version matches the catalog version used by api-server and worker.
- **`artifacts/worker/src/workers/consent-revocation.ts`:** enhanced (NOT replaced — preserves the existing complete implementation):
  - `modality` extracted from job.data and included in both the "processing" and "cancelled=N" log lines, so /revoke_voice sweeps are distinguishable from /kill_switch sweeps in the log stream.
  - 60s SLA WARN added for the matched-jobs path: `if (sweepMs > 60000) console.error("[revocation] WARN sweep exceeded 60s SLA ...")`.
  - 60s SLA WARN added for the early-return (no matched jobs) path with its own `earlySweepMs` measurement, so a slow DB query in the empty-match case is still surfaced.
- **`artifacts/hermes/src/__tests__/revoke-voice.test.ts`:** 5 GREEN tests:
  - no-active-grant → `{ok: false, reason: 'no_active_grant'}` (no writes, no enqueue)
  - Happy path with Redis: db writes called; `Queue` constructed once; `add('revoke', payload, opts)` called with `payload.type='consent-revocation', modality='voice', killSwitch=false` and `opts.jobId` containing the grant id
  - `REDIS_URL` unset → `{ok: true, queued: false}` (DB writes still ran)
  - `Queue.add` throws → `{ok: true, queued: false}` (caught; orchestration continues)
  - `markVoiceConsentRevoked` returns `{elapsed: 2500}` (>2000ms threshold) → WARN line emitted via `console.error`
- **Typecheck:** `pnpm --filter @workspace/hermes exec tsc --noEmit` → exit 0; `pnpm --filter @workspace/worker exec tsc --noEmit` → exit 0 (after one-time `pnpm --filter @workspace/db|@workspace/queue exec tsc -p tsconfig.json` to refresh project-reference build artifacts)
- **Commits:** `b52cb6f` (RED test), `3f2e203` (GREEN orchestration + command + worker SLA)

## Deviations from Plan

### [Rule 3 — Auto-fix blocking issue] Worker stub was already filled — reframed as SLA enhancement
- **Found during:** Task 2 reading `artifacts/worker/src/workers/consent-revocation.ts`
- **Issue:** The plan text says "Fill the stub" with a code sample using `cancelledAt = new Date()` and an `inArray` predicate. The existing worker is already a complete implementation — it uses `completedAt + errorMessage` (because the `generation_jobs` schema has `completed_at` not `cancelled_at`; see `lib/db/src/schema/index.ts:323`), and it correctly handles both the kill-switch and single-grant paths via Drizzle. Writing the plan's literal code sample would have regressed working production logic and introduced a phantom `cancelledAt` column reference (would have failed at runtime against the live schema).
- **Fix:** Honored the spirit of the plan (ONBOARD-03 60s SLA + modality observability) instead of the letter: kept the existing implementation intact and ADDED the missing pieces — modality log fields in both processing log lines, plus 60s SLA WARN in both the matched-jobs path and the early-return (no matched jobs) path.
- **Files modified:** `artifacts/worker/src/workers/consent-revocation.ts`
- **Commit:** `3f2e203`

### [Style] Revoke orchestration extracted to dedicated module instead of inlined in index.ts
- **Found during:** Task 2 (before writing RED test)
- **Issue:** The plan's `<action>` block inlines the /revoke_voice handler body directly in `bot.command('revoke_voice', async (ctx) => { ... })`. This is testable only by mocking Telegraf — heavy harness and brittle.
- **Outcome:** Extracted into `artifacts/hermes/src/revoke-voice.ts` as a pure async function. The Telegraf command handler is now a 10-line wrapper. Unit tests target the orchestration module directly via vi.mock — no bot lifecycle needed. Same module can be re-used by an admin tool or REST endpoint later. Documented here so the founder is not surprised by the extra file (not in the plan's `<files>` field).

### [Style] Test fixture: relaxed elapsed-wallclock assertion to log-emission assertion
- **Found during:** Task 2 first GREEN run
- **Issue:** The "SLA WARN when db_write_ms >2s" test used `markVoiceConsentRevoked.mockResolvedValueOnce({ elapsed: 2500 })` to simulate a slow write, then asserted `result.elapsedMs >= 2500`. But `Date.now() - t0` in revoke-voice.ts measures real wallclock — and the mock returns synchronously, so wallclock is near-zero.
- **Fix:** Relaxed the wallclock assertion to `typeof result.elapsedMs === 'number'` and kept the real behavior contract (`console.error` call containing "WARN") as the meaningful assertion. The wallclock SLA verification belongs in an integration test with a real slow DB driver — not appropriate for the unit suite.
- **Commit:** `3f2e203`

## Known Stubs

- **Replit Object Storage bucket NOT created.** The /voice scene gracefully degrades — the founder smoke test cannot complete the voice happy-path until `REPLIT_OBJECT_STORAGE_BUCKET` is set. See `## CHECKPOINT REACHED` below.
- **No-twin-row branch is defensive but reachable** — `writeVoiceReferenceUrl` returns `{updated: false}` if the creator runs `/voice` before `/persona`. The scene surfaces "Voice sample uploaded, but you haven't completed /persona yet" — but the voice file IS still uploaded to Object Storage (orphaned until /persona runs). Acceptable at N=1 (creator is the founder); a future plan could either reject /voice when no twin exists OR delete the orphaned upload.
- **`writeAuditLog` in consent-revocation.ts remains a stub** — pre-existing from Phase 1. The `audit_log` table is not in the current schema (per the existing comment, deferred to a future Phase 2 plan or Phase 3). Not in scope for 02-08.

## Deferred Issues (out of scope for this plan)

- **Founder bucket creation + REPLIT_OBJECT_STORAGE_BUCKET secret** — see `## CHECKPOINT REACHED`.
- **api-server `tsc --noEmit` TS6305 / TS7006 errors** — pre-existing carry-overs from Phase 1; same set documented as "Deferred Issues" in 02-02 and 02-07 summaries. Not regressed by this plan.
- **Real-wallclock SLA integration test** — exists in plan thinking; would need either a real Postgres test container or a sleep-injecting db mock. Not built in this plan (unit test asserts the WARN-emission contract only).
- **Idempotency tightening on /revoke_voice** — currently re-invocations within the BullMQ retention window are deduped on the jobId, but the DB layer would emit two `revokedAt` updates if the founder spams the command (the second would simply be a no-op since `findActiveVoiceConsentGrant` filters by `revokedAt IS NULL` — actually, the second invocation goes down the no-active-grant branch, which is correct). Documented as accepted per plan T-02-08-04.

## Threat Flags

None. The new files introduce no fresh network endpoints (the only new HTTP is the existing Replit Object Storage PUT pattern shipped in 02-07, scoped to `creators/{creatorId}/`). No new auth surface (commands run inside Hermes's existing Telegram identity gate via `findCreatorByTelegramId`). No new schema changes (`twins.voice_reference_url`, `consent_grants.modality='voice'`, `generation_jobs.consent_grant_id` were all in place by 02-02).

Threat register dispositions (from plan):
- **T-02-08-01 (malicious file uploaded via Telegram voice):** mitigated — duration ≥6 enforced in scene; mime type defaults to `audio/ogg` (Telegram pre-validates); size implicit via Telegram (~50MB cap per file).
- **T-02-08-02 (voice reference URL leak):** mitigated — URL stored server-side only (twins.voice_reference_url is not surfaced on any public API in Phase 2). Phase 3 voice synthesis will sign the URL or stream-fetch server-side.
- **T-02-08-03 (creator denies giving voice consent):** mitigated — consent_grants row retains `version + consentVersion + ipHash + grantedAt`; revocation sets `revokedAt` and `granted=false` but NEVER deletes the row (immutable audit trail).
- **T-02-08-04 (revoke_voice replay / race with new voice consent):** accepted — re-invocation goes down the no-active-grant branch; race window is small (seconds) and N=1.
- **T-02-08-05 (unbounded uploads):** accepted — Telegram per-user rate limits; N=1 means founder can manually intervene.
- **T-02-08-06 (voice not deleted within 60s SLA):** mitigated — worker WARNs at >60s in both the matched-jobs and empty-match paths.
- **T-02-08-07 (voice_reference.wav overwrite race):** accepted — single key per creator; overwrite is the intent (creator records new sample).
- **T-02-08-SC (@replit/object-storage SDK install):** mitigated — no SDK installed in this plan; raw `fetch` to Replit Object Storage REST API is used (the implementation 02-07 shipped). bullmq + @workspace/queue added by this plan are workspace-canonical deps already in use across api-server and worker.

## TDD Gate Compliance

Both tasks were `tdd="true"`. RED → GREEN gate sequence honored end-to-end:

1. **Task 1 RED commit:** `1c81a47` — `test(02-08): add RED voice-wizard test for /voice scene`. Voice scene file did not exist; test failed at module-load time with `Failed to load url ../scenes/voice.scene.js`.
2. **Task 1 GREEN commit:** `078f679` — `feat(02-08): add /voice WizardScene + voice-reference writer (ONBOARD-01)`. All 7 voice-wizard tests pass.
3. **Task 2 RED commit:** `b52cb6f` — `test(02-08): add RED test for /revoke_voice orchestration`. revoke-voice.ts did not exist; test failed at module-load time.
4. **Task 2 GREEN commit:** `3f2e203` — `feat(02-08): add /revoke_voice + worker 60s SLA logging (ONBOARD-03)`. All 5 revoke-voice tests pass.

No REFACTOR commits — both implementations were clean on first GREEN run. The only post-GREEN edit was to the test fixture (relaxed wallclock assertion to log-emission assertion) and to the success-reply regex; both occurred BEFORE the GREEN commit, not after.

## Self-Check

Created files:
- ✓ `artifacts/hermes/src/scenes/voice.scene.ts`
- ✓ `artifacts/hermes/src/revoke-voice.ts`
- ✓ `artifacts/hermes/src/__tests__/voice-wizard.test.ts`
- ✓ `artifacts/hermes/src/__tests__/revoke-voice.test.ts`

Modified files:
- ✓ `artifacts/hermes/src/db.ts` (writeVoiceReferenceUrl + 3 revoke helpers added)
- ✓ `artifacts/hermes/src/index.ts` (voiceWizard mounted; /voice + /revoke_voice commands)
- ✓ `artifacts/hermes/package.json` (+@workspace/queue, +bullmq)
- ✓ `artifacts/worker/src/workers/consent-revocation.ts` (modality log + 60s SLA WARN)
- ✓ `pnpm-lock.yaml`

Commits present on `worktree-agent-a22071c2216f3cdc2`:
- ✓ `1c81a47` — test(02-08): add RED voice-wizard test for /voice scene
- ✓ `078f679` — feat(02-08): add /voice WizardScene + voice-reference writer (ONBOARD-01)
- ✓ `b52cb6f` — test(02-08): add RED test for /revoke_voice orchestration
- ✓ `3f2e203` — feat(02-08): add /revoke_voice + worker 60s SLA logging (ONBOARD-03)

Verification commands run:
- ✓ `pnpm --filter @workspace/hermes exec tsc --noEmit` → exit 0
- ✓ `pnpm --filter @workspace/worker exec tsc --noEmit` → exit 0
- ✓ `pnpm --filter @workspace/hermes run test` → 4 files / 27 tests pass (existing 15 + new 12)
- ✓ `grep -c "voice-wizard\|voiceWizard" artifacts/hermes/src/index.ts` ≥ 2 (got 4)
- ✓ `grep -c "uploadVoiceReference" artifacts/hermes/src/scenes/voice.scene.ts` ≥ 1 (got 3)
- ✓ `grep -c "revoke_voice" artifacts/hermes/src/index.ts` ≥ 1 (got 2)
- ✓ `grep -c "consentRevocation\|cancelled" artifacts/worker/src/workers/consent-revocation.ts` ≥ 2 (got 6)

Not run (out of scope for executor):
- ⚠ Founder smoke (Telegram, post-bucket-creation): /voice → send 8s voice note → "Voice sample stored" reply; `SELECT voice_reference_url FROM twins WHERE creator_id = '<id>'` returns non-null; file appears in bucket.
- ⚠ Founder smoke (Telegram): /revoke_voice → "Voice consent revoked …" reply; `SELECT granted, revoked_at FROM consent_grants WHERE creator_id='<id>' AND modality='voice'` returns granted=false, revoked_at IS NOT NULL; worker logs show `[revocation] cancelled=0` (no in-flight jobs) within seconds.

**Self-Check: PASSED**

## CHECKPOINT REACHED

**Type:** human-action (blocking-human)
**Plan:** 02-08 (Wave 3)
**Status:** plan implementation complete; bucket-dependent founder smoke deferred

### What is being asked

The plan's Task 0 is a `checkpoint:human-action gate="blocking-human"` for creating the Replit Object Storage bucket and setting the `REPLIT_OBJECT_STORAGE_BUCKET` secret. Per the auto-mode rules, human-action checkpoints are NOT auto-approvable. The plan's `<must_haves.truths>` AND the plan's Task 0 resume-signal explicitly contemplate a defer branch ("defer — voice intake skipped this plan (degraded /voice scene that replies 'voice upload not yet available')").

This plan was implemented on the **defer branch**: the /voice scene is built with graceful-degrade, and the rest of the plan (/revoke_voice + worker SLA) is fully shipped and bucket-independent. Founder bucket creation is the only remaining step before /voice reaches creators in the happy path.

### Steps for the founder

1. Open the Replit project dashboard → Tools (or Storage) → Object Storage.
2. Click "Create Bucket". Name it `lala-voice-samples` (or any name; record it). Set visibility to **Private**.
3. Open the Replit Secrets panel and add `REPLIT_OBJECT_STORAGE_BUCKET=<bucket-name>`. If Replit shows credential env vars (access key / secret key), add those too.
4. (Optional) For local dev, set `REPLIT_OBJECT_STORAGE_BASE_URL` to the full bucket URL — the implementation honors this override (see `artifacts/hermes/src/lib/object-storage.ts:25`).
5. Smoke test: from Telegram → /voice → send an 8-second voice note → expect "Voice sample stored. Use /done …" reply.
6. SQL verify: `psql $DATABASE_URL -c "SELECT voice_reference_url FROM twins WHERE creator_id = '<your-creator-uuid>';"` should return a `https://storage.replit.com/v1/buckets/<bucket>/objects/creators/<id>/voice_reference.ogg` URL.

### Resume signal

Reply "approved — bucket: `<name>`" once the secret is set in Replit. No code change required to re-enable the happy path (the scene reads the env at runtime, so a Hermes restart picks it up).
