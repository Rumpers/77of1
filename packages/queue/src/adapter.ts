import type { ConsentGrantId, CreatorId, GenerationJob } from "@7of1/types";

export type JobPayload = {
  jobId: string;
  creatorId: CreatorId;
  consentGrantId: ConsentGrantId;
  modality: "text" | "voice" | "video" | "image";
  fanSessionId: string;
  prompt: string;
};

export interface QueueAdapter {
  enqueue(payload: JobPayload, opts?: { delayMs?: number }): Promise<string>;
  cancelByCreator(creatorId: CreatorId): Promise<number>;
  cancelByConsentGrant(consentGrantId: ConsentGrantId): Promise<number>;
  healthCheck(): Promise<boolean>;
}

export type QueueAdapterFactory = (redisUrl: string) => QueueAdapter;
