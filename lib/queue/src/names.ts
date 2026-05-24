export const QUEUE_NAMES = {
  textGeneration: "text-generation",
  voiceGeneration: "voice-generation",
  videoGeneration: "video-generation",
  moderation: "moderation",
  consentRevocation: "consent-revocation",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const ALL_QUEUE_NAMES = Object.values(QUEUE_NAMES) as QueueName[];
