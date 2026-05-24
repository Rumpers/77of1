// TextGenerationOrchestrator — core twin-engine pipeline.
//
// Every text response MUST pass through moderation before leaving this class.
// Invariant: generate → moderate → audit → (pass | block). No bypass path exists.
import type { ITextProvider, IModeratorProvider, TextContext } from "@7of1/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { writeModerationAudit } from "@7of1/ai-providers";

export interface TextGenerationContext {
  jobId: string;
  creatorId: string;
  fanId: string;
  prompt: string;
  systemPrompt: string;
  ragChunks: string[];
  language: "en" | "ja" | "zh-TW";
  intensityDial: "warm" | "intimate" | "explicit";
  forbiddenTopics?: string[];
  fanEndearment?: string;
}

export type TextGenerationOutcome =
  | { ok: true; text: string; tokensUsed: number }
  | {
      ok: false;
      reason: "moderation_blocked";
      flaggedCategories: string[];
      gracefulMessage: string;
    };

// Bilingual graceful message shown to fan when moderation blocks a response.
// Never reveal why a response was blocked.
export const MODERATION_BLOCKED_RESPONSE =
  "このコンテンツは現在ご利用いただけません。/ This content is not available at this time.";

export class TextGenerationOrchestrator {
  constructor(
    private readonly textProvider: ITextProvider,
    private readonly moderator: IModeratorProvider,
    private readonly supabase: SupabaseClient
  ) {}

  async generate(ctx: TextGenerationContext): Promise<TextGenerationOutcome> {
    // Step 1: Generate text via ITextProvider
    const textCtx: TextContext = {
      creatorId: ctx.creatorId,
      systemPrompt: ctx.systemPrompt,
      ragChunks: ctx.ragChunks,
      intensityDial: ctx.intensityDial,
      language: ctx.language,
      forbiddenTopics: ctx.forbiddenTopics,
      fanEndearment: ctx.fanEndearment,
    };
    const textResponse = await this.textProvider.generate(ctx.prompt, textCtx);

    // Step 2: Moderate — mandatory gate; no path bypasses this
    const t0 = Date.now();
    const modResult = await this.moderator.moderate(
      textResponse.text,
      ctx.language
    );
    const latencyMs = Date.now() - t0;

    // Step 3: Write audit log (fire-and-forget; audit failure must not block response)
    void writeModerationAudit(this.supabase, {
      jobId: ctx.jobId,
      creatorId: ctx.creatorId,
      fanId: ctx.fanId,
      language: ctx.language,
      provider: "gmi",
      result: modResult,
      latencyMs,
      text: textResponse.text,
    });

    // Step 4: Gate — blocked content never reaches the caller
    if (!modResult.passed) {
      return {
        ok: false,
        reason: "moderation_blocked",
        flaggedCategories: modResult.flaggedCategories,
        gracefulMessage: MODERATION_BLOCKED_RESPONSE,
      };
    }

    return {
      ok: true,
      text: textResponse.text,
      tokensUsed: textResponse.tokensUsed,
    };
  }
}
