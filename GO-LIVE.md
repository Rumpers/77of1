# GO-LIVE.md — Getting Claire (creator #1) live

Single source of truth for taking the built infrastructure to a live creator.
Consolidates: `04-04-SUMMARY.md`, `03-08-SUMMARY.md`, `03-01-GMI-TTS-CONTRACT.md`,
`scripts/check-bots.sh`, `scripts/preflight-golive.sh`.

Status as of 2026-05-30: **all code built, verified, and pushed to `origin/rio-de-janeiro`.**
What remains below is founder/Claire execution — not engineering.

---

## 0. What's already done (no action needed)

- Phase 4 eval gate — 30 cases, deterministic hard-limit/injection grading, go-live gate,
  weekly regression cron. Verified `passed` (38 tests green).
- Phase 3 voice — GMI async TTS client + circuit breaker, worker, HMAC `audio/mpeg` proxy,
  both chat paths enqueue voice, `VoiceMessageBubble`. (Voice falls back to text on failure.)
- Phases 1–2 — Supabase removed, KYC gate, text twin on web + Telegram, 6-layer moderation,
  SB 243 disclosure.

---

## 1. Deploy on Replit

```bash
git pull                                   # origin/rio-de-janeiro
pnpm install --frozen-lockfile
pnpm --filter @workspace/db run push       # applies migrations 013 (eval_runs) + 014 (twins.voice_id)
# restart the Replit services (api-server 8080, worker, hermes, fan-twin)
```

### Required Replit Secrets
Core (should already be set): `DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`,
`HMAC_CONVERSATION_SECRET`, `GMI_API_KEY`, `OPENAI_API_KEY`,
`TELEGRAM_BOT_TOKEN_LALA`, `TELEGRAM_BOT_TOKEN_FAN_TWIN`.

New this milestone:
| Secret | Value / how to get it |
|---|---|
| `ADMIN_API_TOKEN` | `openssl rand -hex 32` — bearer for the activate endpoint |
| `EVAL_CREATOR_ID` | Claire's `creators.id` UUID (after she's onboarded — step 3) |
| `VOICE_URL_SIGNING_SECRET` | `openssl rand -hex 32` — signs voice proxy URLs |
| `GMI_TTS_BASE_URL` | `https://console.gmicloud.ai` |
| `GMI_TTS_MODEL_ID` | `minimax-tts-speech-2.6-hd` |
| `GMI_TTS_FALLBACK_VOICE_ID` | a preset MiniMax voice (e.g. a JA/ZH preset) until Claire's clone is registered |
| `FOUNDER_TELEGRAM_USER_ID` | your Telegram user id (for `/dsar`, `/review_masks`) |

### Verify the deploy
```bash
bash scripts/preflight-golive.sh           # GO / NO-GO: secrets, DB schema, bots
APP_URL=https://<your>.replit.app bash scripts/check-bots.sh   # bot identity + webhook health
```
Green preflight = infra ready. (A valid bot token ≠ process running — check the webhook
`url` + `pending`/`last_error` lines.)

---

## 2. Onboard Claire (the real bottleneck)

Requires **Claire's writing/text samples** (Character Card V2 persona) and a
**voice clip 10s–5min, MP3/M4A/WAV, <20MB** (NOT the old 6s assumption).

Do this via **Hermes, not SQL** (dogfood the real UX):
`/start` → consent → persona wizard → voice wizard. This run is also the Phase 2
human-verify smoke (UI, Telegram self-harm flow, `/pause` SLA) and needs the
**SignWell KYC signature** with voice-synthesis authorization before fans message the twin.

After onboarding, grab her `creators.id` → set `EVAL_CREATOR_ID` secret → restart.

---

## 3. Run the eval gate → activate

```bash
pnpm --filter @workspace/eval run eval     # runs 30 cases vs Claire's twin, writes eval_runs
```
- Must hit **100% on hard-limit AND prompt-injection** → `goLiveEligible: true`.
- If injection cases fail, harden Claire's character card `post_history_instructions` and re-run.

Then flip her live (only succeeds when an eligible eval_run exists):
```bash
curl -X POST "https://<your>.replit.app/api/admin/twin/<EVAL_CREATOR_ID>/activate" \
  -H "Authorization: Bearer $ADMIN_API_TOKEN"
# 200 = twins.status set 'active'; 422 eval_gate_failed = not eligible; 401 = bad token
```

Confirm live: send a fan message to the fan-twin bot on Telegram, and open
`lala.la/<handle>` — twin should reply with the SB 243 disclosure + a soft CTA to her
monetization platform.

---

## 4. Drive + attribute one conversion

Real fans + the CTA link to Claire's monetization platform (Fanvue/Patreon/17LIVE/etc.).
Attribution is via the CTA/link click → her platform. This validates the 25–30% rev-share
and is the final goal criterion.

---

## Known open items / caveats

- **Voice clone not wired yet.** The twin currently speaks in `GMI_TTS_FALLBACK_VOICE_ID`
  (a generic voice), not Claire's. To use her actual cloned voice, GMI's wrapper for the
  two-step clone (upload→`file_id`, then `voice_clone`→`voice_id`) must be confirmed from the
  GMI console "Try" panel — semantics are documented in `03-01-GMI-TTS-CONTRACT.md`.
  `registerVoiceClone()` is a throwing stub until then. Voice is non-blocking (text always works).
- **Telegram voice delivery is `sendAudio` (mp3 file)**, not a native voice note — OGG/Opus
  voice notes need an `ffmpeg` transcode step (deferred; dependency add).
- **Phase 3 SC1–SC5 live verification** is pending this deploy (runbook in `03-08-SUMMARY.md`).
- **Pre-existing CI debt** (not a deploy blocker): `artifacts/web/src/pages/fan-dsar.tsx` is
  orphaned (unrouted) and fails `pnpm run typecheck` — Vite build succeeds regardless.
- **Untracked working-tree files** appeared mid-build (`supabase.ts`, `tax.ts`,
  `.supabase-legacy/*`, `paymentIntentResult.ts`) — intentionally NOT committed (Supabase was
  removed in Phase 1; Stripe/tax are dormant per CLAUDE.md). Delete or ignore at your discretion.
