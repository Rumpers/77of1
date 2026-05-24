// Text-generation worker — one job per fan→creator LLM call.
// Lifecycle: queued → processing (bullmq_job_id stamped) → complete | failed.
// Full AI pipeline (persona + RAG + GMI) is wired via ProviderRegistry.text.

import { Worker } from "bullmq";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProviderRegistry, TextGenerationPayload } from "@workspace/queue";
import { QUEUE_NAMES } from "@workspace/queue";

const CONCURRENCY = 10;

export function createWorker(
  registry: ProviderRegistry,
  redisUrl: string,
  supabase: SupabaseClient,
): Worker<TextGenerationPayload> {
  const worker = new Worker<TextGenerationPayload>(
    QUEUE_NAMES.textGeneration,
    async (job) => {
      const { jobDbId, creatorId, fanId, prompt, consentGrantVersion } = job.data;

      // On start: mark processing + store bullmq_job_id
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
        `[text-gen] processing job=${jobDbId} creator=${creatorId} fan=${fanId}` +
          ` attempt=${job.attemptsMade + 1}`,
      );

      if (!registry.text) {
        throw new Error("text provider not registered");
      }

      const result = await registry.text.generate(prompt, {
        creatorId,
        systemPrompt: "",
        ragChunks: [],
      });

      // On complete: store output
      await supabase
        .from("generation_jobs")
        .update({
          status: "complete",
          output: result.text,
          completed_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", jobDbId);

      console.log(
        `[text-gen] done job=${jobDbId} tokens=${result.tokensUsed}` +
          ` model=${result.modelId} latency=${result.latencyMs}ms`,
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
    console.error(`[text-gen] failed job=${job.id} attempt=${job.attemptsMade} error=${err.message}`);
  });

  return worker;
}
