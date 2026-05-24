import type { GenerationJobPayload } from "@7of1/types";

export type JobPayload = GenerationJobPayload;

export interface QueueJobCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export interface QueueAdapter {
  enqueue(payload: JobPayload, opts?: { delayMs?: number }): Promise<string>;
  cancelByCreator(creatorId: string): Promise<number>;
  getJobCounts(): Promise<QueueJobCounts>;
  getWorkerCount(): Promise<number>;
  healthCheck(): Promise<boolean>;
  close(): Promise<void>;
}

export type QueueAdapterFactory = (redisUrl: string) => QueueAdapter;
