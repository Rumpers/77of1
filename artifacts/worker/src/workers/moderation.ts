// Moderation worker — outbound content moderation before delivery.
// Lifecycle: queued → processing → complete | failed.
// IModeratorProvider is wired via ProviderRegistry.moderator.

import { Worker } from "bullmq";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProviderRegistry, ModerationPayload } from "@workspace/queue";
import { QUEUE_NAMES } from "@workspace/queue";

const CONCURRENCY = 10;

export function createWorker(
  registry: ProviderRegistry,
  redisUrl: string,
  supabase: SupabaseClient,
): Worker<ModerationPayload> {
  const worker = new Worker<ModerationPayload>(
    QUEUE_NAMES.moderation,
    async (job) => {
      const { jobDbId, creatorId, fanId, content, language, modality, consentGrantVersion } =
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
        `[moderation] processing job=${jobDbId} creator=${creatorId} fan=${fanId}` +
          ` modality=${modality} lang=${language}`,
      );

      if (!registry.moderator) {
        throw new Error("moderator provider not registered");
      }

      const result = await registry.moderator.moderate(content, language);

      await supabase
        .from("generation_jobs")
        .update({
          status: "complete",
          output: JSON.stringify(result),
          completed_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", jobDbId);

      if (!result.passed) {
        console.warn(
          `[moderation] blocked job=${jobDbId} creator=${creatorId}` +
            ` categories=${result.flaggedCategories.join(",")}`,
        );
      } else {
        console.log(`[moderation] passed job=${jobDbId} confidence=${result.confidence}`);
      }
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
    console.error(`[moderation] failed job=${job.id} attempt=${job.attemptsMade} error=${err.message}`);
  });

  return worker;
}
