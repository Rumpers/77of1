// Provider registry — OF-106
// Env-var driven: TEXT_PROVIDER=mock → MockTextProvider; =gmi → GmiTextProvider.
// Accepts string shorthand (createRegistry('mock')) or full RegistryConfig object.

import type { ProviderRegistry } from "./interfaces.js";
import {
  MockTextProvider,
  MockVoiceProvider,
  MockVideoProvider,
} from "./mocks.js";

export type ProviderMode = "mock" | "gmi";

export interface RegistryConfig {
  textProvider?: ProviderMode;
  voiceProvider?: ProviderMode;
  videoProvider?: ProviderMode;
}

function resolveMode(
  envVar: string | undefined,
  explicit: ProviderMode | undefined,
  fallback: ProviderMode
): ProviderMode {
  return explicit ?? (envVar as ProviderMode | undefined) ?? fallback;
}

// Accepts string shorthand ('mock') or full RegistryConfig object.
export function createRegistry(
  config: ProviderMode | RegistryConfig = {}
): ProviderRegistry {
  const cfg: RegistryConfig =
    typeof config === "string" ? { textProvider: config, voiceProvider: config, videoProvider: config } : config;

  const textMode = resolveMode(
    process.env["TEXT_PROVIDER"],
    cfg.textProvider,
    "mock"
  );
  const voiceMode = resolveMode(
    process.env["VOICE_PROVIDER"],
    cfg.voiceProvider,
    "mock"
  );
  const videoMode = resolveMode(
    process.env["VIDEO_PROVIDER"],
    cfg.videoProvider,
    "mock"
  );

  return {
    text: buildTextProvider(textMode),
    voice: buildVoiceProvider(voiceMode),
    video: buildVideoProvider(videoMode),
  };
}

function buildTextProvider(mode: ProviderMode) {
  switch (mode) {
    case "mock":
      return new MockTextProvider();
    case "gmi":
      // GmiTextProvider lives in artifacts/api-server/src/providers/gmi/.
      // Import it there; this shared registry uses mock as the default.
      throw new Error(
        "GmiTextProvider is app-local — import directly from artifacts/api-server"
      );
  }
}

function buildVoiceProvider(mode: ProviderMode) {
  switch (mode) {
    case "mock":
      return new MockVoiceProvider();
    case "gmi":
      throw new Error("GmiVoiceProvider not yet implemented — set VOICE_PROVIDER=mock");
  }
}

function buildVideoProvider(mode: ProviderMode) {
  switch (mode) {
    case "mock":
      return new MockVideoProvider();
    case "gmi":
      throw new Error("GmiVideoProvider not yet implemented — set VIDEO_PROVIDER=mock");
  }
}
