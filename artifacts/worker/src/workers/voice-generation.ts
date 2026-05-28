// Voice-generation worker — async voice note synthesis.
// Lifecycle: queued → processing → complete | failed.
// IVoiceProvider is wired via ProviderRegistry.voice (GMI XTTS).
//
// Per D-13: worker body is a STUB in Phase 1.
// Phase 3: wire GMI XTTS endpoint once URL confirmed with GMI support.

import { Worker } from "bullmq";
import { db, generationJobsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { ProviderRegistry, VoiceGenerationPayload } from "@workspace/queue";
import { QUEUE_NAMES } from "@workspace/queue";

const CONCURRENCY = 5;

export function createWorker(
  _registry: ProviderRegistry,
  redisUrl: string,
): Worker<VoiceGenerationPayload> {
  const worker = new Worker<VoiceGenerationPayload>(
    QUEUE_NAMES.voiceGeneration,
    async (job) => {
      const { jobDbId, creatorId, fanId, language } = job.data;

      await db
        .update(generationJobsTable)
        .set({
          status: "processing",
          bullmqJobId: job.id,
          attemptCount: job.attemptsMade + 1,
        })
        .where(eq(generationJobsTable.id, jobDbId));

      console.log(
        `[voice-gen] processing job=${jobDbId} creator=${creatorId} fan=${fanId}` +
          ` lang=${language} attempt=${job.attemptsMade + 1}`,
      );

      // STUB: GMI XTTS voice provider wired in Phase 3 once endpoint URL confirmed.
      console.log(`[voice-gen] STUB: voice generation body filled in Phase 3`);

      await db
        .update(generationJobsTable)
        .set({
          status: "complete",
          completedAt: new Date(),
          errorMessage: null,
        })
        .where(eq(generationJobsTable.id, jobDbId));

      console.log(`[voice-gen] done (stub) job=${jobDbId}`);
    },
    { connection: { url: redisUrl }, concurrency: CONCURRENCY },
  );

  worker.on("failed", async (job, err) => {
    if (!job) return;
    const isFinal = job.attemptsMade >= (job.opts.attempts ?? 1);
    if (isFinal) {
      await db
        .update(generationJobsTable)
        .set({
          status: "failed",
          errorMessage: err.message,
          completedAt: new Date(),
        })
        .where(eq(generationJobsTable.id, job.data.jobDbId));
    } else {
      await db
        .update(generationJobsTable)
        .set({ attemptCount: job.attemptsMade })
        .where(eq(generationJobsTable.id, job.data.jobDbId));
    }
    console.error(`[voice-gen] failed job=${job.id} attempt=${job.attemptsMade} error=${err.message}`);
  });

  return worker;
}
