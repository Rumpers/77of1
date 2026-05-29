// Provider registry — env-var-driven provider selection (OF-108, OF-109)
// Swapping providers = changing TEXT_PROVIDER / VOICE_PROVIDER / VIDEO_PROVIDER env var.
// No code change required to switch between gmi, elevenlabs, heygen, or mock.

import type {
  ITextProvider,
  IVoiceProvider,
  IVideoProvider,
  IModeratorProvider,
} from "./interfaces.js";
import { GmiTextProvider } from "./gmi/GmiTextProvider.js";
import { GmiVoiceProvider } from "./gmi/GmiVoiceProvider.js";
import { GmiVideoProvider } from "./gmi/GmiVideoProvider.js";
import { ElevenLabsVoiceProvider } from "./external/ElevenLabsVoiceProvider.js";
import { HeyGenVideoProvider } from "./external/HeyGenVideoProvider.js";
import { OpenAiModeratorProvider } from "./openai/OpenAiModeratorProvider.js";
import { MockModeratorProvider } from "./openai/MockModeratorProvider.js";

// ── Mock providers (test environments only) ───────────────────────────────────

class MockTextProvider implements ITextProvider {
  readonly modelId = "mock";

  async generateText(): Promise<{
    content: string;
    tokensUsed: number;
    modelId: string;
    latencyMs: number;
  }> {
    return {
      content: "[mock response]",
      tokensUsed: 10,
      modelId: this.modelId,
      latencyMs: 0,
    };
  }

  estimateCost(): { inputTokens: number; outputTokens: number; estimatedCostUsd: number } {
    return { inputTokens: 5, outputTokens: 5, estimatedCostUsd: 0 };
  }
}

// ── Singleton instances — constructed once to avoid repeated env lookups ──────

let _textProvider: ITextProvider | undefined;
let _voiceProvider: IVoiceProvider | undefined;
let _videoProvider: IVideoProvider | undefined;
let _moderatorProvider: IModeratorProvider | undefined;

export function getTextProvider(): ITextProvider {
  if (_textProvider) return _textProvider;

  const name = process.env["TEXT_PROVIDER"] ?? "gmi";
  switch (name) {
    case "gmi":
      _textProvider = new GmiTextProvider();
      break;
    case "mock":
      _textProvider = new MockTextProvider();
      break;
    default:
      throw new Error(
        `Unknown TEXT_PROVIDER="${name}". Supported values: gmi, mock`
      );
  }

  return _textProvider;
}

// VOICE_PROVIDER=gmi (default) | elevenlabs
export function getVoiceProvider(): IVoiceProvider {
  if (_voiceProvider) return _voiceProvider;

  const name = process.env["VOICE_PROVIDER"] ?? "gmi";
  switch (name) {
    case "gmi":
      _voiceProvider = new GmiVoiceProvider();
      break;
    case "elevenlabs":
      _voiceProvider = new ElevenLabsVoiceProvider();
      break;
    default:
      throw new Error(
        `Unknown VOICE_PROVIDER="${name}". Supported values: gmi, elevenlabs`
      );
  }

  return _voiceProvider;
}

// VIDEO_PROVIDER=gmi (default) | heygen
export function getVideoProvider(): IVideoProvider {
  if (_videoProvider) return _videoProvider;

  const name = process.env["VIDEO_PROVIDER"] ?? "gmi";
  switch (name) {
    case "gmi":
      _videoProvider = new GmiVideoProvider();
      break;
    case "heygen":
      _videoProvider = new HeyGenVideoProvider();
      break;
    default:
      throw new Error(
        `Unknown VIDEO_PROVIDER="${name}". Supported values: gmi, heygen`
      );
  }

  return _videoProvider;
}

// MODERATOR_PROVIDER=openai (default) | mock
// PATTERNS A8: env-driven singleton selection mirroring getTextProvider().
export function getModeratorProvider(): IModeratorProvider {
  if (_moderatorProvider) return _moderatorProvider;

  const name = process.env["MODERATOR_PROVIDER"] ?? "openai";
  switch (name) {
    case "openai":
      _moderatorProvider = new OpenAiModeratorProvider();
      break;
    case "mock":
      _moderatorProvider = new MockModeratorProvider();
      break;
    default:
      throw new Error(
        `Unknown MODERATOR_PROVIDER="${name}". Supported values: openai, mock`,
      );
  }

  return _moderatorProvider;
}

// ── createRegistry — explicit bundle for a named provider set ─────────────────
// Used by tests and workers that need a fully-typed provider set without
// relying on env vars. createRegistry('gmi') is the GMI-first default.

export interface ProviderRegistry {
  text: ITextProvider;
  voice: IVoiceProvider;
  video: IVideoProvider;
}

export function createRegistry(name: "gmi" | "mock"): ProviderRegistry {
  switch (name) {
    case "gmi":
      return {
        text: new GmiTextProvider(),
        voice: new GmiVoiceProvider(),
        video: new GmiVideoProvider(),
      };
    case "mock":
      return {
        text: new MockTextProvider(),
        voice: new GmiVoiceProvider(),
        video: new GmiVideoProvider(),
      };
    default: {
      const _exhaustive: never = name;
      throw new Error(`Unknown registry: ${_exhaustive}`);
    }
  }
}

// Clears all cached provider instances — useful in tests to reset between runs
export function resetProviderRegistry(): void {
  _textProvider = undefined;
  _voiceProvider = undefined;
  _videoProvider = undefined;
  _moderatorProvider = undefined;
}
