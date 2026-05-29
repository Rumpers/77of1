// Moderation worker — outbound content moderation before delivery.
// Lifecycle: queued → processing → complete | failed.
// IModeratorProvider is wired via ProviderRegistry.moderator.
//
// Per D-13: worker body is a STUB in Phase 1.
// Phase 2: wire OpenAI omni-moderation-latest via registry.moderator.

import { Worker } from "bullmq";
import { db, generationJobsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { ProviderRegistry, ModerationPayload } from "@workspace/queue";
import { QUEUE_NAMES } from "@workspace/queue";

const CONCURRENCY = 10;

export function createWorker(
  _registry: ProviderRegistry,
  redisUrl: string,
): Worker<ModerationPayload> {
  const worker = new Worker<ModerationPayload>(
    QUEUE_NAMES.moderation,
    async (job) => {
      const { jobDbId, creatorId, fanId, modality } = job.data;

      await db
        .update(generationJobsTable)
        .set({
          status: "processing",
          bullmqJobId: job.id,
          attemptCount: job.attemptsMade + 1,
        })
        .where(eq(generationJobsTable.id, jobDbId));

      console.log(
        `[moderation] processing job=${jobDbId} creator=${creatorId} fan=${fanId}` +
          ` modality=${modality}`,
      );

      // STUB: OpenAI moderation pipeline wired in Phase 2 (L1/L3 layers per CLAUDE.md).
      console.log(`[moderation] STUB: moderation body filled in Phase 2`);

      await db
        .update(generationJobsTable)
        .set({
          status: "complete",
          completedAt: new Date(),
          errorMessage: null,
        })
        .where(eq(generationJobsTable.id, jobDbId));

      console.log(`[moderation] done (stub) job=${jobDbId}`);
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
    console.error(`[moderation] failed job=${job.id} attempt=${job.attemptsMade} error=${err.message}`);
  });

  return worker;
}
