// Provider adapter interfaces — shared contracts between Platform (infrastructure)
// and AI Engineer (implementations). Swapping providers = changing an env var.
// Owned by: Platform Engineer (OF-106 / OF-108)

export interface TextMessage {
  role: "user" | "assistant";
  content: string;
}

export interface TextGenerationInput {
  creatorId: string;
  fanId: string;
  messages: TextMessage[];
  systemPrompt: string;
  ragContext?: string;
  maxTokens?: number;
}

export interface TextGenerationResult {
  content: string;
  tokensUsed: number;
  modelId: string;
  latencyMs: number;
}

export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export interface ITextProvider {
  readonly modelId: string;
  generateText(input: TextGenerationInput): Promise<TextGenerationResult>;
  estimateCost(input: TextGenerationInput): CostEstimate;
}

export interface VoiceGenerationInput {
  creatorId: string;
  text: string;
  voiceModelId: string;
  languageCode: "en" | "ja" | "zh-TW";
}

export interface VoiceGenerationResult {
  providerJobId: string;
}

export interface VoiceJobStatus {
  status: "pending" | "processing" | "done" | "failed";
  audioUrl?: string;
  durationSeconds?: number;
}

export interface IVoiceProvider {
  enqueueVoiceGeneration(
    input: VoiceGenerationInput
  ): Promise<VoiceGenerationResult>;
  getJobStatus(providerJobId: string): Promise<VoiceJobStatus>;
}

export interface VideoGenerationInput {
  creatorId: string;
  script: string;
  avatarId: string;
  languageCode: "en" | "ja" | "zh-TW";
}

export interface VideoGenerationResult {
  providerJobId: string;
}

export interface VideoJobStatus {
  status: "pending" | "processing" | "done" | "failed";
  videoUrl?: string;
  durationSeconds?: number;
}

export interface IVideoProvider {
  enqueueVideoGeneration(
    input: VideoGenerationInput
  ): Promise<VideoGenerationResult>;
  getJobStatus(providerJobId: string): Promise<VideoJobStatus>;
}

// ── Moderation provider (Phase 2 — OpenAI omni-moderation-latest) ────────────
// Per PATTERNS A7: text-input moderation surface used for L1 (fan input) and
// L3 (LLM output) safety checks in routes/twin.ts. OpenAI is the only provider
// allowed for LLM-adjacent moderation per CLAUDE.md mandate — GMI does text
// generation; OpenAI does moderation only.

export interface ModerationResult {
  flagged: boolean;
  categories: string[];           // category names whose `categories[<name>]` is true
  scores: Record<string, number>; // raw OpenAI category_scores map
  primaryCategory: string | null; // highest-scoring flagged category, or null
}

export interface IModeratorProvider {
  readonly modelId: string;
  moderate(text: string): Promise<ModerationResult>;
}

// Non-retryable — 4xx from provider (bad request, invalid model, auth failure)
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly provider?: string
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

// Retryable — 5xx from provider (server error, rate limit, temporary outage)
// BullMQ workers should treat this as a signal to retry with backoff.
export class ProviderTransientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly provider?: string
  ) {
    super(message);
    this.name = "ProviderTransientError";
  }
}
