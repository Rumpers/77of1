// Video-generation worker — async talking-video synthesis (expensive, concurrency: 2).
// Lifecycle: queued → processing → complete | failed.
// IVideoProvider is wired via ProviderRegistry.video (HeyGen / GMI).

import { Worker } from "bullmq";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProviderRegistry, VideoGenerationPayload } from "@workspace/queue";
import { QUEUE_NAMES } from "@workspace/queue";

const CONCURRENCY = 2;

export function createWorker(
  registry: ProviderRegistry,
  redisUrl: string,
  supabase: SupabaseClient,
): Worker<VideoGenerationPayload> {
  const worker = new Worker<VideoGenerationPayload>(
    QUEUE_NAMES.videoGeneration,
    async (job) => {
      const { jobDbId, creatorId, fanId, script, avatarId, language, consentGrantVersion } =
        job.data;

      await supabase
        .from("generation_jobs")
        .update({
          status: "processing",
          bullmq_job_id: job.id,
          attempt_count: job.attemptsMade + 1,
          consent_grant_version: consentGrantVersion,
        })
        .eq("id", jobDbId);

      console.log(
        `[video-gen] processing job=${jobDbId} creator=${creatorId} fan=${fanId}` +
          ` avatar=${avatarId} lang=${language} attempt=${job.attemptsMade + 1}`,
      );

      if (!registry.video) {
        throw new Error("video provider not registered");
      }

      const result = await registry.video.generate(script, creatorId, avatarId);

      await supabase
        .from("generation_jobs")
        .update({
          status: "complete",
          output: result.videoUrl,
          completed_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", jobDbId);

      console.log(
        `[video-gen] done job=${jobDbId} duration=${result.durationSeconds}s` +
          ` latency=${result.latencyMs}ms`,
      );
    },
    { connection: { url: redisUrl }, concurrency: CONCURRENCY },
  );

  worker.on("failed", async (job, err) => {
    if (!job) return;
    const isFinal = job.attemptsMade >= (job.opts.attempts ?? 1);
    if (isFinal) {
      await supabase
        .from("generation_jobs")
        .update({
          status: "failed",
          error_message: err.message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.data.jobDbId);
    } else {
      await supabase
        .from("generation_jobs")
        .update({ attempt_count: job.attemptsMade })
        .eq("id", job.data.jobDbId);
    }
    console.error(`[video-gen] failed job=${job.id} attempt=${job.attemptsMade} error=${err.message}`);
  });

  return worker;
}
