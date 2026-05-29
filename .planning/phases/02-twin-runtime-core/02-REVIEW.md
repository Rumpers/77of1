---
phase: 02-twin-runtime-core
reviewed: 2026-05-29T00:00:00Z
depth: standard
files_reviewed: 95
files_reviewed_list:
  - artifacts/api-server/package.json
  - artifacts/api-server/src/app.ts
  - artifacts/api-server/src/config/env.ts
  - artifacts/api-server/src/lib/constitution.ts
  - artifacts/api-server/src/lib/conversation.ts
  - artifacts/api-server/src/lib/deflections.ts
  - artifacts/api-server/src/lib/disclosure.ts
  - artifacts/api-server/src/lib/helplines.ts
  - artifacts/api-server/src/lib/hmac-conversation.ts
  - artifacts/api-server/src/lib/locale.ts
  - artifacts/api-server/src/lib/moderation.ts
  - artifacts/api-server/src/lib/notify-founder.ts
  - artifacts/api-server/src/lib/system-prompt.ts
  - artifacts/api-server/src/middlewares/kyc-gate.ts
  - artifacts/api-server/src/middlewares/verify-conversation-id.ts
  - artifacts/api-server/src/providers/interfaces.ts
  - artifacts/api-server/src/providers/openai/MockModeratorProvider.ts
  - artifacts/api-server/src/providers/openai/OpenAiModeratorProvider.ts
  - artifacts/api-server/src/providers/registry.ts
  - artifacts/api-server/src/routes/index.ts
  - artifacts/api-server/src/routes/twin-profile.ts
  - artifacts/api-server/src/routes/twin.ts
  - artifacts/api-server/src/__tests__/conversation-history.test.ts
  - artifacts/api-server/src/__tests__/helpline-injection.test.ts
  - artifacts/api-server/src/__tests__/hmac-conversation.test.ts
  - artifacts/api-server/src/__tests__/kyc-gate.e2e.test.ts
  - artifacts/api-server/src/__tests__/locale-detection.test.ts
  - artifacts/api-server/src/__tests__/moderation-l1.test.ts
  - artifacts/api-server/src/__tests__/moderation-l3.test.ts
  - artifacts/api-server/src/__tests__/openai-moderator-provider.test.ts
  - artifacts/api-server/src/__tests__/safety-audit.test.ts
  - artifacts/api-server/src/__tests__/system-prompt-constitution.test.ts
  - artifacts/api-server/src/__tests__/twin-chat.e2e.test.ts
  - artifacts/fan-twin/package.json
  - artifacts/fan-twin/src/index.ts
  - artifacts/fan-twin/src/conversation.ts
  - artifacts/fan-twin/src/locale.ts
  - artifacts/fan-twin/src/session.ts
  - artifacts/fan-twin/src/__tests__/webhook-ack.test.ts
  - artifacts/hermes/package.json
  - artifacts/hermes/src/consent.ts
  - artifacts/hermes/src/index.ts
  - artifacts/hermes/src/session.ts
  - artifacts/hermes/src/scenes/consent.scene.ts
  - artifacts/hermes/src/scenes/persona.scene.ts
  - artifacts/hermes/src/scenes/voice.scene.ts
  - artifacts/hermes/src/lib/constitution-writer.ts
  - artifacts/hermes/src/lib/object-storage.ts
  - artifacts/hermes/src/__tests__/persona-wizard.test.ts
  - artifacts/hermes/src/__tests__/voice-wizard.test.ts
  - artifacts/web/src/components/fan/CrisisHelplineBubble.tsx
  - artifacts/web/src/components/fan/DisclosureFooter.tsx
  - artifacts/web/src/components/fan/LocaleSwitcher.tsx
  - artifacts/web/src/components/fan/MonetizationCTA.tsx
  - artifacts/web/src/lib/api.ts
  - artifacts/web/src/pages/fan-page.tsx
  - artifacts/worker/package.json
  - artifacts/worker/src/index.ts
  - lib/db/package.json
  - lib/db/src/schema/index.ts
  - lib/queue/src/index.ts
  - lib/queue/src/names.ts
  - lib/queue/src/options.ts
  - lib/queue/src/queues.ts
  - lib/queue/src/types.ts
  - lib/twin-runtime/package.json
  - lib/twin-runtime/src/constitution.ts
  - lib/twin-runtime/src/conversation.ts
  - lib/twin-runtime/src/deflections.ts
  - lib/twin-runtime/src/disclosure.ts
  - lib/twin-runtime/src/helplines.ts
  - lib/twin-runtime/src/hmac-conversation.ts
  - lib/twin-runtime/src/index.ts
  - lib/twin-runtime/src/locale.ts
  - lib/twin-runtime/src/logger.ts
  - lib/twin-runtime/src/moderation.ts
  - lib/twin-runtime/src/notify-founder.ts
  - lib/twin-runtime/src/provider-types.ts
  - lib/twin-runtime/src/safety-audit.ts
  - lib/twin-runtime/src/system-prompt.ts
findings:
  critical: 7
  warning: 14
  info: 5
  total: 26
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-05-29
**Depth:** standard
**Files Reviewed:** 95
**Status:** issues_found

## Summary

The twin-runtime core is structurally sound — KYC gate enforces a strict positive, the HMAC primitive uses `crypto.timingSafeEqual` with length pre-check, fail-open behavior on moderation outages is documented and tested, and the wizard scenes correctly mount `sessionMiddleware` before `stage.middleware()`.

However, there are several high-impact defects:

- **The L5 founder Telegram notification will silently fail in production** because the message body contains `_` and `/` characters and is sent with `parse_mode: "Markdown"` — Telegram rejects malformed Markdown with HTTP 400 and the alert is dropped. The very category names that matter most (`self-harm/intent`, `sexual/minors`) will trip this. Combined with the documented fail-open posture, real safety flags will go uncommunicated.
- **The fan-twin Telegram bot ships raw Telegram user IDs to GMI and into BullMQ payloads**, in violation of COMPLY-03. The web path hashes the conversation_id at the GMI boundary; the Telegram path does not.
- **The client-side crisis-detection regex `/(988|0120-279-338|1925|2389 2222)/`** will produce false positives on benign LLM output that happens to mention "988" or "1925" (years, addresses, IDs). This both downgrades the fan experience and dilutes the seriousness of the crisis UI.
- **Per-request Redis queue construction** in the voice-note enqueue path opens 6 Queue connections (one per queue type), uses only one, and closes only one — leaking connections on every chat turn that triggers voice generation.
- **The web fan_id sent to the voice generation queue is the authenticated DB fan id (plain), not the hashed value** used for the LLM call, breaking the consistent "no PII to providers" boundary.
- **CORS is open (`cors()` with no options)** combined with cookie-based session auth; the only thing that prevents a hostile origin from completing a cross-origin chat is the browser blocking `Access-Control-Allow-Origin: *` with credentials — a configuration accident away from being a real CSRF vector.

KYC enforcement, HMAC verification, helpline string content per locale (D-02-05), and Character Card V2 validation all look correct. The pipeline ordering in `routes/twin.ts` (HMAC → KYC → pause/kill → credits → moderation) is right.

## Critical Issues

### CR-01: Founder Telegram alert breaks on Markdown special characters in category name

**File:** `lib/twin-runtime/src/notify-founder.ts:22-33` (and the call site in `lib/twin-runtime/src/moderation.ts:189-191`)
**Issue:** `notifyFounderAsync` sends the L5 alert with `parse_mode: "Markdown"` and the payload is interpolated as:

```
*Safety flag* (L1) creator=${ctx.creatorId} session=${ctx.sessionId} category=${primary}
```

`primary` will routinely be `self-harm/intent`, `sexual/minors`, `harassment/threatening`, etc. Telegram's classic Markdown parser treats `_` as italic delimiters and chokes on an unmatched `_` or an unescaped `/`. When parsing fails, Telegram returns 400 and the message is NOT delivered. The function logs the failure and returns silently, so the founder never learns a self-harm flag fired. This defeats the L5 layer of the six-layer moderation pipeline that SB 243 compliance documentation cites.

A creator id is a UUID containing `-` (also a Markdown special char in some contexts); `session=` value is a 32-char hex (safe), but any future change to enrich the message with email, handle, or message excerpt will compound the risk.

**Fix:**

```ts
// In notify-founder.ts — use HTML parse_mode (more forgiving) and escape, or drop parse_mode entirely.
body: JSON.stringify({
  chat_id: chatId,
  text,
  // Either: omit parse_mode (plain text is safe and sufficient for an ops alert), OR:
  // parse_mode: "HTML",  // and escape the text with .replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]!))
}),
```

For Markdown V1 specifically, escape `_*[]()~` ` >#+-=|{}.!` in the interpolated values. Easiest: drop `parse_mode` and accept plain text — no formatting is critical for an ops alert.

---

### CR-02: Fan-twin sends raw Telegram user ID to GMI and BullMQ (COMPLY-03 violation)

**File:** `artifacts/fan-twin/src/index.ts:129`
**Issue:** The webhook handler enqueues:

```ts
fanId: String(fanTelegramId),       // raw, stable Telegram user identifier
```

This value flows into the worker, into BullMQ payload persistence (Redis), and eventually into GMI / Helicone request bodies as the "fan id" tracking key. The web path explicitly avoids this — `routes/twin.ts:225` derives `fanIdHash = hashFanId(conversationId)` and only passes that hash across the GMI boundary (per the inline comment "We never send the raw HMAC token, the cookie value, or any IP / email field across that boundary (COMPLY-03, T-02-03-04)").

Telegram user IDs are stable, globally unique, and trivially correlatable across services — they are PII for COMPLY-03 purposes. The fan-twin path silently breaks the boundary the web path enforces.

**Fix:**

```ts
import crypto from "node:crypto";
const fanIdHash = crypto
  .createHash("sha256")
  .update(`tg-fan:${fanTelegramId}`, "utf8")
  .digest("hex")
  .slice(0, 32);

await textGeneration.add(
  "fan-text",
  {
    // …
    fanId: fanIdHash,
    // …
  },
  { jobId },
);
```

If the worker needs the raw ID for delivery, store it in a separate `telegramUserId` field rather than reusing `fanId`.

---

### CR-03: Client-side helpline detection over-matches benign LLM output

**File:** `artifacts/web/src/pages/fan-page.tsx:26-48`
**Issue:** `HELPLINE_NUMBER_REGEX = /(988|0120-279-338|1925|2389 2222)/` matches any AI reply containing the substring `988` (e.g. "In the year 988…", "Room 988", song "988"), `1925` (year, "1925 yen"), or "2389 2222" (less likely false-positive). When triggered, the client:

1. Renders a `CrisisHelplineBubble` (amber-bordered, `role="alert"`, `aria-live="assertive"` — screen readers announce immediately).
2. Skips trial-counter increment.
3. Splits on the first `\n\n` — if the LLM reply happens to be a multi-paragraph message containing `988`, the first paragraph becomes the "helpline" and the rest becomes the deflection bubble.

This is a real UX bug: an innocent message becomes a crisis alarm, and the actual chat content gets relocated into an alert region. It also dilutes the crisis-bubble signal so fans habituate to it.

The server side correctly emits the helpline only when `composeFlaggedReply` runs on a self-harm flag (and prepends it as a discrete first paragraph). The client should reflect *that* signal, not infer it from substring matching on free text.

**Fix:** Have the server emit a typed flag instead of relying on regex inference. Add `is_crisis: boolean` and `helpline_text: string | null` to the `TwinChatResponse` shape:

```ts
// routes/twin.ts — when L1 or L3 flagged with self-harm:
res.json({
  text: safeReply,
  disclosure_footer: getDisclosureFooter(locale, handle),
  is_crisis: l1.severity === "high" && l1.primaryCategory?.startsWith("self-harm"),
  helpline_text: hasSelfHarm ? getHelpline(locale) : null,
  monetization_pivot,
  conversation_id: conversationId,
});
```

Client splits/renders based on the explicit fields. Delete `HELPLINE_NUMBER_REGEX` and `splitCrisisReply`.

---

### CR-04: Per-request Redis Queue creation leaks 5/6 connections

**File:** `artifacts/api-server/src/routes/twin.ts:339-363`
**Issue:** Inside the voice-note fire-and-forget block:

```ts
const queues = createAllQueues(redisUrl);      // constructs 6 Queue instances
await queues.voiceGeneration.add("voice-note", { /* … */ });
await queues.voiceGeneration.close();           // closes only ONE of them
```

`createAllQueues` (lib/queue/src/queues.ts) instantiates `Queue` for textGeneration, voiceGeneration, videoGeneration, moderation, consentRevocation, and dunningRetry — each constructs an ioredis client on first connection. Only voiceGeneration is closed; the other five hold their Redis connections until process exit. Every chat turn for an authenticated fan therefore leaks 5 ioredis sockets.

Under sustained load (a single creator's fans) this exhausts Redis client-connection limits (default 10 000) and / or local FD limits well before any observability fires.

This also makes the cold-path slow: opening 6 sockets per turn for a single async voice job is wasteful when a singleton Queue is the standard pattern.

**Fix:**

```ts
// Either: hoist a module-level queue
import { Queue } from "bullmq";
import { QUEUE_NAMES, JOB_OPTIONS, type VoiceGenerationPayload } from "@workspace/queue";

let _voiceQueue: Queue<VoiceGenerationPayload> | null = null;
function getVoiceQueue(): Queue<VoiceGenerationPayload> | null {
  if (!process.env.REDIS_URL) return null;
  if (_voiceQueue) return _voiceQueue;
  _voiceQueue = new Queue(QUEUE_NAMES.voiceGeneration, {
    connection: { url: process.env.REDIS_URL },
    defaultJobOptions: JOB_OPTIONS.voiceGeneration,
  });
  return _voiceQueue;
}

// Use:
const q = getVoiceQueue();
if (fanId && q) {
  q.add("voice-note", { /* … */ }).catch((err) => logger.warn({ err }, "[twin] voice enqueue"));
}
```

Also add a `closeAllQueues(_voiceQueue)` on process SIGTERM.

---

### CR-05: Voice queue payload uses unhashed fan id (COMPLY-03)

**File:** `artifacts/api-server/src/routes/twin.ts:347-348`
**Issue:** The voice job payload sets `creatorId, fanId` from `routes/twin.ts` local variables — `fanId` here is `res.locals.fanId`, the authenticated database fan UUID. This UUID is then persisted in Redis (BullMQ jobs are stored as JSON), passed to the worker, and ultimately ends up in the GMI XTTS request and Helicone observability metrics.

Per CLAUDE.md and the in-code comment at `routes/twin.ts:71-78`, fan identifiers crossing the provider boundary must be hashed. The voice path bypasses this even though the LLM text path enforces it. The worker has no way to recover the original fan id if it needs it; the consistent pattern is to hash here and treat the hash as the cross-boundary identity.

**Fix:** Pass `fanIdHash` (already computed at line 225) to the voice job payload instead of `fanId`:

```ts
await q.add("voice-note", {
  type: "voice-generation",
  jobDbId: crypto.randomUUID(),
  creatorId,
  fanId: fanIdHash,                  // not fanId
  consentGrantVersion: "1",
  transcript: safeReply,
  language: locale,                  // already strictly typed Locale
});
```

If the worker truly needs the DB fan id (e.g. for credit accounting), add a separate field like `creditAccountFanId` and document the privacy carve-out.

---

### CR-06: Open CORS combined with credentialed cookie auth

**File:** `artifacts/api-server/src/app.ts:31`
**Issue:** `app.use(cors());` mounts CORS with default options — `Access-Control-Allow-Origin: *`, no allowlist. The fan SPA sets `credentials: "include"` on every fetch (web/src/lib/api.ts:55, 73), so every chat turn carries the `conversation_id` httpOnly cookie. Browsers refuse to forward credentials when the server responds `*`, but:

1. A single config drift (replacing `cors()` with `cors({ origin: true, credentials: true })` to "fix the SPA in a different deploy") becomes a credential-bound CSRF surface for any attacker-controlled origin.
2. Tools and non-browser clients ignore the SOP entirely; the cookie binds to whoever holds it, and the server treats the bearer of a valid HMAC token as session-authoritative.
3. The verifyConversationId middleware mints a cookie on EVERY request without one (including from arbitrary origins) — those tokens are valid for 30 days.

This is defense-in-depth that the project has clearly thought about (HMAC binding, KYC gate, kill switch). The CORS posture is the weakest link.

**Fix:** Restrict the origin allowlist explicitly:

```ts
import cors from "cors";
const ALLOWED_ORIGINS = [
  "https://lala.la",
  "https://7of1.app",
  ...(process.env.NODE_ENV !== "production" ? ["http://localhost:22333"] : []),
];
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);          // server-to-server / curl
    cb(null, ALLOWED_ORIGINS.includes(origin));
  },
  credentials: true,
}));
```

Also: do not mint a conversation_id cookie on routes that don't need one (`/api/health*`, `/api/webhooks/*`). Move `verifyConversationId` from app.ts global mount to the twin and twin-profile routers explicitly.

---

### CR-07: Voice queue closes its own backing infrastructure mid-flight

**File:** `artifacts/api-server/src/routes/twin.ts:353`
**Issue:** Beyond the connection leak of CR-04, this line awaits `queues.voiceGeneration.close()` immediately after `add()` returns. BullMQ's `Queue.close()` disconnects the Redis client. If `add()` resolves before the underlying `XADD`/`SADD` commands are fully flushed (BullMQ uses pipelining), the close may race the actual enqueue and the job is never visible to the worker.

In practice BullMQ awaits the bulk add internally, so this MAY be benign — but the pattern is fragile and unnecessary. Combined with CR-04, the symptom is "voice jobs intermittently lost under load."

**Fix:** Subsumed by CR-04 — use a long-lived singleton Queue and never close per-request.

## Warnings

### WR-01: Express 5 unhandled rejection in `verifyConversationId` for non-cookie routes

**File:** `artifacts/api-server/src/app.ts:44`, `artifacts/api-server/src/middlewares/verify-conversation-id.ts`
**Issue:** `verifyConversationId` is mounted globally before all `/api` routes, including `/api/webhooks/stripe` (which uses `express.raw()` BEFORE this middleware, so it bypasses cookie-parser anyway) and `/api/health`. For requests that legitimately should never participate in a conversation (Stripe webhooks, health probes, email webhooks), this:

1. Reads `req.cookies` (always undefined for service-to-service traffic, fine).
2. Mints a brand-new conversation_id cookie if no incoming one.
3. Sets `Set-Cookie: conversation_id=…` on the response back to Stripe / SES.

Setting cookies on webhook 200-responses is harmless but pollutes Stripe's logs and breaks idempotency assumptions if Stripe ever caches headers. More important — every webhook now has a `Set-Cookie` header with a 30-day token, and if the destination service ever logs request/response pairs, those tokens leak to the service's audit logs.

**Fix:** Mount per-router, not globally:

```ts
// app.ts — remove global app.use(verifyConversationId);
// routes/index.ts — wire only where needed:
router.use("/twin", verifyConversationId);
router.use("/twin", twinRouter);
router.use("/twin", twinProfileRouter);
```

### WR-02: `safety-audit.ts` imports `@workspace/db` at module load (breaks lib/twin-runtime portability)

**File:** `lib/twin-runtime/src/safety-audit.ts:10-11`
**Issue:** `import { db } from "@workspace/db"` is a top-level import. Every consumer that imports any twin-runtime sub-module which transitively touches safety-audit will load `@workspace/db`, which opens a Pool against `DATABASE_URL` at module load. The fan-twin bot's `bot.start` does `await import("@workspace/twin-runtime/disclosure")` — fine because that's a sub-path import that doesn't pull `index.ts`. But `moderation.ts` does `import { writeSafetyAuditLog } from "./safety-audit.js"` at top level, so any consumer of moderation drags db along.

This is also inconsistent with the rest of twin-runtime (constitution.ts and conversation.ts use lazy `getDb()` to defer the connection). The tests work because they `vi.mock("@workspace/db")`, but a fresh consumer (e.g. a future CLI script that calls `composeFlaggedReply`) will fail at import.

**Fix:** Lazy-load:

```ts
async function getDb() {
  const { db, safetyAuditLogTable } = await import("@workspace/db");
  return { db, safetyAuditLogTable };
}
// inside writeSafetyAuditLog's IIFE:
const { db, safetyAuditLogTable } = await getDb();
await db.insert(safetyAuditLogTable).values({ /* … */ });
```

### WR-03: Persisting fan input before moderation creates orphan rows on provider failure

**File:** `artifacts/api-server/src/routes/twin.ts:231-237` then `282-300`
**Issue:** The pipeline is:
1. Persist user turn to `conversation_messages`.
2. Run L1 moderation.
3. Call LLM.
4. Run L3 moderation.
5. Persist assistant turn.

If the LLM call throws `ProviderTransientError` (line 282) the route returns 503 — but the user's row is already in the DB. The fan retries (cookie persists), the next `loadHistory` includes both the orphaned user turn AND the retry, so the LLM context now has two adjacent user turns with no assistant in between, which silently degrades quality. Worse, on chronic LLM outage the conversation_messages table accumulates user-only rows.

**Fix:** Either persist the user turn AFTER the LLM call succeeds (and surface a sensible error message to the fan if it fails), or persist a placeholder assistant row carrying `errorMessage` so history is balanced. The cleaner option is to wrap the persistence + LLM in a try/catch and only commit the user row on success.

### WR-04: `notify-founder.ts` uses `console.warn/error` instead of pino logger

**File:** `lib/twin-runtime/src/notify-founder.ts:15, 35, 38`
**Issue:** twin-runtime ships a structured `logger` (logger.ts, used everywhere else). notify-founder uses raw `console` — these calls bypass redaction (lib/twin-runtime/src/logger.ts:13-17 redacts authorization headers and cookies; console doesn't), and produce un-parseable lines in production log aggregators that expect JSON from pino. Combined with the fail-silent Markdown bug (CR-01), this also means the only signal that the Telegram alert failed is a free-text console line.

**Fix:** `import { logger } from "./logger.js"` and replace the three console calls with `logger.warn(...)` / `logger.error(...)`.

### WR-05: `safety-audit.ts` double-hashes the fan id

**File:** `lib/twin-runtime/src/moderation.ts:178` → `lib/twin-runtime/src/safety-audit.ts:72`
**Issue:** `runModeration` passes `ctx.fanIdHash` (already a SHA-256 hash, computed at `routes/twin.ts:225`) as `fanId` to `writeSafetyAuditLog`. `writeSafetyAuditLog` then SHA-256s it AGAIN to produce `fanIdHash`. The stored value is `sha256(sha256("fan:" + conversationId))`. Not a privacy issue (still one-way), but it means correlating a flagged turn with a fan via the conversation id is more steps than necessary, and the function's API ("pass the raw id, I'll hash it") is misleading given the input is already hashed.

**Fix:** Either rename the `SafetyAuditEntry.fanId` field to `fanIdHash` and skip the inner hash, or have the route pass the unhashed conversation_id and document the hashing as the audit layer's responsibility. Pick one boundary.

### WR-06: Helicone observability misses per-creator/fan tags

**File:** `artifacts/api-server/src/providers/openai/OpenAiModeratorProvider.ts:63-66`
**Issue:** When Helicone is enabled the only custom header set is `Helicone-Property-Pipeline: moderation`. CLAUDE.md explicitly cites per-creator cost dashboards with hashed fan IDs as a reason to use Helicone, but no `Helicone-User-Id` / `Helicone-Property-Creator-Id` / `Helicone-Property-Fan-Id` headers are added. The dashboards will aggregate at the global "moderation pipeline" level only.

**Fix:** Plumb `creatorId` and `fanIdHash` through `moderate(text, opts)` and attach them as `Helicone-Property-*` headers in the OpenAI provider. The IModeratorProvider contract change is one extra optional param.

### WR-07: `fan-twin/src/index.ts` `isEntry` heuristic is brittle

**File:** `artifacts/fan-twin/src/index.ts:173-184`
**Issue:** Suffix-matching `process.argv[1]` against three hard-coded path tails. Common ways this breaks: running via a different bin name (e.g. `node --inspect dist/index.mjs`), bundlers that rename entry points, or PM2 / systemd wrappers that rewrite argv. When the heuristic fails, `launch()` is never called and the bot silently does not start — only the test harness still works.

**Fix:** Use `import.meta.url` against the ESM entry convention:

```ts
import { fileURLToPath } from "node:url";
const isEntry = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isEntry) launch();
```

Or split the file: `src/index.ts` just calls `launch()`, `src/bot.ts` exports `bot` for tests. Tests import the bot module directly without triggering launch.

### WR-08: `routes/twin-profile.ts` has no rate limiting — handle enumeration

**File:** `artifacts/api-server/src/routes/twin-profile.ts:37-86`
**Issue:** `GET /api/twin/:handle/profile` returns `{ handle, brand_color, monetization_url, platform_name, locale_default }` for any creator without authentication. An attacker can iterate the handle space and harvest every creator's monetization URL, locale, and brand styling — useful for targeted phishing ("Hey love, my real Fanvue is at this URL instead") or scraping the creator roster pre-launch.

**Fix:** Apply rate limiting (`express-rate-limit` keyed on IP, e.g. 60 req/min). Even simpler: return 404 (not 200) when the creator's `creators.config.publicProfile !== true`, then opt-in publishing.

### WR-09: `OpenAiModeratorProvider` leaks moderated text into error logs

**File:** `artifacts/api-server/src/providers/openai/OpenAiModeratorProvider.ts:83-90`
**Issue:** On non-2xx responses the body is read with `await res.text()` and concatenated into the error message: `OpenAI API error: 400 Bad Request — { ... "input": "fan's private message" ... }`. OpenAI's error responses can echo the input field for validation errors. That string is then thrown as part of `ProviderError.message` and may be logged by the route's `logger.error({ event: "twin.chat.provider_error", creatorId })`. While the catch block strips the message in the production path, the audit / safety-audit / pino logger redaction lists don't cover provider error bodies.

**Fix:** Truncate the body to ~200 chars in the error message and never log it at info+ levels. Better: log only the status code and OpenAI request-id header.

### WR-10: Persona wizard re-uses scene state across `/persona` re-entries without reset

**File:** `artifacts/hermes/src/scenes/persona.scene.ts:151-167`
**Issue:** `enterStep` initialises `s.currentIndex = 0; s.answers = {}`, which is correct. But `ctx.scene.enter("persona-wizard", { creatorId, creatorName, currentIndex: 0, answers: {} })` in `index.ts:215-220` also passes initial state. If a creator types `/persona` while already inside the persona scene (a re-entry mid-flow), Telegraf's WizardScene retains scene state across re-entry by default — the `enterStep` reset is correct, but the consent scene at `consent.scene.ts:83-93` shows the same pattern. Worth a defensive double-check that nothing depends on the prior answers.

A bigger issue: if the wizard captures a half-finished `platform_url` ("https" with no host) and the user abandons, the next /persona starts clean — but the half-finished value lives in the persisted Postgres session row until overwritten. That's a minor data-cleanliness issue, not a bug.

**Fix:** Add `ctx.scene.session = { ...emptyDefaults }` (or invoke `ctx.wizard.cursor = 0; ctx.wizard.state = {...}` explicitly) in enterStep to make the reset bullet-proof.

### WR-11: Consent scene array-index access is unchecked

**File:** `artifacts/hermes/src/scenes/consent.scene.ts:42, 106, 124, 149`
**Issue:** `CONSENT_ITEMS[index]` is accessed without bounds check. `state.currentIndex` is the controlling integer; if scene state is corrupted (legacy session row, partial migration, manual SQL edit), index could be out of range and `item` becomes `undefined`. Then `item.grantType` throws `TypeError: Cannot read property 'grantType' of undefined`, the wizard crashes, the user sees no reply, and the scene state remains in an inconsistent state (re-entry hits the same row).

Telegraf catches synchronous throws but the user-visible experience is "bot stopped working for me." Strict TS doesn't catch this because tuple index access returns `T | undefined` only when `noUncheckedIndexedAccess` is on (the project uses strict but not this flag).

**Fix:**

```ts
const item = CONSENT_ITEMS[s.currentIndex];
if (!item) {
  await ctx.reply("Something went wrong with your consent state. Send /consent to restart.");
  return ctx.scene.leave();
}
```

### WR-12: Persona scene `bot.command('persona')` runs even when KYC is unsigned

**File:** `artifacts/hermes/src/index.ts:204-221`
**Issue:** /persona, /voice, /consent, /persona_complete don't gate on KYC. The fan-facing twin path requires `creator_kyc.status = 'signed'`, but Hermes lets the creator complete persona + consent + voice upload before signing. That isn't necessarily a defect (the wizard data is durable and lets the creator move at their own pace), but at minimum the spec calls out that consent and personality data are legally significant; capturing them before the license is signed could create downstream evidence-of-consent claims where the binding was incomplete.

**Fix:** Either explicitly document that pre-KYC capture is allowed (and persist `kycStatusAtCapture` on consent_grants rows), or gate `/consent` (the legally-binding command) on a `getKycRow(creator.id).status === "signed"` check with a friendly "Please complete KYC first" reply.

### WR-13: Hermes `bot.on('photo'|'video'|'document')` runs even inside an active wizard scene

**File:** `artifacts/hermes/src/index.ts:318, 392, 473`
**Issue:** Telegraf v4 dispatches `bot.on('photo')` BEFORE scene-step handlers consume the update (top-level handlers registered via `bot.on(...)` run with the rest of the middleware chain). If a creator inside the `voice-wizard` scene accidentally sends a photo instead of a voice note, the photo handler runs (downloads, moderates, persists as approved asset), AND the voice scene's captureStep sees an `undefined` voice and re-prompts. The asset ends up in the creators' approved-asset table without explicit intent.

The reverse problem also applies to the persona scene: if the creator sends a photo while answering "what off-limits?", the photo gets moderated and stored.

**Fix:** Inside top-level `bot.on('photo'|'video'|'document')` handlers, check `if (ctx.scene?.current) return;` to defer to the active scene.

### WR-14: `signConversationId` throws via env access on every signing call

**File:** `lib/twin-runtime/src/hmac-conversation.ts:16-25, 29-35`
**Issue:** `getConversationSecret()` reads `process.env.HMAC_CONVERSATION_SECRET` on every call to `signConversationId` and `deriveTelegramConversationId`. Each request that mints a new web cookie does at least one env lookup; each Telegram message does another. On a hot path this is wasteful and exposes the secret to environment-level race conditions (env var unset by an ops mistake mid-process → next request 500s instead of degrading).

**Fix:** Cache the validated secret once at module load:

```ts
const SECRET = (() => {
  const s = process.env.HMAC_CONVERSATION_SECRET;
  if (!s || s.length < 32) throw new Error(/* … */);
  return s;
})();
```

Or hold a lazy `let _cached: string | null` and validate on first call. Either way: validate once, not per-message.

## Info

### IN-01: Worker `index.ts` references stale stub generation pipeline

**File:** `artifacts/worker/src/index.ts:181-197`
**Issue:** `processTextJob` is still the Phase 1 stub ("STUB: the full persona/RAG/GMI pipeline will be ported in Phase 2"). Phase 2 is now done per the phase context, but the worker text job has not been wired to twin-runtime's `runL1Moderation` / `runL3Moderation` / `getTextProvider`. The fan-twin enqueues jobs that the worker processes as no-ops then marks complete — meaning fans on the Telegram channel currently receive nothing back.

**Fix:** Implement the worker text-generation handler that mirrors `routes/twin.ts` (HMAC-derived conversation_id, runL1, getTextProvider().generateText, runL3, persistTurn, deliver via Telegraf API to telegramChatId, with disclosure footer appended). Likely tracked in a separate task — flagging because the fan-twin path is otherwise dead.

### IN-02: `Slack-vs-Telegram` duplicate alert paths

**File:** `lib/twin-runtime/src/safety-audit.ts:32-67` and `lib/twin-runtime/src/notify-founder.ts:11-42`
**Issue:** High-severity flags fire BOTH `fireSlackAlert` (from inside writeSafetyAuditLog) and `notifyFounderAsync` (from moderation.ts:188). Two channels, two env-var pairs to keep in sync (SAFETY_ALERT_WEBHOOK_URL vs FOUNDER_TELEGRAM_CHAT_ID + TELEGRAM_BOT_TOKEN_LALA). Either is a complete alert; running both duplicates ops noise and increases the surface area for credential misconfiguration.

**Fix:** Pick one. If Telegram is the canonical founder channel (it is — D-02-04), retire the Slack webhook (or move it to a Phase 3 "team escalation" tier).

### IN-03: `DEFLECTIONS` table allows no future-proofing for `zh-HK`

**File:** `lib/twin-runtime/src/deflections.ts:14-39`
**Issue:** `DeflectionLocale = "en"|"ja"|"zh-TW"`. The helplines table includes `zh-HK` (helplines.ts:18), and `getHelpline("zh-HK")` returns the HK number — but `getDeflection("zh-HK", ...)` falls back to `en`. If a future HK fan ever gets the crisis path, they'll see Cantonese-speaker helpline + English deflection. Minor consistency issue.

**Fix:** Either add `zh-HK` deflection strings or accept the EN fallback as documented behaviour.

### IN-04: Unused `voice.scene.ts` `mime_type` fallback width

**File:** `artifacts/hermes/src/lib/object-storage.ts:69-75`
**Issue:** `uploadVoiceReference` derives extension from mime type with `.replace(/[^a-z0-9]/g, "")`. For `audio/wav` → `wav`; `audio/ogg` → `ogg`; `audio/x-m4a` → `xm4a` (not a valid extension). Unlikely to matter for Telegram which always sends `audio/ogg`, but the helper is exported for any future caller.

**Fix:** Whitelist known extensions: `const KNOWN: Record<string, string> = { "audio/ogg": "ogg", "audio/wav": "wav", "audio/mpeg": "mp3" };` and fall back to `bin` for unknown types.

### IN-05: Test e2e relies on `Promise.resolve().then(...)` ordering for voice queue

**File:** `artifacts/api-server/src/routes/twin.ts:339-364`
**Issue:** The voice fire-and-forget uses `Promise.resolve().then(async () => { … })` then resolves the request. Tests do not assert that the queue is reached because the test mocks REDIS_URL away. If the queue throws synchronously the error is caught and logged at warn; if it throws asynchronously the unhandled rejection is silently swallowed. The same pattern in `notify-founder` uses `void (async () => {...})()` which is consistent. Picking one async-IIFE pattern across the codebase would help reviewers.

**Fix:** Standardise on `void (async () => { ... })()` everywhere; document the pattern in lib/twin-runtime PATTERNS.

---

_Reviewed: 2026-05-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
