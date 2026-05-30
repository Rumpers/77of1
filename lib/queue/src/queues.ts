import { Queue } from "bullmq";
import { QUEUE_NAMES } from "./names.js";
import { JOB_OPTIONS } from "./options.js";

export interface AllQueues {
  textGeneration: Queue;
  voiceGeneration: Queue;
  videoGeneration: Queue;
  moderation: Queue;
  consentRevocation: Queue;
  dunningRetry: Queue;
  dsarDeletion: Queue;
  evalRegression: Queue;
}

export function createAllQueues(redisUrl: string): AllQueues {
  const conn = { url: redisUrl };
  return {
    textGeneration: new Queue(QUEUE_NAMES.textGeneration, {
      connection: conn,
      defaultJobOptions: JOB_OPTIONS.textGeneration,
    }),
    voiceGeneration: new Queue(QUEUE_NAMES.voiceGeneration, {
      connection: conn,
      defaultJobOptions: JOB_OPTIONS.voiceGeneration,
    }),
    videoGeneration: new Queue(QUEUE_NAMES.videoGeneration, {
      connection: conn,
      defaultJobOptions: JOB_OPTIONS.videoGeneration,
    }),
    moderation: new Queue(QUEUE_NAMES.moderation, {
      connection: conn,
      defaultJobOptions: JOB_OPTIONS.moderation,
    }),
    consentRevocation: new Queue(QUEUE_NAMES.consentRevocation, {
      connection: conn,
      defaultJobOptions: JOB_OPTIONS.consentRevocation,
    }),
    dunningRetry: new Queue(QUEUE_NAMES.dunningRetry, {
      connection: conn,
      defaultJobOptions: JOB_OPTIONS.dunningRetry,
    }),
    dsarDeletion: new Queue(QUEUE_NAMES.dsarDeletion, {
      connection: conn,
      defaultJobOptions: JOB_OPTIONS.dsarDeletion,
    }),
    evalRegression: new Queue(QUEUE_NAMES.evalRegression, {
      connection: conn,
      defaultJobOptions: JOB_OPTIONS.evalRegression,
    }),
  };
}

export async function closeAllQueues(queues: AllQueues): Promise<void> {
  await Promise.all(Object.values(queues).map((q) => q.close()));
}
