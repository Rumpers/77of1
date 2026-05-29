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
  dunningRetry: {
    // Each dunning step is a single attempt — the state machine schedules
    // follow-up jobs manually with explicit delays (72h, 48h, 48h, 72h).
    attempts: 1,
    removeOnComplete,
    removeOnFail: false,
  },
  dsarDeletion: {
    // DSAR deletion is idempotent but slow (full creator sweep); backoff starts
    // at 60s to avoid hammering the DB on transient failures.
    attempts: 3,
    backoff: { type: "exponential", delay: 60_000 },
    priority: 1,
    removeOnComplete,
    removeOnFail: false,
  },
};
