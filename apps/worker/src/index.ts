// Async generation worker — stub implementation
// Consumes generation-jobs queue; writes status back to generation_jobs table
import { Worker } from "bullmq";
import { createClient, getSupabaseUrl, getSupabaseServiceKey } from "@7of1/db";
import { QUEUE_NAME } from "@7of1/queue";
import type { GenerationJobPayload } from "@7of1/types";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

function db() {
  return createClient(getSupabaseUrl(), getSupabaseServiceKey());
}

const worker = new Worker<GenerationJobPayload>(
  QUEUE_NAME,
  async (job) => {
    const { jobId, creatorId, jobType, fanId } = job.data;
    console.log(
      `[worker] processing job=${jobId} creator=${creatorId} jobType=${jobType} fan=${fanId}`,
    );

    await db()
      .from("generation_jobs")
      .update({ status: "processing" })
      .eq("id", jobId);

    // TODO: implement per-modality generation dispatch
    // 1. Live-check consent grant is still active (never use cached value)
    // 2. Load creator persona from DB
    // 3. Dispatch to provider adapter (text → GMI, voice → ElevenLabs, video → HeyGen)
    // 4. Write result URL back to generation_jobs
    // 5. Notify fan page via Realtime
    throw new Error(`Not implemented: jobType=${jobType}`);
  },
  {
    connection: { url: REDIS_URL },
    concurrency: 5,
  },
);

worker.on("completed", async (job) => {
  await db()
    .from("generation_jobs")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", job.data.jobId);
  console.log(`[worker] done job=${job.id}`);
});

worker.on("failed", async (job, err) => {
  if (job) {
    await db()
      .from("generation_jobs")
      .update({
        status: "failed",
        error_message: err.message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.data.jobId);
  }
  console.error(`[worker] failed job=${job?.id} error=${err.message}`);
});

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});

console.log(`[worker] started queue=${QUEUE_NAME} redis=${REDIS_URL}`);
