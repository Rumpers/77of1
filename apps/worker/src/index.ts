// Async generation worker
// Async-by-default lens: voice/video/image generation is always queued, never blocking
import { Worker } from "bullmq";
import type { JobPayload } from "@7of1/queue";

const QUEUE_NAME = "generation";
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

const worker = new Worker<JobPayload>(
  QUEUE_NAME,
  async (job) => {
    const { jobId, creatorId, modality, fanSessionId } = job.data;
    console.log(`[worker] processing job=${jobId} creator=${creatorId} modality=${modality} fan=${fanSessionId}`);

    // TODO: implement per-modality generation
    // 1. Check consent grant is still active (live-check, not cached)
    // 2. Load creator persona from DB
    // 3. Dispatch to provider adapter (GMI first, then fallback)
    // 4. Write result URL back to generation_jobs table
    // 5. Notify via Supabase Realtime so fan page updates
    throw new Error(`Not implemented: modality=${modality}`);
  },
  {
    connection: { url: REDIS_URL },
    concurrency: 5,
  }
);

worker.on("completed", (job) => {
  console.log(`[worker] done job=${job.id}`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] failed job=${job?.id} error=${err.message}`);
});

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});

console.log(`[worker] started queue=${QUEUE_NAME} redis=${REDIS_URL}`);
