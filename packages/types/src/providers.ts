export interface TextContext {
  creatorId: string;
  systemPrompt: string;
  ragChunks: string[];
  intensityDial: "warm" | "intimate" | "explicit";
  language: "en" | "ja" | "zh-TW";
  // OF-62: hard-stop list for post-generation filtering. Sourced from
  // creator_config.forbidden_topics. Optional for backwards compatibility;
  // adapter falls back to prompt-injection-only enforcement when absent.
  forbiddenTopics?: string[];
  // OF-62: fan endearment for graceful decline phrasing when hard-stop
  // retries are exhausted. Sourced from creator_personas.fan_endearment.
  fanEndearment?: string;
}

export interface TextResponse {
  text: string;
  latencyMs: number;
  tokensUsed: number;
  modelId: string;
}

export interface ITextProvider {
  readonly modelId: string;
  generate(prompt: string, context: TextContext): Promise<TextResponse>;
}

export interface VoiceResponse {
  audioUrl: string;
  durationSeconds: number;
  latencyMs: number;
}

export interface IVoiceProvider {
  generate(
    text: string,
    creatorId: string,
    language: "en" | "ja" | "zh-TW"
  ): Promise<VoiceResponse>;
}

export interface VideoResponse {
  videoUrl: string;
  durationSeconds: number;
  latencyMs: number;
}

export interface IVideoProvider {
  generate(
    script: string,
    creatorId: string,
    avatarId: string
  ): Promise<VideoResponse>;
}

// ModerationResult is defined in platform.ts (flaggedCategories field).
// IModeratorProvider returns that canonical type; import consumers from @7of1/types directly.
export interface IModeratorProvider {
  moderate(
    text: string,
    language: "en" | "ja" | "zh-TW"
  ): Promise<import("./platform").ModerationResult>;
}
