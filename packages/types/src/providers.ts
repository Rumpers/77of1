export interface TextContext {
  creatorId: string;
  systemPrompt: string;
  ragChunks: string[];
  intensityDial: "warm" | "intimate" | "explicit";
  language: "en" | "ja" | "zh-TW";
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
