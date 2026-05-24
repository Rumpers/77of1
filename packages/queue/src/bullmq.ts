import type { QueueAdapter, JobPayload } from "./adapter.js";
import type { ConsentGrantId, CreatorId } from "@7of1/types";

const QUEUE_NAME = "generation";

export function createBullMQAdapter(redisUrl: string): QueueAdapter {
  let Queue: typeof import("bullmq").Queue | undefined;
  let queue: InstanceType<typeof import("bullmq").Queue> | undefined;

  async function getQueue() {
    if (!queue) {
      const bullmq = await import("bullmq");
      Queue = bullmq.Queue;
      queue = new Queue(QUEUE_NAME, {
        connection: { url: redisUrl },
      });
    }
    return queue;
  }

  return {
    async enqueue(payload: JobPayload, opts = {}) {
      const q = await getQueue();
      const job = await q.add(payload.modality, payload, {
        jobId: payload.jobId,
        delay: opts.delayMs,
        removeOnComplete: { age: 86400 },
        removeOnFail: { age: 86400 * 7 },
      });
      return job.id ?? payload.jobId;
    },

    async cancelByCreator(creatorId: CreatorId) {
      const q = await getQueue();
      const jobs = await q.getJobs(["waiting", "delayed"]);
      const matching = jobs.filter((j) => j.data?.creatorId === creatorId);
      await Promise.all(matching.map((j) => j.remove()));
      return matching.length;
    },

    async cancelByConsentGrant(consentGrantId: ConsentGrantId) {
      const q = await getQueue();
      const jobs = await q.getJobs(["waiting", "delayed"]);
      const matching = jobs.filter((j) => j.data?.consentGrantId === consentGrantId);
      await Promise.all(matching.map((j) => j.remove()));
      return matching.length;
    },

    async healthCheck() {
      try {
        const q = await getQueue();
        await q.getJobCounts();
        return true;
      } catch {
        return false;
      }
    },
  };
}
