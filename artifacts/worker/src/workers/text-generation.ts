// Text-generation worker — one job per fan→creator LLM call.
//
// Lifecycle (PATTERNS B1 — scaffolding preserved):
//   queued → processing (bullmq_job_id stamped) → complete | failed
//
// Phase 2 plan 02-06b fills the pipeline body for `deliveryChannel="telegram"`
// jobs (fan-twin → BullMQ → this worker → Telegram outbound). The pipeline
// mirrors the web-side flow in `artifacts/api-server/src/routes/twin.ts`:
//   1. pause + kill-switch gate
//   2. KYC gate (defense-in-depth — PATTERNS S6)
//   3. L1 moderation (twin-runtime) → if flagged: TWO sendMessage calls
//        (helpline first, deflection second per UI-SPEC) + audit + return
//   4. resolve twin row
//   5. loadHistory(conversationId, 20)
//   6. readConstitution(creatorId) — PERSONA-02 parity with web (D-02-13)
//   7. buildSystemPrompt(card, locale, constitution)
//   8. persist user turn
//   9. getTextProvider().generateText(...)
//   10. L3 moderation on LLM output → replace with deflection if flagged
//   11. persist assistant turn (safe reply only)
//   12. Outbound: fanTwinOut.telegram.sendMessage(chatId, safeReply + "\n\n— " + disclosure)
//
// Outbound Telegraf instance: module-scope singleton constructed WITHOUT
// `.launch()` (Pitfall T-02-06b-07). Pure HTTP client for sendMessage only —
// owning a bot connection here would conflict with the fan-twin artifact's
// webhook on the same token.
//
// jobDbId for fan-twin Telegram jobs is a pseudo-id like `tg-{update_id}` —
// NOT a UUID and NOT present in `generation_jobs`. We detect this prefix and
// skip the `generation_jobs` row update (the table is sized for /api/twin/*
// web-side enqueues, not Telegram dedup-id jobs).

import { Worker } from "bullmq";
import { Telegraf } from "telegraf";
import { db, generationJobsTable, twinsTable, creatorsTable, creatorConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createHash } from "crypto";
import type { ProviderRegistry, TextGenerationPayload } from "@workspace/queue";
import { QUEUE_NAMES } from "@workspace/queue";

// twin-runtime imports — subpath exports avoid pulling the @workspace/db
// barrel at module-load time for unrelated symbols.
import {
  runL1Moderation,
  runL3Moderation,
  writeNonFlaggedScores,
} from "@workspace/twin-runtime/moderation";
import { writeSafetyAuditLog } from "@workspace/twin-runtime/safety-audit";
import { notifyFounderAsync } from "@workspace/twin-runtime/notify-founder";
import { scoreEscalation } from "@workspace/twin-runtime/escalation";
import { loadHistory, persistTurn } from "@workspace/twin-runtime/conversation";
import { buildSystemPrompt } from "@workspace/twin-runtime/system-prompt";
import { readConstitution } from "@workspace/twin-runtime/constitution";
import { getDisclosureFooter } from "@workspace/twin-runtime/disclosure";
import { getHelpline } from "@workspace/twin-runtime/helplines";
import { getDeflection } from "@workspace/twin-runtime/deflections";
import { logger } from "@workspace/twin-runtime/logger";
import type { Locale } from "@workspace/twin-runtime/locale";

// GmiClient lives in @workspace/providers (lib/providers/src/providers/gmi-client.ts).
// We use it inline rather than reaching into api-server's `GmiTextProvider` class.
// Same HTTP endpoint, same Helicone routing, same retry behaviour.
import { GmiClient } from "@workspace/providers";
import { shouldGenerateVoice, enqueueVoiceJob } from "@workspace/twin-runtime/voice";

// NOTE on KYC: api-server's `isKycSigned` (artifacts/api-server/src/lib/kyc.ts)
// is the source of truth. We re-implement the strict `status === "signed"`
// check inline here (PATTERNS S6 — defense-in-depth) rather than depending
// on api-server source from a sibling artifact. Same `creator_kyc` table via
// @workspace/db, identical semantics.

const CONCURRENCY = 10;

// ─── Outbound Telegraf client (NO .launch()) ────────────────────────────────
// Module-scope singleton. Used ONLY for `fanTwinOut.telegram.sendMessage(...)`.
// Lazy-constructed on first use so test environments without
// TELEGRAM_BOT_TOKEN_FAN_TWIN don't throw at module load.
let _fanTwinOut: Telegraf | null = null;
function getFanTwinOut(): Telegraf {
  if (_fanTwinOut) return _fanTwinOut;
  const token = process.env.TELEGRAM_BOT_TOKEN_FAN_TWIN;
  if (!token) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN_FAN_TWIN is not set — required for worker Telegram outbound delivery",
    );
  }
  _fanTwinOut = new Telegraf(token);
  return _fanTwinOut;
}

// ─── KYC gate inline (PATTERNS S6 — defense-in-depth on worker path) ────────
// Re-implements the strict `status === "signed"` check from
// `artifacts/api-server/src/lib/kyc.ts` so the worker doesn't depend on
// api-server source. Imports the same `creator_kyc` table via @workspace/db.
async function kycSignedInline(creatorId: string): Promise<boolean> {
  const { creatorKycTable } = await import("@workspace/db");
  const row = await db
    .select({ status: creatorKycTable.status })
    .from(creatorKycTable)
    .where(eq(creatorKycTable.creatorId, creatorId))
    .limit(1)
    .then((rows: Array<{ status: string }>) => rows[0] ?? null);
  return row?.status === "signed";
}

// ─── Fan-id hashing (same shape as api-server/routes/twin.ts) ───────────────
// We send the hash to GMI / Helicone — never the raw Telegram user id.
function hashFanId(fanId: string): string {
  return createHash("sha256")
    .update(`fan:${fanId}`, "utf8")
    .digest("hex")
    .slice(0, 32);
}

// jobDbId UUID detector — only update `generation_jobs` for real UUID jobs.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function createWorker(
  registry: ProviderRegistry,
  redisUrl: string,
): Worker<TextGenerationPayload> {
  void registry; // not consumed by this worker — text provider is pulled via twin-runtime
  const worker = new Worker<TextGenerationPayload>(
    QUEUE_NAMES.textGeneration,
    async (job) => {
      const payload = job.data;
      const { jobDbId, creatorId, fanId, deliveryChannel } = payload;

      // On start: mark processing + store bullmq_job_id (only for real
      // generation_jobs rows; tg-* pseudo-ids have no row to update).
      if (isUuid(jobDbId)) {
        await db
          .update(generationJobsTable)
          .set({
            status: "processing",
            bullmqJobId: job.id,
            attemptCount: job.attemptsMade + 1,
          })
          .where(eq(generationJobsTable.id, jobDbId));
      }

      logger.info(
        {
          event: "text-gen.start",
          jobDbId,
          creatorId,
          deliveryChannel,
          attempt: job.attemptsMade + 1,
        },
        "[text-gen] start",
      );

      // ── Channel gate ────────────────────────────────────────────────────
      // Phase 2: only `deliveryChannel="telegram"` is async. Web is sync
      // (api-server runs the pipeline inline). Reserve the worker for
      // Telegram-bound jobs only.
      if (deliveryChannel !== "telegram") {
        logger.info(
          { jobDbId, deliveryChannel },
          "[text-gen] non-telegram delivery channel — no-op",
        );
        if (isUuid(jobDbId)) {
          await db
            .update(generationJobsTable)
            .set({ status: "complete", completedAt: new Date(), errorMessage: null })
            .where(eq(generationJobsTable.id, jobDbId));
        }
        return;
      }

      const { telegramChatId, locale, conversationId, handle, prompt } = payload;
      if (!telegramChatId || !handle) {
        logger.error(
          { jobDbId, telegramChatId, handle },
          "[text-gen] telegram payload missing chatId or handle — drop",
        );
        return;
      }

      const fanIdHash = hashFanId(fanId);
      const fanTwinOut = getFanTwinOut();

      // ── 1+2. Gates: kill-switch, pause, KYC ─────────────────────────────
      try {
        const creator = await db
          .select({
            id: creatorsTable.id,
            killSwitchActive: creatorsTable.killSwitchActive,
          })
          .from(creatorsTable)
          .where(eq(creatorsTable.id, creatorId))
          .limit(1)
          .then(
            (r: Array<{ id: string; killSwitchActive: boolean }>) => r[0] ?? null,
          );

        if (!creator || creator.killSwitchActive) {
          await fanTwinOut.telegram.sendMessage(
            telegramChatId,
            getPauseMessage(locale),
          );
          if (isUuid(jobDbId)) await markJobComplete(jobDbId);
          return;
        }

        const cfg = await db
          .select({ paused: creatorConfigTable.paused })
          .from(creatorConfigTable)
          .where(eq(creatorConfigTable.creatorId, creatorId))
          .limit(1)
          .then((r: Array<{ paused: boolean }>) => r[0] ?? null);

        if (cfg?.paused) {
          await fanTwinOut.telegram.sendMessage(
            telegramChatId,
            getPauseMessage(locale),
          );
          if (isUuid(jobDbId)) await markJobComplete(jobDbId);
          return;
        }

        const kycOk = await kycSignedInline(creatorId);
        if (!kycOk) {
          await fanTwinOut.telegram.sendMessage(
            telegramChatId,
            getKycPendingMessage(locale),
          );
          if (isUuid(jobDbId)) await markJobComplete(jobDbId);
          return;
        }

        // ── 3. L1 moderation ───────────────────────────────────────────────
        const l1 = await runL1Moderation({
          text: prompt,
          locale,
          creatorId,
          fanIdHash,
          sessionId: conversationId,
        });
        if (l1.flagged && l1.reply) {
          // L1 flagged — split helpline / deflection into TWO sendMessage
          // calls per UI-SPEC Telegram formatting (COMPLY-02).
          await sendFlaggedReplyToTelegram(
            fanTwinOut,
            telegramChatId,
            l1.reply,
            l1.primaryCategory ?? null,
            locale,
            handle,
          );
          logger.info(
            { jobDbId, creatorId, category: l1.primaryCategory },
            "[text-gen] L1 moderation blocked input — delivered helpline+deflection",
          );
          if (isUuid(jobDbId)) await markJobComplete(jobDbId);
          return;
        }

        // ── MOD-07 Crescendo escalation check ─────────────────────────────
        const l1Scores = l1.categoryScores ?? {};
        writeNonFlaggedScores({
          creatorId,
          fanIdHash,
          sessionId: conversationId,
          messageText: prompt,
          locale,
          categoryScores: l1Scores,
        });

        const escResult = await scoreEscalation({
          creatorId,
          fanIdHash,
          currentTurnCategoryScores: l1Scores,
        });

        if (escResult.flagged) {
          const escCategory = escResult.triggeringCategory ?? "self-harm";
          const escReply = `${getHelpline(locale)}\n\n${getDeflection(locale, escCategory)}`;

          writeSafetyAuditLog({
            creatorId,
            fanId: fanIdHash,
            sessionId: conversationId,
            messageText: prompt,
            crisisLevel: "high",
            crisisType: "escalation_detected",
            locale,
            confidence: escResult.cumulativeScore,
            categoryScores: l1Scores,
            responseSent: true,
            twinPaused: false,
          });

          notifyFounderAsync(
            `*Safety flag* (escalation/MOD-07) creator=${creatorId} session=${conversationId} cumScore=${escResult.cumulativeScore.toFixed(2)} category=${escCategory}`,
          );

          await sendFlaggedReplyToTelegram(
            fanTwinOut,
            telegramChatId,
            escReply,
            escCategory,
            locale,
            handle,
          );

          logger.info(
            {
              jobDbId,
              creatorId,
              cumulativeScore: escResult.cumulativeScore,
              triggeringCategory: escCategory,
            },
            "[text-gen] Crescendo escalation blocked input — delivered helpline+deflection",
          );
          if (isUuid(jobDbId)) await markJobComplete(jobDbId);
          return;
        }

        // ── 4. Resolve twin row ────────────────────────────────────────────
        const twin = await db
          .select({
            id: twinsTable.id,
            characterCard: twinsTable.characterCard,
            voiceReferenceUrl: twinsTable.voiceReferenceUrl,
            direction: twinsTable.direction,
          })
          .from(twinsTable)
          .where(eq(twinsTable.creatorId, creatorId))
          .limit(1)
          .then(
            (r: Array<{ id: string; characterCard: unknown; voiceReferenceUrl: string | null; direction: string | null }>) =>
              r[0] ?? null,
          );

        // ── 5. Load history (CHAT-04) ──────────────────────────────────────
        const history = await loadHistory(conversationId, 20);

        // ── 6. PERSONA-02 constitution read (D-02-13) — parity with web ───
        const constitution = await readConstitution(creatorId);

        // ── 7. Build system prompt ─────────────────────────────────────────
        const card = twin?.characterCard
          ? (twin.characterCard as Parameters<typeof buildSystemPrompt>[0])
          : null;
        const systemPrompt = buildSystemPrompt(card, locale, constitution, null, twin?.direction ?? null);

        // ── 8. Persist user turn (always — audit trail) ────────────────────
        await persistTurn({
          conversationId,
          creatorId,
          twinId: twin?.id ?? null,
          role: "user",
          content: prompt,
        });

        // ── 9. LLM call (GMI DeepSeek-V3.2 via @workspace/providers GmiClient) ─
        // Same HTTP endpoint + Helicone routing as api-server's GmiTextProvider.
        // We call GmiClient directly because GmiTextProvider lives in
        // api-server source and is not exported from any shared workspace lib
        // (D-13 plus 02-06a refactor scope).
        let llmContent: string;
        try {
          llmContent = await gmiChatCompletion({
            systemPrompt,
            messages: [...history, { role: "user" as const, content: prompt }],
            creatorId,
            fanIdHash,
            maxTokens: 512,
          });
        } catch (err) {
          logger.error(
            { jobDbId, creatorId, err: (err as Error).message },
            "[text-gen] LLM provider error — re-throwing for BullMQ retry",
          );
          throw err;
        }

        // ── 10. L3 moderation ──────────────────────────────────────────────
        const l3 = await runL3Moderation({
          text: llmContent,
          locale,
          creatorId,
          fanIdHash,
          sessionId: conversationId,
        });

        const safeReply = l3.flagged && l3.reply ? l3.reply : llmContent;

        // ── 11. Persist assistant turn (safe reply only) ──────────────────
        await persistTurn({
          conversationId,
          creatorId,
          twinId: twin?.id ?? null,
          role: "assistant",
          content: safeReply,
        });

        // ── 11b. Voice job enqueue (VOICE-01 Telegram path) ───────────────
        // Enqueue a voice-generation job AFTER persisting the assistant turn
        // and BEFORE the text outbound. The voice worker sends the audio as
        // a separate bot.telegram.sendAudio message (mp3). Text outbound is
        // NOT blocked by voice — they are independent messages in Telegram UX.
        // Only enqueued on non-flagged turns (L3 flagged paths returned above).
        if (twin && process.env.REDIS_URL && !l3.flagged) {
          try {
            const voiceEligible = await shouldGenerateVoice(creatorId, {
              voiceReferenceUrl: twin.voiceReferenceUrl,
            });
            if (voiceEligible) {
              const { randomUUID } = await import("crypto");
              const voiceJobDbId = randomUUID();
              await enqueueVoiceJob({
                jobDbId: voiceJobDbId,
                creatorId,
                fanIdHash,
                transcript: safeReply,
                locale: (locale as "en" | "ja" | "zh-TW") ?? "en",
                conversationId,
                deliveryChannel: "telegram",
                telegramChatId,
                handle,
                twinId: twin.id,
              });
              logger.info(
                { event: "text-gen.voice_queued", jobDbId, creatorId, voiceJobDbId },
                "[text-gen] voice note queued for Telegram",
              );
            }
          } catch (err) {
            // Swallow — voice failure must never break text delivery (SC1)
            logger.warn(
              { event: "text-gen.voice_enqueue_error", jobDbId, err: (err as Error).message },
              "[text-gen] voice enqueue error (non-fatal — text continues)",
            );
          }
        }

        // ── 12. Outbound delivery ──────────────────────────────────────────
        if (l3.flagged && l3.reply) {
          // L3 flagged — same helpline/deflection split (COMPLY-02 path may
          // fire here too if LLM accidentally produces self-harm-shaped text).
          await sendFlaggedReplyToTelegram(
            fanTwinOut,
            telegramChatId,
            l3.reply,
            l3.primaryCategory ?? null,
            locale,
            handle,
          );
        } else {
          // Normal reply — single sendMessage with disclosure footer (COMPLY-01)
          const footer = getDisclosureFooter(locale, handle);
          await fanTwinOut.telegram.sendMessage(
            telegramChatId,
            `${safeReply}\n\n— ${footer}`,
            { parse_mode: "Markdown" },
          );
        }

        // On complete: mark done (only for real generation_jobs rows)
        if (isUuid(jobDbId)) await markJobComplete(jobDbId);
      } catch (err) {
        logger.error(
          { jobDbId, creatorId, err: (err as Error).message },
          "[text-gen] pipeline error — re-throwing for BullMQ retry",
        );
        throw err;
      }
    },
    { connection: { url: redisUrl }, concurrency: CONCURRENCY },
  );

  worker.on("failed", async (job, err) => {
    if (!job) return;
    const jobDbId = job.data.jobDbId;
    const isFinal = job.attemptsMade >= (job.opts.attempts ?? 1);
    if (isUuid(jobDbId)) {
      if (isFinal) {
        await db
          .update(generationJobsTable)
          .set({
            status: "failed",
            errorMessage: err.message,
            completedAt: new Date(),
          })
          .where(eq(generationJobsTable.id, jobDbId));
      } else {
        await db
          .update(generationJobsTable)
          .set({ attemptCount: job.attemptsMade })
          .where(eq(generationJobsTable.id, jobDbId));
      }
    }
    logger.error(
      {
        event: "text-gen.failed",
        jobId: job.id,
        jobDbId,
        attempt: job.attemptsMade,
        err: err.message,
      },
      "[text-gen] failed",
    );
  });

  return worker;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function markJobComplete(jobDbId: string): Promise<void> {
  await db
    .update(generationJobsTable)
    .set({ status: "complete", completedAt: new Date(), errorMessage: null })
    .where(eq(generationJobsTable.id, jobDbId));
}

// Pause-message locale fallback. Not in twin-runtime today (web returns a
// machine-readable 503 code, not a string). Telegram needs human text.
function getPauseMessage(locale: string): string {
  if (locale === "ja") return "今ちょっとお休み中。またあとで話そうね。";
  if (locale === "zh-TW") return "我現在不在線，請等等再聊。";
  return "I'm taking a short break right now. Check back soon.";
}

function getKycPendingMessage(locale: string): string {
  if (locale === "ja") return "この分身はまだ準備中です。";
  if (locale === "zh-TW") return "這個分身還沒準備好。";
  return "This twin isn't quite ready yet.";
}

// ─── GMI chat completion (inline DeepSeek-V3.2 client) ─────────────────────
// Lazy GmiClient singleton. Build on first call so test envs that never
// reach the worker pipeline body don't need GMI_API_KEY set.
let _gmi: GmiClient | null = null;
function getGmi(): GmiClient {
  if (_gmi) return _gmi;
  _gmi = GmiClient.fromEnv();
  return _gmi;
}

interface GmiChatRequest {
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  creatorId: string;
  fanIdHash: string;
  maxTokens?: number;
}

interface GmiChatCompletionResponse {
  choices: Array<{ message?: { content?: string } }>;
}

async function gmiChatCompletion(req: GmiChatRequest): Promise<string> {
  const model =
    process.env.GMI_TEXT_MODEL ?? "deepseek-ai/DeepSeek-V3.2";
  const resp = await getGmi().post<GmiChatCompletionResponse>({
    path: "/chat/completions",
    body: {
      model,
      temperature: 0.85,
      max_tokens: req.maxTokens ?? 512,
      messages: [
        { role: "system", content: req.systemPrompt },
        ...req.messages,
      ],
    },
    heliconeContext: {
      creatorId: req.creatorId,
      jobType: "text",
      fanId: req.fanIdHash,
    },
  });
  const content = resp.choices[0]?.message?.content;
  if (typeof content !== "string" || content.length === 0) {
    throw new Error("GMI returned empty content");
  }
  return content;
}

// Send a flagged reply across TWO sendMessage calls per UI-SPEC Telegram
// formatting (helpline first, deflection second) when the flag was self-harm.
// For non-self-harm flags, fall through to a single deflection message.
async function sendFlaggedReplyToTelegram(
  out: Telegraf,
  chatId: number,
  composedReply: string,
  primaryCategory: string | null,
  locale: Locale,
  handle: string,
): Promise<void> {
  const footer = getDisclosureFooter(locale, handle);
  const isSelfHarm =
    typeof primaryCategory === "string" &&
    (primaryCategory === "self-harm" || primaryCategory.startsWith("self-harm/"));

  if (isSelfHarm) {
    // Helpline FIRST, deflection SECOND — UI-SPEC mandates separation.
    // composedReply from composeFlaggedReply is `helpline\n\ndeflection`;
    // split and send as two messages.
    const split = composedReply.split("\n\n");
    const helplineText = split[0] ?? getHelpline(locale);
    const deflectionText =
      split.slice(1).join("\n\n") || getDeflection(locale, primaryCategory);
    await out.telegram.sendMessage(chatId, helplineText);
    await out.telegram.sendMessage(
      chatId,
      `${deflectionText}\n\n— ${footer}`,
      { parse_mode: "Markdown" },
    );
    return;
  }

  // Non-self-harm flag — single deflection message with footer.
  await out.telegram.sendMessage(chatId, `${composedReply}\n\n— ${footer}`, {
    parse_mode: "Markdown",
  });
}
