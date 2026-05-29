// Mock moderator — test-only. Always returns flagged=false so unit tests that
// don't exercise moderation can run without an OPENAI_API_KEY or network.
//
// To assert flagged behavior in tests, use `vi.stubGlobal("fetch", ...)` and
// instantiate `OpenAiModeratorProvider` directly with a stub `apiKey` — see
// moderation-l1.test.ts for the pattern.

import type {
  IModeratorProvider,
  ModerationResult,
} from "../interfaces.js";

export class MockModeratorProvider implements IModeratorProvider {
  readonly modelId = "mock";

  async moderate(_text: string): Promise<ModerationResult> {
    return {
      flagged: false,
      categories: [],
      scores: {},
      primaryCategory: null,
    };
  }
}
