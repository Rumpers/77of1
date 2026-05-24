import type { GenerationRequest, ProviderKind } from "@7of1/types";

export type TextResult = { text: string; tokensUsed: number; provider: ProviderKind };
export type VoiceResult = { audioUrl: string; durationSeconds: number; provider: ProviderKind };
export type VideoResult = { videoUrl: string; durationSeconds: number; provider: ProviderKind };

export interface TextProvider {
  readonly kind: ProviderKind;
  generate(req: GenerationRequest): Promise<TextResult>;
  healthCheck(): Promise<boolean>;
}

export interface VoiceProvider {
  readonly kind: ProviderKind;
  synthesize(req: GenerationRequest, voiceId: string): Promise<VoiceResult>;
  healthCheck(): Promise<boolean>;
}

export interface VideoProvider {
  readonly kind: ProviderKind;
  generate(req: GenerationRequest, avatarId: string): Promise<VideoResult>;
  healthCheck(): Promise<boolean>;
}

export type ProviderConfig = {
  text: { primary: ProviderKind; fallback: ProviderKind };
  voice: { primary: ProviderKind; fallback: ProviderKind };
  video: { primary: ProviderKind; fallback: ProviderKind };
};
