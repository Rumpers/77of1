// Voice-generation worker — async voice note synthesis.
// Lifecycle: queued → processing → complete | failed.
// IVoiceProvider is wired via ProviderRegistry.voice (ElevenLabs / GMI).

import { Worker } from "bullmq";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProviderRegistry, VoiceGenerationPayload } from "@workspace/queue";
import { QUEUE_NAMES } from "@workspace/queue";

const CONCURRENCY = 5;

export function createWorker(
  registry: ProviderRegistry,
  redisUrl: string,
  supabase: SupabaseClient,
): Worker<VoiceGenerationPayload> {
  const worker = new Worker<VoiceGenerationPayload>(
    QUEUE_NAMES.voiceGeneration,
    async (job) => {
      const { jobDbId, creatorId, fanId, transcript, language, consentGrantVersion } = job.data;

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
        `[voice-gen] processing job=${jobDbId} creator=${creatorId} fan=${fanId}` +
          ` lang=${language} attempt=${job.attemptsMade + 1}`,
      );

      if (!registry.voice) {
        throw new Error("voice provider not registered");
      }

      const result = await registry.voice.generate(transcript, creatorId, language);

      await supabase
        .from("generation_jobs")
        .update({
          status: "complete",
          output: result.audioUrl,
          completed_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", jobDbId);

      console.log(
        `[voice-gen] done job=${jobDbId} duration=${result.durationSeconds}s` +
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
    console.error(`[voice-gen] failed job=${job.id} attempt=${job.attemptsMade} error=${err.message}`);
  });

  return worker;
}
