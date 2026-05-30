---
phase: 03-voice-hardening
type: founder-contract
requirement: VOICE-01, VOICE-02, VOICE-03
status: api-contract-confirmed / clone-registration-shape-pending
confirmed_by: founder (wheresjoe@gmail.com)
confirmed_at: 2026-05-30
source: GMI Cloud console model catalog (live, pasted by founder)
---

# GMI TTS Contract — Phase 3 Voice Synthesis

This file clears CONSTRAINT `GMI_TTS_CONTRACT` from `.continue-here.md`. It records the
founder-confirmed model decision so 03-06 can be written without guessing the endpoint.

## Confirmed Model

**`minimax-audio-voice-clone-speech-2.6-hd`** — MiniMax, on GMI Cloud.

- **Pricing:** $0.10 / request (flat — not per-second; clip length is free)
- **Modality:** Audio-to-Audio + Text-to-Audio (this is what makes it a *clone*: it ingests
  the creator's reference clip and speaks in her voice — the whole point of the twin)
- **Languages:** 40+ with inline code-switching; strong Japanese & Traditional Chinese
  (MiniMax is a Chinese lab) — correct for JP/TW/HK 17LIVE creators
- **Fallback:** `minimax-audio-voice-clone-speech-2.6-turbo` ($0.06/req) — one env-var swap
  (`GMI_TTS_MODEL_ID`) if HD cost/latency bites at creator #10+

### Why HD over Turbo (at N=1)
- Voice quality is the entire differentiator of the voice feature; an off-sounding clone is
  worse than text-only.
- Cost delta ($0.10 vs $0.06) is trivial — replies are short, generation is occasional.
- Turbo's latency edge is wasted: voice generates async in the BullMQ worker, so it never
  blocks the fan's HTTP/Telegram text reply.

### Models explicitly REJECTED
- `elevenlabs-tts-v3`, `elevenlabs-tts-multilingual-v2` — ToS concern for creator
  monetization (CLAUDE.md mandate). Out regardless of availability.
- `minimax-tts-speech-*` (01/02/2.5/2.6 hd & turbo) — Text-to-Audio only = preset voices,
  **no cloning**. Cannot reproduce the creator's voice.
- Inworld `Realtime-tts-*` — Text-to-Audio only, no clone.
- `step-audio-edit-x` (the research doc's prior guess) — superseded; positioned for audio
  editing, not the cleanest clone fit. Do not use.

### Supersedes
03-RESEARCH.md assumed XTTS-v2 at `POST /v1/audio/tts` with model `step-audio-edit-x` and an
inline base64 reference. That was a placeholder guess. **It is wrong — ignore it.** Use the
MiniMax voice-clone contract above.

## CONFIRMED — API wire contract (founder-pasted from GMI docs, 2026-05-30)

> **Host differs from the LLM API.** Voice/TTS lives on `console.gmicloud.ai`, NOT
> `api.gmi-serving.com/v1` (that's chat/completions). Two different base URLs.

### It is an ASYNC job queue (submit → poll → fetch URL)
This supersedes the research doc's assumption of a synchronous base64-bytes response.

**1. Submit** — `POST https://console.gmicloud.ai/api/v1/ie/requestqueue/apikey/requests`
```
Authorization: Bearer ${GMI_API_KEY}
Content-Type: application/json
{
  "model": "minimax-tts-speech-2.6-hd",
  "payload": {
    "text": "...",                      // required
    "voice_id": "<claire_cloned_voice_id>",  // preset OR a cloned voice_id (see two-step below)
    "language_boost": "auto",           // auto-detects JA/ZH/EN — leave auto
    "format": "mp3",                    // or "flac"; mp3 fine for Telegram/web
    "speed": "1", "vol": "1", "pitch": "0",
    "emotion": "auto", "audio_sample_rate": "32000", "bitrate": "128000", "channel": "2"
  }
}
```
Returns `{ request_id, model, status: "queued", created_at, ... }`.

**2. Poll** — `GET https://console.gmicloud.ai/api/v1/ie/requestqueue/apikey/requests/{request_id}`
Poll until `status` ∈ {`success`, `failed`, `cancelled`}. Statuses: `queued | processing |
success | failed | cancelled`. (GMI docs mislabel descriptions as "Video generation" —
copy-paste artifact; it is audio.)

**3. Fetch result** — on `success`, audio URL is at `outcome.media_urls[0].url`
(a `https://storage.googleapis.com/...` URL — TTL/visibility unconfirmed, so do NOT hand it
straight to the fan; see VOICE-03 below).

### Pricing (corrected)
**$0.10 per 1,000 characters** — audio-length/char-based, NOT flat per request as the console
catalog row implied. Replies are short (≤512-token text), so ~fractions of a cent per clip.
HD remains the right default.

### Voice cloning is TWO-STEP (confirmed by preset voice_id in synth payload)
The synth doc above uses a preset `voice_id` (`"English_expressive_narrator"`). To make the
twin sound like Claire:
- **Step A — register (once, at onboarding):** submit Claire's reference clip to
  `minimax-audio-voice-clone-speech-2.6-hd` (the Audio-to-Audio model) → receive a stable
  custom `voice_id`. Persist it on the twin record (new column `twins.voice_id`).
- **Step B — synthesize (per reply):** call the submit endpoint with `payload.voice_id` =
  Claire's cloned id. No reference re-upload per call → faster + cheaper.

## OPEN — ONE item left: clone-registration request shape

Still need the exact request/response for **Step A** (reference clip → voice_id) on
`minimax-audio-voice-clone-speech-2.6-hd`. Likely the same `requestqueue/apikey/requests`
endpoint with a payload carrying the reference audio (URL or base64) and returning a
`voice_id` in `outcome.voice_id`. **Action for founder:** paste the voice-clone model's
sample request+response (from its docs page or the "Try" playground). Then this flips to
fully `confirmed` and 03-06 can write both steps.

> Interim: 03-06 can be built now against the SYNTH contract (Step B) using a preset
> `voice_id` for tests, with the clone call (Step A) stubbed behind the registry until the
> registration shape lands. The circuit breaker, polling loop, worker body, and VOICE-03
> proxy are all fully specified by what's above.

### Architecture implications for 03-06 / 03-07
- **Worker submits + polls** — fits BullMQ cleanly. opossum wraps the submit+poll unit;
  breaker trips → silent text-only fallback (SC1).
- **VOICE-03 delivery:** worker fetches bytes from the `storage.googleapis.com` URL, stores
  under `creators/{id}/generations/{jobId}.mp3` in Replit Object Storage, serves to fan via
  HMAC-token proxy `GET /api/voice/:jobId?token=...` (research §VOICE-03 — Replit has no
  presigned URLs). Do not expose the raw GCS URL.
- **`twins.voice_id` column** needed (Step A output) — add in the 03-06 schema task.

### Replit Secrets
- `GMI_API_KEY` — already set (shared with LLM); confirm it authorizes the TTS host too
- `GMI_TTS_BASE_URL=https://console.gmicloud.ai`
- `GMI_TTS_MODEL_ID=minimax-tts-speech-2.6-hd` (synth); clone model id is
  `minimax-audio-voice-clone-speech-2.6-hd`
- `VOICE_URL_SIGNING_SECRET` — `openssl rand -hex 32` (required by 03-07 proxy)
- `FOUNDER_TELEGRAM_USER_ID`, `REDIS_URL` — verify set
