// Video-generation worker — async talking-video synthesis (expensive, concurrency: 2).
// Lifecycle: queued → processing → complete | failed.
// IVideoProvider is wired via ProviderRegistry.video (HeyGen / GMI).
//
// Per D-13: worker body is a STUB in Phase 1.
// Phase 3: wire video provider once GMI endpoint confirmed.

import { Worker } from "bullmq";
import { db, generationJobsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { ProviderRegistry, VideoGenerationPayload } from "@workspace/queue";
import { QUEUE_NAMES } from "@workspace/queue";

const CONCURRENCY = 2;

export function createWorker(
  _registry: ProviderRegistry,
  redisUrl: string,
): Worker<VideoGenerationPayload> {
  const worker = new Worker<VideoGenerationPayload>(
    QUEUE_NAMES.videoGeneration,
    async (job) => {
      const { jobDbId, creatorId, fanId, avatarId, language } = job.data;

      await db
        .update(generationJobsTable)
        .set({
          status: "processing",
          bullmqJobId: job.id,
          attemptCount: job.attemptsMade + 1,
        })
        .where(eq(generationJobsTable.id, jobDbId));

      console.log(
        `[video-gen] processing job=${jobDbId} creator=${creatorId} fan=${fanId}` +
          ` avatar=${avatarId} lang=${language} attempt=${job.attemptsMade + 1}`,
      );

      // STUB: video provider wired in Phase 3 when GMI XTTS endpoint confirmed.
      console.log(`[video-gen] STUB: video generation body filled in Phase 3`);

      await db
        .update(generationJobsTable)
        .set({
          status: "complete",
          completedAt: new Date(),
          errorMessage: null,
        })
        .where(eq(generationJobsTable.id, jobDbId));

      console.log(`[video-gen] done (stub) job=${jobDbId}`);
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
    console.error(`[video-gen] failed job=${job.id} attempt=${job.attemptsMade} error=${err.message}`);
  });

  return worker;
}
