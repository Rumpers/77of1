import type { JobsOptions } from "bullmq";

const removeOnComplete = { count: 1000, age: 86400 } as const;

export const JOB_OPTIONS: Record<string, JobsOptions> = {
  textGeneration: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete,
    removeOnFail: false,
  },
  voiceGeneration: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete,
    removeOnFail: false,
  },
  videoGeneration: {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 500, age: 86400 },
    removeOnFail: false,
  },
  moderation: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete,
    removeOnFail: false,
  },
  consentRevocation: {
    attempts: 5,
    backoff: { type: "exponential", delay: 500 },
    priority: 1,
    removeOnComplete,
    removeOnFail: false,
  },
};
