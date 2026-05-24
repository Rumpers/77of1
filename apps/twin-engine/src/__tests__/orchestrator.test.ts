// TextGenerationOrchestrator integration tests.
// Primary invariant: no unmoderated text reaches the caller.
import { describe, it, expect, vi } from "vitest";
import {
  TextGenerationOrchestrator,
  MODERATION_BLOCKED_RESPONSE,
} from "../orchestrator.js";
import type {
  ITextProvider,
  IModeratorProvider,
  ModerationResult,
  TextContext,
  TextResponse,
} from "@7of1/types";
import type { SupabaseClient } from "@supabase/supabase-js";

function makeTextProvider(text: string, tokensUsed = 42): ITextProvider {
  return {
    modelId: "test-model",
    generate: vi.fn().mockResolvedValue({
      text,
      latencyMs: 100,
      tokensUsed,
      modelId: "test-model",
    } satisfies TextResponse),
  };
}

function makeModerator(result: ModerationResult): IModeratorProvider {
  return { moderate: vi.fn().mockResolvedValue(result) };
}

function makeSupabase(): SupabaseClient {
  return {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  } as unknown as SupabaseClient;
}

const BASE_CTX = {
  jobId: "job-001",
  creatorId: "creator-abc",
  fanId: "fan-xyz",
  prompt: "Hello",
  systemPrompt: "You are a friendly twin.",
  ragChunks: [] as string[],
  language: "en" as const,
  intensityDial: "warm" as const,
};

describe("TextGenerationOrchestrator — zero-bypass invariant", () => {
  it("calls moderator for every response (passing case)", async () => {
    const moderator = makeModerator({ passed: true, flaggedCategories: [], confidence: 0.1 });
    const orch = new TextGenerationOrchestrator(
      makeTextProvider("Hello fan!"),
      moderator,
      makeSupabase()
    );
    const result = await orch.generate(BASE_CTX);
    expect(moderator.moderate).toHaveBeenCalledOnce();
    expect(moderator.moderate).toHaveBeenCalledWith("Hello fan!", "en");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text).toBe("Hello fan!");
  });

  it("calls moderator for every response (blocking case)", async () => {
    const moderator = makeModerator({
      passed: false,
      flaggedCategories: ["harassment"],
      confidence: 0.95,
    });
    const orch = new TextGenerationOrchestrator(
      makeTextProvider("offensive generated content"),
      moderator,
      makeSupabase()
    );
    const result = await orch.generate(BASE_CTX);
    expect(moderator.moderate).toHaveBeenCalledOnce();
    expect(result.ok).toBe(false);
  });

  it("never surfaces raw text when moderation blocks", async () => {
    const generatedText = "this-unique-harmful-text-must-not-reach-fan";
    const orch = new TextGenerationOrchestrator(
      makeTextProvider(generatedText),
      makeModerator({ passed: false, flaggedCategories: ["violence"], confidence: 0.99 }),
      makeSupabase()
    );
    const result = await orch.generate(BASE_CTX);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(generatedText);
  });

  it("returns graceful message when blocked", async () => {
    const orch = new TextGenerationOrchestrator(
      makeTextProvider("harmful"),
      makeModerator({ passed: false, flaggedCategories: ["harassment"], confidence: 0.9 }),
      makeSupabase()
    );
    const result = await orch.generate(BASE_CTX);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("moderation_blocked");
      expect(result.gracefulMessage).toBe(MODERATION_BLOCKED_RESPONSE);
      expect(result.flaggedCategories).toContain("harassment");
    }
  });

  it("writes audit log for passing responses", async () => {
    const supabase = makeSupabase();
    const orch = new TextGenerationOrchestrator(
      makeTextProvider("safe text"),
      makeModerator({ passed: true, flaggedCategories: [], confidence: 0.05 }),
      supabase
    );
    await orch.generate(BASE_CTX);
    await new Promise((r) => setTimeout(r, 20));
    expect(supabase.from).toHaveBeenCalledWith("moderation_audit_log");
  });

  it("writes audit log for blocked responses", async () => {
    const supabase = makeSupabase();
    const orch = new TextGenerationOrchestrator(
      makeTextProvider("harmful"),
      makeModerator({ passed: false, flaggedCategories: ["hate_speech"], confidence: 0.88 }),
      supabase
    );
    await orch.generate(BASE_CTX);
    await new Promise((r) => setTimeout(r, 20));
    expect(supabase.from).toHaveBeenCalledWith("moderation_audit_log");
  });

  it("does not throw when audit log write fails", async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: { message: "DB down" } }),
      }),
    } as unknown as SupabaseClient;
    const orch = new TextGenerationOrchestrator(
      makeTextProvider("harmful"),
      makeModerator({ passed: false, flaggedCategories: ["harassment"], confidence: 0.9 }),
      supabase
    );
    await expect(orch.generate(BASE_CTX)).resolves.toMatchObject({ ok: false });
  });

  it("passes TextContext fields correctly to text provider", async () => {
    const textProvider = makeTextProvider("response");
    const orch = new TextGenerationOrchestrator(
      textProvider,
      makeModerator({ passed: true, flaggedCategories: [], confidence: 0.0 }),
      makeSupabase()
    );
    const ctx = {
      ...BASE_CTX,
      systemPrompt: "Custom system prompt",
      ragChunks: ["chunk1", "chunk2"],
      language: "ja" as const,
      intensityDial: "intimate" as const,
    };
    await orch.generate(ctx);
    expect(textProvider.generate).toHaveBeenCalledWith(
      "Hello",
      expect.objectContaining({
        creatorId: "creator-abc",
        systemPrompt: "Custom system prompt",
        ragChunks: ["chunk1", "chunk2"],
        language: "ja",
        intensityDial: "intimate",
      }) satisfies Partial<TextContext>
    );
  });

  it("returns tokensUsed from text provider on success", async () => {
    const orch = new TextGenerationOrchestrator(
      makeTextProvider("good text", 123),
      makeModerator({ passed: true, flaggedCategories: [], confidence: 0.0 }),
      makeSupabase()
    );
    const result = await orch.generate(BASE_CTX);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.tokensUsed).toBe(123);
  });
});
