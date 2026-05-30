// GMI TTS async request-queue client (03-06 / VOICE-01, VOICE-02)
//
// Implements the CONFIRMED GMI TTS wire contract from 03-01-GMI-TTS-CONTRACT.md:
//   1. Submit — POST /api/v1/ie/requestqueue/apikey/requests
//   2. Poll   — GET  /api/v1/ie/requestqueue/apikey/requests/{request_id}
//   3. Fetch  — fetch outcome.media_urls[0].url → return mp3 Buffer
//
// The WHOLE submit+poll+fetch unit is wrapped in an opossum CircuitBreaker.
// .fallback(() => null) — callers receive null on trip → text-only fallback.
//
// HOST: GMI_TTS_BASE_URL env (default: https://console.gmicloud.ai)
// This is DISTINCT from the LLM chat host. Two different base URLs.

import CircuitBreaker from "opossum";
import crypto from "crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GmiTtsInput {
  text: string;
  voiceId: string;       // twins.voice_id when set, else GMI_TTS_FALLBACK_VOICE_ID
  language: "en" | "ja" | "zh-TW";
  creatorId: string;     // for Helicone hashing / observability
}

export interface GmiTtsOutput {
  mediaUrl: string;      // outcome.media_urls[0].url — a storage.googleapis.com URL
  audioBytes: Buffer;    // fetched server-side from mediaUrl (mp3 bytes)
  mimeType: "audio/mpeg";
}

// GMI async queue submit response
interface GmiSubmitResponse {
  request_id: string;
  status: string;
  model?: string;
  created_at?: string;
}

// GMI async queue poll response
interface GmiPollResponse {
  request_id: string;
  status: "queued" | "processing" | "success" | "failed" | "cancelled";
  outcome?: {
    media_urls?: Array<{ url: string }>;
    voice_id?: string;
  };
  error?: string;
}

// ─── Config ────────────────────────────────────────────────────────────────────

function getTtsBaseUrl(): string {
  const url = process.env["GMI_TTS_BASE_URL"];
  if (!url) throw new Error("GMI_TTS_BASE_URL is required for voice synthesis");
  return url.replace(/\/$/, "");
}

function getApiKey(): string {
  const key = process.env["GMI_API_KEY"];
  if (!key) throw new Error("GMI_API_KEY is required for voice synthesis");
  return key;
}

function getTtsModelId(): string {
  return process.env["GMI_TTS_MODEL_ID"] ?? "minimax-tts-speech-2.6-hd";
}

function getPollIntervalMs(): number {
  return Number(process.env["GMI_TTS_POLL_INTERVAL_MS"] ?? 1500);
}

function getTimeoutMs(): number {
  return Number(process.env["GMI_TTS_TIMEOUT_MS"] ?? 30_000);
}

// Hash creator id before sending to Helicone (same pattern as gmi-client.ts)
function hashId(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 16);
}

// ─── Core async submit→poll→fetch function ────────────────────────────────────

async function callGmiTts(input: GmiTtsInput): Promise<GmiTtsOutput> {
  const baseUrl = getTtsBaseUrl();
  const apiKey = getApiKey();
  const modelId = getTtsModelId();
  const pollIntervalMs = getPollIntervalMs();
  const timeoutMs = getTimeoutMs();

  const authHeaders: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  // Optional Helicone routing — mirrors gmi-client.ts pattern.
  // TTS goes to console.gmicloud.ai; Helicone proxy routes via target header.
  const heliconeApiKey = process.env["HELICONE_API_KEY"];
  const HELICONE_PROXY_BASE = "https://custom.helicone.ai";
  const useHelicone = !!heliconeApiKey;

  const submitUrl = useHelicone
    ? `${HELICONE_PROXY_BASE}/api/v1/ie/requestqueue/apikey/requests`
    : `${baseUrl}/api/v1/ie/requestqueue/apikey/requests`;

  if (useHelicone) {
    authHeaders["Helicone-Auth"] = `Bearer ${heliconeApiKey}`;
    authHeaders["Helicone-Target-URL"] = baseUrl;
    authHeaders["Helicone-Property-Creator-Id"] = input.creatorId;
    authHeaders["Helicone-Property-Job-Type"] = "tts";
    // Fan id is not available at TTS call time — creator id is sufficient here.
    authHeaders["Helicone-Property-Creator-Id-Hash"] = hashId(input.creatorId);
  }

  // ── Step 1: Submit ─────────────────────────────────────────────────────────
  // POST /api/v1/ie/requestqueue/apikey/requests
  const submitBody = {
    model: modelId,
    payload: {
      text: input.text,
      voice_id: input.voiceId,
      language_boost: "auto",  // auto-detects JA/ZH/EN
      format: "mp3",
      speed: "1",
      vol: "1",
      pitch: "0",
      emotion: "auto",
      audio_sample_rate: "32000",
      bitrate: "128000",
      channel: "2",
    },
  };

  const submitRes = await fetch(submitUrl, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify(submitBody),
  });

  if (!submitRes.ok) {
    const errBody = await submitRes.text().catch(() => "(unreadable)");
    throw new Error(
      `GMI TTS submit failed: ${submitRes.status} ${submitRes.statusText} — ${errBody}`
    );
  }

  const submitted = (await submitRes.json()) as GmiSubmitResponse;
  const requestId = submitted.request_id;
  if (!requestId) {
    throw new Error("GMI TTS submit: no request_id in response");
  }

  // ── Step 2: Poll until success / failed / cancelled (bounded) ─────────────
  // GET /api/v1/ie/requestqueue/apikey/requests/{request_id}
  const deadline = Date.now() + timeoutMs;

  const pollUrlBase = useHelicone
    ? `${HELICONE_PROXY_BASE}/api/v1/ie/requestqueue/apikey/requests/${requestId}`
    : `${baseUrl}/api/v1/ie/requestqueue/apikey/requests/${requestId}`;

  // Remove Content-Type for GET requests
  const { "Content-Type": _ct, ...pollHeaders } = authHeaders;

  let pollResult: GmiPollResponse | null = null;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));

    const pollRes = await fetch(pollUrlBase, {
      method: "GET",
      headers: pollHeaders,
    });

    if (!pollRes.ok) {
      // Transient poll error — keep trying within timeout window
      console.warn(
        `[gmi-tts] poll ${requestId}: HTTP ${pollRes.status} — retrying`
      );
      continue;
    }

    pollResult = (await pollRes.json()) as GmiPollResponse;

    if (pollResult.status === "success") {
      break;
    }
    if (pollResult.status === "failed" || pollResult.status === "cancelled") {
      throw new Error(
        `GMI TTS job ${requestId} terminal status: ${pollResult.status} — ${pollResult.error ?? "no detail"}`
      );
    }
    // queued | processing — keep polling
  }

  if (!pollResult || pollResult.status !== "success") {
    throw new Error(
      `GMI TTS job ${requestId} timed out after ${timeoutMs}ms (last status: ${pollResult?.status ?? "unknown"})`
    );
  }

  // ── Step 3: Fetch audio bytes from outcome.media_urls[0].url ─────────────
  // The URL is a storage.googleapis.com link — fetch server-side; never expose to fan.
  const mediaUrl = pollResult.outcome?.media_urls?.[0]?.url;
  if (!mediaUrl) {
    throw new Error(
      `GMI TTS job ${requestId} success but no media_url in outcome`
    );
  }

  const audioRes = await fetch(mediaUrl);
  if (!audioRes.ok) {
    throw new Error(
      `GMI TTS audio fetch from media_url failed: ${audioRes.status} ${audioRes.statusText}`
    );
  }

  const arrayBuf = await audioRes.arrayBuffer();
  const audioBytes = Buffer.from(arrayBuf);

  return { mediaUrl, audioBytes, mimeType: "audio/mpeg" };
}

// ─── Circuit Breaker ──────────────────────────────────────────────────────────
//
// Wraps the WHOLE submit+poll+fetch unit.
// .fallback(() => null) → callers receive null when breaker is open.
// timeout: GMI_TTS_TIMEOUT_MS (so opossum budget = GMI timeout budget)
// errorThresholdPercentage: 50 → trip at ≥50% errors
// resetTimeout: 60_000 → half-open after 60s
// rollingCountTimeout: 60_000 → 60s sliding window
// rollingCountBuckets: 6 → 10s buckets
//
// Typed as GmiTtsOutput | null because .fallback(() => null) causes the breaker
// to return null on any trip — callers must handle null as "no voice / text-only".

// Use a wrapper so the fallback null return is reflected in the fire() type.
async function callGmiTtsWithNullFallback(
  input: GmiTtsInput
): Promise<GmiTtsOutput | null> {
  return callGmiTts(input);
}

export const gmiTtsBreaker = new CircuitBreaker<
  [GmiTtsInput],
  GmiTtsOutput | null
>(callGmiTtsWithNullFallback, {
  timeout: getTimeoutMs(),
  errorThresholdPercentage: 50,
  resetTimeout: 60_000,
  rollingCountTimeout: 60_000,
  rollingCountBuckets: 6,
  name: "gmi-tts",
});

// Fallback: return null → caller skips voice delivery, text reply goes out.
gmiTtsBreaker.fallback(() => null);

gmiTtsBreaker.on("open", () =>
  console.warn("[gmi-tts] circuit breaker OPEN — voice generation suspended")
);
gmiTtsBreaker.on("halfOpen", () =>
  console.info("[gmi-tts] circuit breaker HALF-OPEN — testing recovery")
);
gmiTtsBreaker.on("close", () =>
  console.info("[gmi-tts] circuit breaker CLOSED — voice generation restored")
);

// ─── STUB: Clone Step A ───────────────────────────────────────────────────────
//
// TODO(03-01 OPEN ITEM): submit reference clip to minimax-audio-voice-clone-speech-2.6-hd
// → outcome.voice_id. The ONE open item in the confirmed GMI TTS contract
// (03-01-GMI-TTS-CONTRACT.md §OPEN). Do NOT invent the request shape here.
// Synthesis uses preset GMI_TTS_FALLBACK_VOICE_ID until clone Step A is confirmed.
//
// When the founder pastes the clone Step A sample request+response, replace this
// stub with the real implementation and persist the returned voice_id to twins.voice_id.

export async function registerVoiceClone(
  _referenceUrl: string
): Promise<string> {
  throw new Error(
    "registerVoiceClone: clone-registration request shape is the one open item in " +
    "03-01-GMI-TTS-CONTRACT.md; not yet implemented. " +
    "Synthesis path is fully functional using GMI_TTS_FALLBACK_VOICE_ID or twins.voice_id."
  );
}
