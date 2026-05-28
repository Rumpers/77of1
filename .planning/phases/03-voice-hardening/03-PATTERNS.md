# Phase 3: Voice + Hardening — Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 18 new + 9 modified = 27 total
**Analogs found:** 25 / 27 (the remaining 2 are pure-greenfield modules — opossum-wrapped TTS client, escalation scorer — but each still rides on top of an existing Phase 2 analog noted below)

## File Classification

### New files

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `lib/twin-runtime/src/escalation.ts` | shared-lib module | request-response (pure fn over DB) | `lib/twin-runtime/src/moderation.ts` | role+flow match |
| `lib/twin-runtime/src/voice.ts` | shared-lib module | event-driven (enqueue) | `lib/twin-runtime/src/conversation.ts` (persistTurn pattern) | role match |
| `lib/twin-runtime/src/dsar.ts` | shared-lib utility | batch (pure fn — DB + storage sweep) | `artifacts/worker/src/workers/consent-revocation.ts` (Drizzle multi-table delete pattern) | flow match |
| `lib/providers/src/providers/gmi-tts-client.ts` | provider HTTP client | request-response | `lib/providers/src/providers/gmi-client.ts` | role+flow exact |
| `artifacts/api-server/src/routes/voice.ts` | controller / route | request-response (token-gated stream) | `artifacts/api-server/src/routes/dsar.ts` (Express Router pattern), `artifacts/api-server/src/routes/assets.ts` (multer-style binary handling) | role match |
| `artifacts/api-server/src/lib/voice-token.ts` | utility | request-response (HMAC sign/verify) | `lib/twin-runtime/src/hmac-conversation.ts` | role+flow exact |
| `artifacts/worker/src/workers/dsar-deletion.ts` | worker | batch / event-driven | `artifacts/worker/src/workers/consent-revocation.ts` | role+flow exact |
| `artifacts/hermes/src/scenes/dsar.scene.ts` | scene (creator-facing controller) | event-driven (Wizard state machine) | `artifacts/hermes/src/scenes/consent.scene.ts` | role+flow exact |
| `artifacts/hermes/src/scenes/review-masks.scene.ts` | scene + inline keyboard | event-driven (callback_query loop) | `artifacts/hermes/src/scenes/consent.scene.ts` (scene shape) + new Markup.inlineKeyboard usage | role partial — inline keyboard pattern is new to Hermes |
| `artifacts/web/src/components/fan/VoiceMessageBubble.tsx` | React component | request-response (audio playback) | (no exact analog — see "No Analog Found"; closest is any existing fan SPA bubble component) | none |
| `lib/twin-runtime/src/__tests__/escalation.test.ts` | unit test | request-response | `lib/twin-runtime/src/__tests__/moderation.test.ts` (Vitest pattern, infer from `lib/twin-runtime/src/moderation.ts`) | role+flow exact |
| `supabase/migrations/20260601000001_phase3_voice_dsar_ocr.sql` | migration | DDL | `supabase/migrations/20260527000001_creator_preferences.sql`, `supabase/migrations/20260525000001_safety_audit_log.sql` | exact |

### Modified files

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `artifacts/worker/src/workers/voice-generation.ts` | worker | event-driven | (self — stub body becomes real); patterns from `text-generation.ts` | role+flow exact |
| `artifacts/api-server/src/providers/gmi/GmiVoiceProvider.ts` | provider impl | request-response | `artifacts/api-server/src/providers/gmi/GmiTextProvider.ts` | role+flow exact |
| `artifacts/api-server/src/routes/twin.ts` | controller (extended) | request-response | (self — only adds escalation gate + voice enqueue) | self |
| `artifacts/worker/src/workers/text-generation.ts` | worker (extended) | event-driven | (self — only adds escalation + post-L3 voice enqueue) | self |
| `artifacts/hermes/src/db.ts` | DB layer | CRUD | (self — appends new query fns for `fan_name_masks`, `dsar_requests`) | self |
| `artifacts/hermes/src/i18n.ts` | i18n strings | request-response | (self — extend Strings interface) | self |
| `artifacts/hermes/src/index.ts` | bot wiring | event-driven | (self — register `dsarWizard`, `reviewMasksWizard`, `bot.action(/^mask:.../)` | self |
| `lib/db/src/schema/index.ts` | schema | DDL | (self — add `fan_name_masks`, `creator_deletion_log`, `safety_audit_log.category_scores`) | self |
| `lib/queue/src/{names,types,queues,options}.ts` | queue config | event-driven | (self — add `dsarDeletion` per existing 6-queue pattern) | self |
| `lib/twin-runtime/src/safety-audit.ts` | audit writer | event-driven | (self — accept + persist `categoryScores`) | self |
| `lib/api-spec/openapi.yaml` | API contract | DDL | (self — add `GET /api/voice/{jobId}` schema) | self |

## Pattern Assignments

### `lib/providers/src/providers/gmi-tts-client.ts` (provider HTTP client, request-response)

**Analog:** `lib/providers/src/providers/gmi-client.ts`

**Imports + class shape pattern** (`gmi-client.ts:9–56`):
```typescript
import crypto from "crypto";

const HELICONE_PROXY_BASE = "https://custom.helicone.ai";

export interface GmiClientConfig {
  baseUrl: string;
  apiKey: string;
  heliconeApiKey?: string;
}

export interface GmiRequestOptions {
  path: string;
  body: unknown;
  signal?: AbortSignal;
  heliconeContext?: { creatorId: string; jobType: string; fanId: string; };
}

export class GmiClient {
  static fromEnv(): GmiClient {
    const baseUrl = process.env["GMI_API_BASE_URL"];
    const apiKey = process.env["GMI_API_KEY"];
    if (!baseUrl) throw new Error("GMI_API_BASE_URL env var is required");
    if (!apiKey) throw new Error("GMI_API_KEY env var is required");
    return new GmiClient({ baseUrl, apiKey, heliconeApiKey: process.env["HELICONE_API_KEY"] });
  }
  // ...
}
```

**Helicone routing pattern** (`gmi-client.ts:66–89`):
```typescript
const useHelicone = !!this.heliconeApiKey;
const fetchUrl = useHelicone
  ? `${HELICONE_PROXY_BASE}${opts.path}`
  : `${this.baseUrl}${opts.path}`;
const headers: Record<string, string> = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${this.apiKey}`,
};
if (useHelicone) {
  headers["Helicone-Auth"] = `Bearer ${this.heliconeApiKey}`;
  headers["Helicone-Target-URL"] = this.baseUrl;
  if (opts.heliconeContext) {
    const { creatorId, jobType, fanId } = opts.heliconeContext;
    headers["Helicone-Property-Creator-Id"] = creatorId;
    headers["Helicone-Property-Job-Type"] = jobType;
    headers["Helicone-Property-Fan-Id-Hash"] = hashId(fanId);
  }
}
```

**Retry pattern (5xx ≤2 retries, 4xx no retry)** (`gmi-client.ts:98–119`):
```typescript
if (res.ok) return res.json() as Promise<T>;
if (res.status >= 400 && res.status < 500) {
  const body = await res.text();
  throw new Error(`GMI API ${res.status}: ${body}`);
}
if (attempt < 2) {
  const delay = (attempt + 1) * 500;
  await new Promise((r) => setTimeout(r, delay));
  return this.requestWithRetry<T>(opts, attempt + 1);
}
```

**Copy notes:** TTS client reuses `GmiClient.fromEnv()` if endpoint is OpenAI-compatible JSON, OR sub-classes / sibling-clients if multipart needed. Set `heliconeContext.jobType = "voice-tts"` (matches the `text-generation.ts:464` precedent of `jobType: "text"`).

### `artifacts/api-server/src/providers/gmi/GmiVoiceProvider.ts` (provider impl, request-response)

**Analog:** `artifacts/api-server/src/providers/gmi/GmiTextProvider.ts`

**Class shape + env-driven constructor** (`GmiTextProvider.ts:38–62`):
```typescript
export class GmiTextProvider implements ITextProvider {
  readonly modelId = MODEL_ID;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly heliconeApiKey: string | undefined;

  constructor(opts?: { apiKey?: string; baseUrl?: string; heliconeApiKey?: string }) {
    this.apiKey = opts?.apiKey ?? process.env["GMI_API_KEY"] ?? "";
    if (!this.apiKey) throw new Error("GMI_API_KEY is required. Set it in Replit Secrets...");
    this.baseUrl = opts?.baseUrl ?? process.env["GMI_API_BASE_URL"] ?? DEFAULT_GMI_BASE_URL;
    this.heliconeApiKey = opts?.heliconeApiKey ?? process.env["HELICONE_API_KEY"];
  }
}
```

**Provider error wrapping** (`GmiTextProvider.ts:101–119`):
```typescript
try {
  res = await fetch(`${this.baseUrl}/chat/completions`, { ... });
} catch (err) {
  throw new ProviderTransientError(`GMI network error: ${(err as Error).message}`, undefined, "gmi");
}
if (!res.ok) {
  const body = await res.text().catch(() => "");
  const msg = `GMI API error: ${res.status} ${res.statusText} — ${body}`;
  if (res.status >= 500) throw new ProviderTransientError(msg, res.status, "gmi");
  throw new ProviderError(msg, res.status, "gmi");
}
```

**Current stub to replace** (`GmiVoiceProvider.ts:13–28`):
```typescript
export class GmiVoiceProvider implements IVoiceProvider {
  async enqueueVoiceGeneration(input: VoiceGenerationInput): Promise<VoiceGenerationResult> {
    console.log(`[gmi-voice] enqueueVoiceGeneration stub ...`);
    const providerJobId = `stub-${crypto.randomUUID()}`;
    return { providerJobId };
  }
}
```

**Copy notes:** Replace stub body with a `GmiClient` (or new `GmiTtsClient`) call wrapped in `opossum` circuit breaker per RESEARCH Pattern 1. Match `ProviderError` / `ProviderTransientError` taxonomy so BullMQ retry semantics in `voice-generation.ts:56–75` work unchanged.

### `artifacts/worker/src/workers/voice-generation.ts` (worker, event-driven)

**Analog:** `artifacts/worker/src/workers/text-generation.ts` (currently-stubbed body uses the same `createWorker(registry, redisUrl)` signature).

**Worker shell pattern** (`text-generation.ts:116–166`):
```typescript
export function createWorker(
  registry: ProviderRegistry,
  redisUrl: string,
): Worker<TextGenerationPayload> {
  const worker = new Worker<TextGenerationPayload>(
    QUEUE_NAMES.textGeneration,
    async (job) => {
      const payload = job.data;
      const { jobDbId, creatorId, fanId, deliveryChannel } = payload;

      if (isUuid(jobDbId)) {
        await db
          .update(generationJobsTable)
          .set({ status: "processing", bullmqJobId: job.id, attemptCount: job.attemptsMade + 1 })
          .where(eq(generationJobsTable.id, jobDbId));
      }
      // ... pipeline body ...
    },
    { connection: { url: redisUrl }, concurrency: CONCURRENCY },
  );
  worker.on("failed", async (job, err) => { ... });
  return worker;
}
```

**Outbound Telegraf singleton (no .launch())** (`text-generation.ts:69–84`):
```typescript
let _fanTwinOut: Telegraf | null = null;
function getFanTwinOut(): Telegraf {
  if (_fanTwinOut) return _fanTwinOut;
  const token = process.env.TELEGRAM_BOT_TOKEN_FAN_TWIN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN_FAN_TWIN is not set ...");
  _fanTwinOut = new Telegraf(token);
  return _fanTwinOut;
}
```

**Failure → DB mark-failed pattern** (current `voice-generation.ts:56–75`):
```typescript
worker.on("failed", async (job, err) => {
  if (!job) return;
  const isFinal = job.attemptsMade >= (job.opts.attempts ?? 1);
  if (isFinal) {
    await db.update(generationJobsTable).set({
      status: "failed", errorMessage: err.message, completedAt: new Date(),
    }).where(eq(generationJobsTable.id, job.data.jobDbId));
  } else {
    await db.update(generationJobsTable).set({ attemptCount: job.attemptsMade })
      .where(eq(generationJobsTable.id, job.data.jobDbId));
  }
});
```

**Copy notes:**
- Replace `console.log` STUB at `voice-generation.ts:39–41` with: opossum-wrapped TTS call → Buffer → upload to Object Storage at `creators/{creatorId}/generations/{jobDbId}.ogg` → set `generationJobsTable.resultUrl` to the HMAC-signed proxy URL → `sendVoice` to Telegram (≤1MB check per CONTEXT default #9).
- Re-check creator voice consent IMMEDIATELY before Object Storage write (Pitfall 7 in RESEARCH).
- For `deliveryChannel === "telegram"`: get `fanTwinOut` singleton and `bot.telegram.sendVoice(chatId, { source: buffer })` with caption = disclosure footer.

### `artifacts/worker/src/workers/dsar-deletion.ts` (worker, batch)

**Analog:** `artifacts/worker/src/workers/consent-revocation.ts`

**Worker shape + concurrency** (`consent-revocation.ts:82–95`):
```typescript
export function createWorker(_registry: ProviderRegistry, redisUrl: string): Worker<ConsentRevocationPayload> {
  const worker = new Worker<ConsentRevocationPayload>(
    QUEUE_NAMES.consentRevocation,
    async (job) => {
      const { creatorId, consentGrantId, killSwitch, modality } = job.data;
      const t0 = Date.now();
      // ... sweep body ...
    },
    { connection: { url: redisUrl }, concurrency: CONCURRENCY },
  );
  worker.on("failed", (job, err) => { ... });
  return worker;
}
```

**Multi-table Drizzle delete + SLA timing** (`consent-revocation.ts:90–185`):
```typescript
// Query matching rows
let query = db.select({...}).from(generationJobsTable).where(
  and(
    eq(generationJobsTable.creatorId, creatorId),
    inArray(generationJobsTable.status, ["queued", "processing"]),
  )
);
// Authoritative DB update
await db.update(generationJobsTable).set({
  status: "cancelled",
  errorMessage: killSwitch ? "kill_switch" : "consent_revoked",
  completedAt: new Date(),
}).where(inArray(generationJobsTable.id, jobIds));

const sweepMs = Date.now() - t0;
if (sweepMs > 60000) {
  console.error(`[revocation] WARN sweep exceeded 60s SLA sweepMs=${sweepMs} creator=${creatorId}`);
}
```

**BullMQ in-flight job cancellation** (`consent-revocation.ts:21–61`):
```typescript
const { Queue } = await import("bullmq");
const q = new Queue(queueName, { connection: { url: redisUrl } });
for (const bullmqId of bullmqIds) {
  const job = await q.getJob(bullmqId);
  if (!job) continue;
  const state = await job.getState();
  if (state === "waiting" || state === "delayed") {
    await job.remove();
  } else if (state === "active") {
    await job.updateData({ ...job.data, cancelled: true });
  }
}
await q.close();
```

**Copy notes:**
- DSAR worker sweeps 6 tables — pattern is the same: `db.delete(table).where(eq(table.creatorId, creatorId))` repeated per table (RESEARCH Pattern 5 lists order).
- **Do NOT delete `creatorsTable` row** (Pitfall 4): `db.update(creatorsTable).set({ displayName: "DELETED", telegramUserId: null, ... })`. Cascade-on-delete would otherwise nuke FK-cascaded children.
- Object Storage prefix sweep: see RESEARCH Pattern 5 lines 569–575 for `client.list({ prefix: "creators/{id}/" })` + iterate `client.delete(o.name)`.
- Write `creator_deletion_log` row LAST, hash-only audit per Pitfall 4.
- `concurrency: 1` for serialization (destructive op).

### `lib/twin-runtime/src/escalation.ts` (shared-lib module, request-response)

**Analog:** `lib/twin-runtime/src/moderation.ts` + `lib/twin-runtime/src/safety-audit.ts`

**Pure-function shape + Drizzle import pattern** (`safety-audit.ts:1–30`):
```typescript
import { createHash } from "crypto";
import { db } from "@workspace/db";
import { safetyAuditLogTable } from "@workspace/db";

export type CrisisLevel = "none" | "low" | "medium" | "high";

export interface SafetyAuditEntry {
  creatorId: string;
  fanId: string;
  sessionId: string;
  // ... fields
}
```

**Provider-agnostic pattern** (`moderation.ts:31–54`):
```typescript
export type ModeratorProviderFactory = () => IModeratorProvider;
let _moderatorProviderFactory: ModeratorProviderFactory | null = null;
export function setModeratorProviderFactory(factory: ModeratorProviderFactory): void { ... }
```
(Escalation scorer doesn't need this — it reads `safety_audit_log` directly. But mirror the export-as-named-fn idiom.)

**Schema column constraint:** `safety_audit_log` currently does NOT store `category_scores`. The Phase 3 migration MUST add a nullable `category_scores jsonb` column (Pitfall 3). Existing rows treat as zero-contribution.

**Copy notes:**
- Window query example in RESEARCH Pattern 2 lines 390–404 (Drizzle `.orderBy(desc(...)).limit(...)`).
- Recency-weighted sum with half-life decay — pure function, no provider call.
- On `flagged=true`: write a NEW `safety_audit_log` row with `crisisType="escalation_detected"` and `confidence=cumulativeScore` (CONTEXT specifics).
- Threshold/half-life as env-var constants (per Open Question #5): `MOD_07_THRESHOLD`, `MOD_07_HALF_LIFE`.

### `lib/twin-runtime/src/voice.ts` (shared-lib module, event-driven)

**Analog:** `lib/twin-runtime/src/conversation.ts` (persistTurn — Drizzle write + return contract)

**Workspace import convention** (`text-generation.ts:43–54`):
```typescript
import { runL1Moderation, runL3Moderation } from "@workspace/twin-runtime/moderation";
import { loadHistory, persistTurn } from "@workspace/twin-runtime/conversation";
import { buildSystemPrompt } from "@workspace/twin-runtime/system-prompt";
import { readConstitution } from "@workspace/twin-runtime/constitution";
import { getDisclosureFooter } from "@workspace/twin-runtime/disclosure";
import { getHelpline } from "@workspace/twin-runtime/helplines";
```

**Enqueue pattern from RESEARCH Common Operation 1** (lines 681–699):
```typescript
await queues.voiceGeneration.add(
  "voice-gen",
  { type: "voice-generation", jobDbId: voiceJobDbId, creatorId, fanId: fanIdHash,
    consentGrantVersion: "v1.0", transcript: safeReply, language: locale, twinId: twin.id,
    deliveryChannel: "telegram", telegramChatId, conversationId } as VoiceGenerationPayload,
  { jobId: voiceJobDbId, attempts: 2, backoff: { type: "exponential", delay: 1000 } },
);
```

**Copy notes:** Export `shouldGenerateVoice(creatorId, twin)` that checks (a) `creator_kyc.voice_synthesis_consent_granted` (b) active `consent_grants(modality=voice, granted=true, revokedAt IS NULL)` (c) `twins.voiceReferenceUrl` populated. The query pattern matches `findActiveVoiceConsentGrant` in `hermes/src/db.ts:317–333`.

### `artifacts/api-server/src/routes/voice.ts` (controller, request-response)

**Analog:** `artifacts/api-server/src/routes/dsar.ts` (Express Router shape) + `artifacts/api-server/src/routes/assets.ts` (file-bytes handling)

**Express Router boilerplate** (`assets.ts:5–9` and `dsar.ts:12–14`):
```typescript
import { Router, type IRouter, type Request, type Response } from "express";
const router: IRouter = Router();
// ...
export default router;
```

**Route shape with middleware chain + 503 stub fallback** (`dsar.ts:18–28`):
```typescript
router.post("/dsar/request", async (_req: Request, res: Response) => {
  res.status(503).json({ error: "...", code: "PHASE_1_STUB" }); return;
});
```

**Auth middleware imports** (`assets.ts:7`):
```typescript
import { requireCreatorAuth } from "../middlewares/require-creator-auth.js";
// other middlewares in this dir: kyc-gate.ts, require-fan-access.ts, verify-conversation-id.ts
```

**Copy notes:**
- Route: `GET /api/voice/:jobId?token=...&exp=...`.
- Token verification via `verifyVoiceUrl` (new `voice-token.ts`) BEFORE DB lookup.
- Look up `generation_jobs` row by `jobDbId`, derive storage key `creators/{creatorId}/generations/{jobId}.ogg`, stream from Object Storage.
- Response headers: `Content-Type: audio/ogg`, `Cache-Control: private, max-age=0`.
- New endpoint MUST be added to `lib/api-spec/openapi.yaml` FIRST then `pnpm --filter @workspace/api-spec run codegen` re-run (CLAUDE.md constraint).

### `artifacts/api-server/src/lib/voice-token.ts` (utility, HMAC sign/verify)

**Analog:** `lib/twin-runtime/src/hmac-conversation.ts`

**Secret loader + sign/verify pattern** (`hmac-conversation.ts:10–55`):
```typescript
import crypto from "crypto";

function getConversationSecret(): string {
  const secret = process.env.HMAC_CONVERSATION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("HMAC_CONVERSATION_SECRET must be set and ≥32 characters. ...");
  }
  return secret;
}

export function signConversationId(id: string): string {
  return crypto.createHmac("sha256", getConversationSecret()).update(id).digest("hex").slice(0, 32);
}

export function verifyConversationId(combined: string): string | null {
  // ... parse "<id>.<sig>" ...
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  return id;
}
```

**Copy notes:** New env var `VOICE_URL_SIGNING_SECRET` (≥32 chars, founder must add to Replit Secrets per RESEARCH "Runtime State Inventory"). Token payload binds `jobId.exp`, NOT raw bytes — match the exact `timingSafeEqual` shape from `hmac-conversation.ts:51–53`. See RESEARCH Pattern 3 lines 447–471 for the full implementation skeleton.

### `artifacts/hermes/src/scenes/dsar.scene.ts` (Wizard scene, event-driven)

**Analog:** `artifacts/hermes/src/scenes/consent.scene.ts` (multi-step WizardScene with state-bound DB write at finish)

**Scene shape: state interface + state accessor** (`consent.scene.ts:15–39`):
```typescript
import { Scenes } from "telegraf";
import { CONSENT_ITEMS, CONSENT_VERSION, commitConsent, ... } from "../consent.js";

export interface ConsentWizardState {
  creatorId: string;
  currentIndex: number;
  answers: ConsentAnswers;
  awaitingPersonaReask?: boolean;
}

type Ctx = Scenes.WizardContext;
function state(ctx: Ctx): ConsentWizardState {
  return ctx.wizard.state as ConsentWizardState;
}
```

**Wizard step + finish pattern** (`consent.scene.ts:54–95`):
```typescript
async function finish(ctx: Ctx): Promise<void> {
  const s = state(ctx);
  try {
    const tgUserId = ctx.from?.id;
    if (!tgUserId) { ...; return; }
    await commitConsent(s.creatorId, s.answers, telegramIpHash(tgUserId));
    await ctx.reply(buildSummary(s.answers));
  } catch (err) { ... } finally { await ctx.scene.leave(); }
}

export const consentWizard = new Scenes.WizardScene<Ctx>(
  "consent-wizard",
  async (ctx) => { ... return ctx.wizard.next(); },
  async (ctx) => { ... }
);
```

**CONFIRM-gate pattern** (RESEARCH Common Operation 2 lines 728–746):
```typescript
async (ctx) => {
  const text = (ctx.message as { text?: string } | undefined)?.text;
  if (text !== "CONFIRM") {
    await ctx.reply("Cancelled. Send /dsar again if you change your mind.");
    return ctx.scene.leave();
  }
  // ... enqueue with delay ...
}
```

**Voice-wizard graceful-degrade pattern** (`voice.scene.ts:43–46, 141–149`) — `dsar.scene.ts` should mirror this when Redis or Object Storage is unavailable:
```typescript
function isMissingBucketError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /REPLIT_OBJECT_STORAGE_BUCKET/.test(err.message);
}
// ...
if (isMissingBucketError(err)) {
  await ctx.reply("... your other onboarding is complete. We'll set this up before launch.");
  return ctx.scene.leave();
}
```

**Copy notes:**
- Per RESEARCH Pitfall 8: BEFORE enqueueing the 24h-delayed deletion job, immediately call `setKillSwitchActive(creatorId, true)` (new query in `db.ts`, modeled on `setPaused` at `db.ts:36–55`).
- Delay: `delay: 24 * 60 * 60 * 1000` in BullMQ job opts.
- Idempotency: pass `jobId: auditId` so re-runs deduplicate (RESEARCH Threat Patterns "DSAR replay").

### `artifacts/hermes/src/scenes/review-masks.scene.ts` (scene + inline keyboard, event-driven)

**Analog:** `artifacts/hermes/src/scenes/consent.scene.ts` (scene shape) + `artifacts/hermes/src/scenes/voice.scene.ts` (single-step + leave-on-done)

**Inline keyboard usage pattern** (RESEARCH Pattern 4 lines 510–520):
```typescript
import { Markup } from "telegraf";

await ctx.reply(
  `Mask candidate:\n\n**Handle:** ${next.handle}\n**Detected name:** ${next.candidate}\n\nApprove this mask?`,
  Markup.inlineKeyboard([
    Markup.button.callback("✅ Approve", `mask:approve:${next.id}`),
    Markup.button.callback("❌ Reject", `mask:reject:${next.id}`),
  ]),
);
```

**Callback handler MUST be registered at bot scope in `index.ts`** (RESEARCH Pattern 4 lines 525–535, registered alongside existing `bot.command(...)` calls — `bot.action(/^mask:(approve|reject):(.+)$/, ...)`):
```typescript
bot.action(/^mask:(approve|reject):(.+)$/, async (ctx) => {
  const [, decision, id] = ctx.match;
  await setMaskReviewed(id, decision === "approve");
  await ctx.answerCbQuery(decision === "approve" ? "Approved" : "Rejected");
  await ctx.editMessageReplyMarkup(undefined);
  await ctx.scene.enter("review-masks-wizard");
});
```

**Copy notes:** Inline keyboard is a NEW pattern in Hermes — no existing analog uses `Markup.inlineKeyboard()`. Pattern is taken verbatim from RESEARCH Pattern 4 and Telegraf v4 docs. UUID regex-validate the callback_data segment before DB lookup (RESEARCH Security V5).

### `artifacts/hermes/src/db.ts` (DB layer, CRUD — additions)

**Analog:** self — append new fns following the same pattern as `findActiveVoiceConsentGrant`, `setPaused`, `getKycRow`.

**Reusable query patterns** (`db.ts:317–333`):
```typescript
export async function findActiveVoiceConsentGrant(creatorId: string): Promise<{ id: string } | null> {
  const rows = await db
    .select({ id: consentGrantsTable.id })
    .from(consentGrantsTable)
    .where(and(
      eq(consentGrantsTable.creatorId, creatorId),
      eq(consentGrantsTable.modality, "voice"),
      eq(consentGrantsTable.granted, true),
      isNull(consentGrantsTable.revokedAt),
    ))
    .limit(1);
  return rows[0] ?? null;
}
```

**SLA-elapsed write pattern** (`db.ts:36–55`):
```typescript
const t0 = Date.now();
await db.update(...).set({ ... }).where(eq(...));
const elapsed = Date.now() - t0;
if (elapsed > 4000) console.error(`[hermes] WARN ...`);
return { elapsed };
```

**Copy notes:** New fns required:
- `getNextPendingMask()` — `SELECT * FROM fan_name_masks WHERE reviewed=false ORDER BY created_at LIMIT 1`
- `setMaskReviewed(id, approved)` — `UPDATE fan_name_masks SET reviewed=true, approved=:approved, reviewed_at=NOW() WHERE id=:id`
- `setKillSwitchActive(creatorId, true)` — `UPDATE creators SET kill_switch_active=true WHERE id=:creatorId` (mirror `setPaused` shape)
- `recordDsarRequest(creatorId)` — insert to `creator_deletion_log`, return `auditId` (sha256 of `${creatorId}.${Date.now()}`).slice(0,16))
- Hermes does NOT import schema tables via `@workspace/db` blanket-import for new tables — extend the existing `import { ... } from "@workspace/db"` block.

### `artifacts/hermes/src/i18n.ts` (i18n strings — extension)

**Analog:** self — extend the `strings` const-record at `i18n.ts:7–115`.

**Pattern** (`i18n.ts:5–122`):
```typescript
export type Lang = 'en' | 'ja' | 'zh-tw';

const strings = {
  en: {
    notLinked: "...",
    twinActive: '▶️ Active',
    // ... existing keys
  },
  ja: { /* same keys, JP values */ },
  'zh-tw': { /* same keys, TW values */ },
} as const satisfies Record<Lang, Record<string, unknown>>;

export type Strings = typeof strings.en;
export function t(lang: string): Strings {
  const l = (lang in strings ? lang : 'en') as Lang;
  return strings[l] as Strings;
}
```

**Locale identifier MISMATCH (Pitfall 6):** Hermes uses lowercase `'zh-tw'`; `twin-runtime` uses BCP-47 `'zh-TW'`. Add `normalizeLocale()` helper in `@workspace/twin-runtime/locale` (see existing analog `lib/twin-runtime/src/locale.ts:23–31` `matchLocaleTag` which already handles both casings). Hermes keeps internal `'zh-tw'`; normalize before crossing into twin-runtime.

**Copy notes:** Add Strings keys for: `/dsar` confirmation, `/dsar` cancelled, `/dsar` countdown ("All data deleted within 24h"), `/review_masks` empty queue, `/review_masks` per-row preamble, mask approve/reject confirmations. Source language for translation: EN; JP+TW translations follow the existing scene labels (e.g., `consent.scene.ts`, voice + persona scenes).

### `lib/db/src/schema/index.ts` (schema, DDL — additions)

**Analog:** self — append after existing tables at `schema/index.ts`.

**Table-definition pattern** (`schema/index.ts:346–376` — `safetyAuditLogTable`):
```typescript
export const safetyAuditLogTable = pgTable(
  "safety_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    creatorId: uuid("creator_id").notNull().references(() => creatorsTable.id),
    fanIdHash: text("fan_id_hash").notNull(),
    sessionId: text("session_id").notNull(),
    messageHash: text("message_hash").notNull(),
    crisisLevel: crisisLevelEnum("crisis_level").notNull(),
    crisisType: text("crisis_type"),
    locale: text("locale").notNull().default("en"),
    confidence: real("confidence"),
    responseSent: boolean("response_sent").notNull().default(false),
    twinPaused: boolean("twin_paused").notNull().default(false),
    alerted: boolean("alerted").notNull().default(false),
    retentionCategory: retentionCategoryEnum("retention_category").notNull().default("audit"),
  },
  (t) => ({
    createdAtIdx: index("safety_audit_log_created_at_idx").on(t.createdAt),
    creatorCreatedIdx: index("safety_audit_log_creator_created_idx").on(t.creatorId, t.createdAt),
  })
);
```

**Drizzle-Zod insert schema + type export pattern** (`schema/index.ts:378–382`):
```typescript
export const insertSafetyAuditLogSchema = createInsertSchema(safetyAuditLogTable).omit({ id: true, createdAt: true });
export type SafetyAuditLog = typeof safetyAuditLogTable.$inferSelect;
export type InsertSafetyAuditLog = z.infer<typeof insertSafetyAuditLogSchema>;
```

**Copy notes:**
- New tables: `fan_name_masks` (id, handle text, candidate text, source text, reviewed bool, approved bool nullable, reviewed_at timestamptz, created_at), `creator_deletion_log` (audit_id text PK, creator_id_hash text, requested_at timestamptz, completed_at timestamptz nullable).
- Column addition: `safety_audit_log.category_scores jsonb` nullable (Pitfall 3).
- `creator_deletion_log.creator_id_hash` is SHA256-hashed — do NOT FK-reference `creators.id` (the row may be anonymized post-deletion).

### `lib/queue/src/{names,types,queues,options}.ts` (queue config — extension)

**Analog:** self — extend the existing 6-queue pattern.

**Pattern in each file:**

`names.ts:1–8`:
```typescript
export const QUEUE_NAMES = {
  textGeneration: "text-generation",
  voiceGeneration: "voice-generation",
  // ... add: dsarDeletion: "dsar-deletion"
} as const;
```

`types.ts:45–52`:
```typescript
export interface ConsentRevocationPayload {
  type: "consent-revocation";
  creatorId: string;
  consentGrantId: string | null;
  modality: string | null;
  killSwitch: boolean;
}
// add: DsarDeletionPayload { type: "dsar-deletion"; creatorId; auditId; requestedAt }
```

`queues.ts:14–42`:
```typescript
export function createAllQueues(redisUrl: string): AllQueues {
  // ...
  consentRevocation: new Queue(QUEUE_NAMES.consentRevocation, {
    connection: conn,
    defaultJobOptions: JOB_OPTIONS.consentRevocation,
  }),
  // add: dsarDeletion: new Queue(QUEUE_NAMES.dsarDeletion, { ... })
}
```

`options.ts:5–44`:
```typescript
consentRevocation: {
  attempts: 5,
  backoff: { type: "exponential", delay: 500 },
  priority: 1,
  removeOnComplete,
  removeOnFail: false,
},
// add: dsarDeletion: { attempts: 3, backoff: { type: "exponential", delay: 60_000 }, removeOnComplete, removeOnFail: false }
```

### `supabase/migrations/20260601000001_phase3_voice_dsar_ocr.sql` (migration, DDL)

**Analog:** `supabase/migrations/20260525000001_safety_audit_log.sql` (table-creation precedent) + `supabase/migrations/20260527000001_creator_preferences.sql` (column-add precedent).

**Pattern:** Filename format `YYYYMMDDHHMMSS_descriptive_name.sql`; applied via `supabase db push` (primary path per CLAUDE.md). Mirror the Drizzle schema add — Supabase migration is source of truth at deploy, Drizzle is dev push.

**Copy notes:** This migration must:
1. `ALTER TABLE safety_audit_log ADD COLUMN category_scores jsonb;` (nullable, no default — back-compat)
2. `CREATE TABLE fan_name_masks (...)`
3. `CREATE TABLE creator_deletion_log (...)`

## Shared Patterns

### Pattern: Workspace import paths

**Source:** `artifacts/worker/src/workers/text-generation.ts:43–54`
**Apply to:** All new files in `lib/twin-runtime/src/` and any artifact consuming them
```typescript
import { runL1Moderation, runL3Moderation } from "@workspace/twin-runtime/moderation";
import { loadHistory, persistTurn } from "@workspace/twin-runtime/conversation";
import { GmiClient } from "@workspace/providers";
import type { ProviderRegistry, TextGenerationPayload } from "@workspace/queue";
import { QUEUE_NAMES } from "@workspace/queue";
import { db, generationJobsTable } from "@workspace/db";
```

Subpath imports avoid pulling the `@workspace/db` barrel at module load (per inline comments at `text-generation.ts:41–42`). Use `@workspace/twin-runtime/<module>` not `@workspace/twin-runtime`.

### Pattern: Hashed fan_id at provider boundary

**Source:** `artifacts/worker/src/workers/text-generation.ts:101–108`
**Apply to:** Voice provider, escalation scorer, anywhere fan_id touches Helicone or external logging
```typescript
function hashFanId(fanId: string): string {
  return createHash("sha256")
    .update(`fan:${fanId}`, "utf8")
    .digest("hex")
    .slice(0, 32);
}
```
COMPLY-03 mandate. Same pattern at `lib/providers/src/providers/gmi-client.ts:31–33` and `lib/twin-runtime/src/safety-audit.ts:28–30`.

### Pattern: Constant-time HMAC verify

**Source:** `lib/twin-runtime/src/hmac-conversation.ts:37–55`
**Apply to:** `artifacts/api-server/src/lib/voice-token.ts`
```typescript
const a = Buffer.from(token);
const b = Buffer.from(expected);
if (a.length !== b.length) return null;
if (!crypto.timingSafeEqual(a, b)) return null;
```

### Pattern: Env-var validation at module load

**Source:** `lib/twin-runtime/src/hmac-conversation.ts:16–25`, `lib/providers/src/providers/gmi-client.ts:46–56`, `artifacts/worker/src/workers/text-generation.ts:74–84` (lazy)
**Apply to:** New `VOICE_URL_SIGNING_SECRET`, opossum config, GMI TTS endpoint env override
- For required-at-startup secrets: throw immediately at first use (clear error message including "set in Replit Secrets").
- For test-tolerant tokens: lazy singleton accessor (e.g., `getFanTwinOut()` pattern).

### Pattern: Graceful-degrade on missing infra

**Source:** `artifacts/hermes/src/scenes/voice.scene.ts:43–46, 141–149`
**Apply to:** All new scenes; DSAR scene when Redis unavailable; voice worker when Object Storage bucket missing
```typescript
function isMissingBucketError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /REPLIT_OBJECT_STORAGE_BUCKET/.test(err.message);
}
// ...
if (isMissingBucketError(err)) {
  await ctx.reply("Voice upload not yet available — ...");
  return ctx.scene.leave();
}
```

### Pattern: Disclosure footer on every outbound

**Source:** `artifacts/worker/src/workers/text-generation.ts:346–352, 487` (`getDisclosureFooter(locale, handle)`)
**Apply to:** Voice deliveries — caption text on the audio message (CONTEXT pre-locked rule)
```typescript
const footer = getDisclosureFooter(locale, handle);
await fanTwinOut.telegram.sendVoice(chatId, { source: buffer }, {
  caption: `${transcript}\n\n— ${footer}`,
  parse_mode: "Markdown",
});
```

### Pattern: BullMQ delayed job + idempotency

**Source:** RESEARCH Common Operation 2 lines 737–741
**Apply to:** DSAR scene
```typescript
await queues.dsarDeletion.add(
  "dsar",
  { creatorId, requestedAt: new Date().toISOString(), auditId },
  { delay: DSAR_DELAY_MS, attempts: 3, backoff: { type: "exponential", delay: 60_000 }, jobId: auditId },
);
```
The `jobId: auditId` provides BullMQ-level deduplication (Threat Pattern "DSAR replay").

### Pattern: Express Router scaffold

**Source:** `artifacts/api-server/src/routes/dsar.ts:12–14`, `artifacts/api-server/src/routes/assets.ts:5–9`
**Apply to:** New `routes/voice.ts`
```typescript
import { Router, type IRouter, type Request, type Response } from "express";
const router: IRouter = Router();
router.get("/voice/:jobId", async (req: Request, res: Response) => { ... });
export default router;
```
Register in `artifacts/api-server/src/index.ts` (existing routes pattern — `app.use("/api", voiceRouter)`).

### Pattern: Drizzle schema test + type derivation

**Source:** `lib/db/src/schema/index.ts:378–382`
**Apply to:** All new tables (`fan_name_masks`, `creator_deletion_log`)
```typescript
export const insertXxxSchema = createInsertSchema(xxxTable).omit({ id: true, createdAt: true });
export type Xxx = typeof xxxTable.$inferSelect;
export type InsertXxx = z.infer<typeof insertXxxSchema>;
```

### Pattern: SLA timing + warn-log

**Source:** `artifacts/hermes/src/db.ts:40–55` (`setPaused`), `artifacts/worker/src/workers/consent-revocation.ts:137–141, 181–185` (60s sweep)
**Apply to:** DSAR worker, voice worker, escalation scorer (anywhere a latency budget exists)
```typescript
const t0 = Date.now();
// ... work ...
const elapsed = Date.now() - t0;
if (elapsed > BUDGET_MS) console.error(`[component] WARN exceeded SLA ${elapsed}ms`);
```

## No Analog Found

Files with no close existing match (planner should rely on RESEARCH.md patterns):

| File | Role | Data Flow | Reason | Planner Reference |
|------|------|-----------|--------|-------------------|
| `artifacts/web/src/components/fan/VoiceMessageBubble.tsx` | React component | request-response (audio playback) | Fan SPA has no audio-bubble component yet; native HTML5 `<audio>` element is straightforward but no project-style guideline established | RESEARCH "Recommended Project Structure" lines 294–296; use existing Radix UI + Tailwind v4 conventions from other fan-page components |
| opossum-wrapped GMI TTS client | external lib integration | request-response | First use of opossum in the repo; no existing CircuitBreaker pattern | RESEARCH Pattern 1 lines 306–358 |

## Metadata

**Analog search scope:**
- `lib/providers/src/providers/` (gmi-client, GmiTextProvider, GmiVoiceProvider, interfaces, registry)
- `lib/twin-runtime/src/` (all 13 modules — moderation, safety-audit, hmac-conversation, conversation, locale, helplines, disclosure, deflections, system-prompt, constitution, notify-founder, logger, provider-types)
- `lib/queue/src/` (names, types, queues, options)
- `lib/db/src/schema/` (index.ts, character-card.ts)
- `artifacts/api-server/src/routes/` (twin, dsar, assets, kyc, consent, persona, plus middlewares dir)
- `artifacts/worker/src/workers/` (text-generation, voice-generation, consent-revocation, dunning-retry, moderation, video-generation, stripe-dunning-adapter)
- `artifacts/hermes/src/` (db, i18n, index, session, scenes/{consent,persona,voice}, lib/{object-storage,constitution-writer}, revoke-voice)
- `supabase/migrations/` (recent additions for filename + table-create style)

**Files scanned:** ~38 source files

**Key analog confidence:**
- **HIGH** — Provider HTTP client (gmi-client.ts → gmi-tts-client.ts), Worker shell (text/consent-revocation → voice-gen body + dsar-deletion), WizardScene (consent.scene.ts → dsar.scene.ts), HMAC sign/verify (hmac-conversation.ts → voice-token.ts), Schema additions (safetyAuditLogTable pattern → fan_name_masks + creator_deletion_log), Queue config extension (all 4 lib/queue files have add-one-row patterns)
- **MEDIUM** — Inline-keyboard review scene (Markup pattern is verbatim from Telegraf docs, no in-repo analog; scene scaffolding from consent.scene.ts is HIGH but the callback_action plumbing in bot.action(/^mask:.../) is greenfield)
- **LOW** — VoiceMessageBubble React component (no audio-bubble precedent in fan SPA)

**Pattern extraction date:** 2026-05-28
