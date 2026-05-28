// Text-generation worker — one job per fan→creator LLM call.
// Lifecycle: queued → processing (bullmq_job_id stamped) → complete | failed.
// Full AI pipeline (persona + RAG + GMI) is wired via ProviderRegistry.text.
//
// Per D-13: worker body is a STUB in Phase 1.
// Phase 2: wire GMI DeepSeek-V3.2 via registry.text.generate().

import { Worker } from "bullmq";
import { db, generationJobsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { ProviderRegistry, TextGenerationPayload } from "@workspace/queue";
import { QUEUE_NAMES } from "@workspace/queue";

const CONCURRENCY = 10;

export function createWorker(
  _registry: ProviderRegistry,
  redisUrl: string,
): Worker<TextGenerationPayload> {
  const worker = new Worker<TextGenerationPayload>(
    QUEUE_NAMES.textGeneration,
    async (job) => {
      const { jobDbId, creatorId, fanId } = job.data;

      // On start: mark processing + store bullmq_job_id
      await db
        .update(generationJobsTable)
        .set({
          status: "processing",
          bullmqJobId: job.id,
          attemptCount: job.attemptsMade + 1,
        })
        .where(eq(generationJobsTable.id, jobDbId));

      console.log(
        `[text-gen] processing job=${jobDbId} creator=${creatorId} fan=${fanId}` +
          ` attempt=${job.attemptsMade + 1}`,
      );

      // STUB: full persona/RAG/GMI pipeline wired in Phase 2.
      console.log(`[text-gen] STUB: text generation body filled in Phase 2`);

      // On complete: mark done
      await db
        .update(generationJobsTable)
        .set({
          status: "complete",
          completedAt: new Date(),
          errorMessage: null,
        })
        .where(eq(generationJobsTable.id, jobDbId));

      console.log(`[text-gen] done (stub) job=${jobDbId}`);
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
    console.error(`[text-gen] failed job=${job.id} attempt=${job.attemptsMade} error=${err.message}`);
  });

  return worker;
}
