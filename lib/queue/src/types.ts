// Job payload shapes — all jobs include creator_id, fan_id, and jobDbId for tracing.

export interface JobPayloadBase {
  jobDbId: string;
  creatorId: string;
  fanId: string;
  consentGrantVersion: string;
}

export interface TextGenerationPayload extends JobPayloadBase {
  type: "text-generation";
  prompt: string;
}

export interface VoiceGenerationPayload extends JobPayloadBase {
  type: "voice-generation";
  transcript: string;
  language: "en" | "ja" | "zh-TW";
}

export interface VideoGenerationPayload extends JobPayloadBase {
  type: "video-generation";
  script: string;
  avatarId: string;
  language: "en" | "ja" | "zh-TW";
}

export interface ModerationPayload extends JobPayloadBase {
  type: "moderation";
  content: string;
  language: "en" | "ja" | "zh-TW";
  modality: "text" | "voice" | "video";
}

export interface ConsentRevocationPayload {
  type: "consent-revocation";
  creatorId: string;
  // null = kill-switch (all grants/modalities for the creator)
  consentGrantId: string | null;
  modality: string | null;
  killSwitch: boolean;
}

// Dunning retry ladder — one job per retry step.
// attempt=0: first charge failure → grace; attempt=1–3: subsequent retries.
// attempt=4: enqueued by attempt=3 on failure → transition to cancelled.
export interface DunningRetryPayload {
  type: "dunning-retry";
  subscriptionId: string;
  fanId: string;
  creatorId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  attempt: number;
}

export type TextGenerationContext = {
  creatorId: string;
  systemPrompt: string;
  ragChunks: string[];
};

export type TextGenerationResult = {
  text: string;
  tokensUsed: number;
  modelId: string;
  latencyMs: number;
};

export type VoiceGenerationResult = {
  audioUrl: string;
  durationSeconds: number;
  latencyMs: number;
};

export type VideoGenerationResult = {
  videoUrl: string;
  durationSeconds: number;
  latencyMs: number;
};

export type ModerationCheckResult = {
  passed: boolean;
  flaggedCategories: string[];
  confidence: number;
};

// ProviderRegistry groups all AI provider adapters injected into workers.
// Workers receive this registry via createWorker() and call the appropriate
// provider for each job type — no direct provider imports inside workers.
export interface ProviderRegistry {
  text?: {
    generate(
      prompt: string,
      context: TextGenerationContext,
    ): Promise<TextGenerationResult>;
  };
  voice?: {
    generate(
      text: string,
      creatorId: string,
      language: "en" | "ja" | "zh-TW",
    ): Promise<VoiceGenerationResult>;
  };
  video?: {
    generate(
      script: string,
      creatorId: string,
      avatarId: string,
    ): Promise<VideoGenerationResult>;
  };
  moderator?: {
    moderate(
      text: string,
      language: "en" | "ja" | "zh-TW",
    ): Promise<ModerationCheckResult>;
  };
}
