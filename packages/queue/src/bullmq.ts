import type { QueueAdapter, JobPayload, QueueJobCounts } from "./adapter.js";

export const QUEUE_NAME = "generation-jobs";

// Lower number = higher priority (BullMQ convention)
const JOB_PRIORITY: Record<string, number> = {
  text: 1,
  voice: 2,
  video: 3,
};

// Dead-letter config: retry 3× with exponential backoff, then keep in failed state
const JOB_DEFAULT_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 2000 },
  removeOnComplete: { count: 1000, age: 86400 },
  // removeOnFail defaults to false — keep all failed jobs as DLQ
  removeOnFail: false,
} as const;

export function createBullMQAdapter(redisUrl: string): QueueAdapter {
  let queue: InstanceType<typeof import("bullmq").Queue> | undefined;

  async function getQueue() {
    if (!queue) {
      const { Queue } = await import("bullmq");
      queue = new Queue(QUEUE_NAME, {
        connection: { url: redisUrl },
        defaultJobOptions: JOB_DEFAULT_OPTIONS,
      });
    }
    return queue;
  }

  return {
    async enqueue(payload: JobPayload, opts = {}) {
      const q = await getQueue();
      const priority = JOB_PRIORITY[payload.jobType] ?? 10;
      const job = await q.add(payload.jobType, payload, {
        jobId: payload.jobId,
        priority,
        delay: opts.delayMs,
      });
      return job.id ?? payload.jobId;
    },

    async cancelByCreator(creatorId: string) {
      const q = await getQueue();
      const jobs = await q.getJobs(["waiting", "delayed"]);
      const matching = jobs.filter((j) => (j.data as JobPayload | null)?.creatorId === creatorId);
      await Promise.all(matching.map((j) => j.remove()));
      return matching.length;
    },

    async getJobCounts(): Promise<QueueJobCounts> {
      const q = await getQueue();
      const raw = await q.getJobCounts(
        "waiting",
        "active",
        "completed",
        "failed",
        "delayed",
        "paused",
      );
      return raw as unknown as QueueJobCounts;
    },

    async getWorkerCount() {
      const q = await getQueue();
      const workers = await q.getWorkers();
      return workers.length;
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

    async close() {
      if (queue) {
        await queue.close();
        queue = undefined;
      }
    },
  };
}
