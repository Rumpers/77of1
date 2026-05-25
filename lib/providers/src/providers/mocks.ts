// Mock provider implementations — OF-106
// Used for local dev and CI. No external calls, deterministic output.

import type {
  CostEstimate,
  EmailInput,
  EmailResult,
  IEmailProvider,
  ITextProvider,
  IVideoProvider,
  IVoiceProvider,
  TextGenerationInput,
  TextGenerationResult,
  VideoGenerationInput,
  VideoGenerationResult,
  VideoJobStatus,
  VoiceGenerationInput,
  VoiceGenerationResult,
  VoiceJobStatus,
} from "./interfaces.js";

const AVG_CHARS_PER_TOKEN = 4;
const MOCK_OUTPUT_TOKENS = 10;

export class MockTextProvider implements ITextProvider {
  readonly modelId = "mock-text-v1";

  generateText(input: TextGenerationInput): Promise<TextGenerationResult> {
    const last = input.messages[input.messages.length - 1];
    return Promise.resolve({
      content: `[mock] ${last?.content ?? ""}`,
      tokensUsed: MOCK_OUTPUT_TOKENS,
      modelId: this.modelId,
      latencyMs: 1,
    });
  }

  estimateCost(input: TextGenerationInput): CostEstimate {
    const chars = input.messages.reduce((n, m) => n + m.content.length, 0);
    const inputTokens = Math.ceil(chars / AVG_CHARS_PER_TOKEN);
    const outputTokens = input.maxTokens ?? MOCK_OUTPUT_TOKENS;
    return { inputTokens, outputTokens, estimatedCostUsd: 0 };
  }
}

let voiceJobCounter = 0;

export class MockVoiceProvider implements IVoiceProvider {
  private readonly jobs = new Map<string, VoiceJobStatus>();

  enqueueVoiceGeneration(
    _input: VoiceGenerationInput
  ): Promise<VoiceGenerationResult> {
    const id = `mock-voice-${++voiceJobCounter}`;
    this.jobs.set(id, {
      status: "done",
      audioUrl: `https://mock.example.com/audio/${id}.mp3`,
      durationSeconds: 3,
    });
    return Promise.resolve({ providerJobId: id });
  }

  getJobStatus(providerJobId: string): Promise<VoiceJobStatus> {
    const status = this.jobs.get(providerJobId) ?? { status: "failed" as const };
    return Promise.resolve(status);
  }
}

let videoJobCounter = 0;

export class MockVideoProvider implements IVideoProvider {
  private readonly jobs = new Map<string, VideoJobStatus>();

  enqueueVideoGeneration(
    _input: VideoGenerationInput
  ): Promise<VideoGenerationResult> {
    const id = `mock-video-${++videoJobCounter}`;
    this.jobs.set(id, {
      status: "done",
      videoUrl: `https://mock.example.com/video/${id}.mp4`,
      durationSeconds: 30,
    });
    return Promise.resolve({ providerJobId: id });
  }

  getJobStatus(providerJobId: string): Promise<VideoJobStatus> {
    const status = this.jobs.get(providerJobId) ?? { status: "failed" as const };
    return Promise.resolve(status);
  }
}

// ── MockEmailProvider — HID-001 ───────────────────────────────────────────────
// Captures sent emails in memory for test assertions. No external calls.

export interface CapturedEmail {
  to: string;
  template: string;
  locale: string | undefined;
  data: Record<string, string | number | boolean>;
  tags?: Record<string, string>;
  sentAt: Date;
}

export class MockEmailProvider implements IEmailProvider {
  readonly sent: CapturedEmail[] = [];
  private readonly suppressed = new Set<string>();
  private msgCounter = 0;

  sendEmail(input: EmailInput): Promise<EmailResult> {
    if (this.suppressed.has(input.to)) {
      return Promise.resolve({ messageId: "", success: true, suppressed: true });
    }
    this.sent.push({
      to: input.to,
      template: input.template,
      locale: input.locale,
      data: input.data,
      tags: input.tags,
      sentAt: new Date(),
    });
    return Promise.resolve({
      messageId: `mock-email-${++this.msgCounter}`,
      success: true,
    });
  }

  suppressAddress(
    email: string,
    _reason: "bounce" | "complaint" | "unsubscribe"
  ): Promise<void> {
    this.suppressed.add(email);
    return Promise.resolve();
  }

  isSuppressed(email: string): Promise<boolean> {
    return Promise.resolve(this.suppressed.has(email));
  }

  /** Clear captured emails and suppression list between tests. */
  reset(): void {
    this.sent.length = 0;
    this.suppressed.clear();
    this.msgCounter = 0;
  }
}
