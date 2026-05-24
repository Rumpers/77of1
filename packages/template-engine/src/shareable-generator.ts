// ShareableContentGenerator — template-driven shareable content from creator corpus.
//
// Dual purpose: social acquisition (IG/TikTok clips, quotes) and fan page free samples.
// Variation layer guarantees two creators using the same template skeleton produce
// visually and textually distinct outputs (acceptance criteria OF-79).

import type { ITextProvider, TextContext, DbCreatorPersona } from "@7of1/types";
import type { RagDbClient, EmbedProvider } from "./rag.js";
import { retrieveRagChunks } from "./rag.js";
import { computeVariationParams } from "./variation.js";
import type { ShareableSurface, ShareablePersonaParams } from "./shareable-prompt.js";
import { buildShareableSystemPrompt, buildUserPrompt } from "./shareable-prompt.js";
import { formatForSurface } from "./formatter.js";

export interface ShareableTemplate {
  id: string;
  name: string;
  skeleton: string;
  surfaces: ShareableSurface[];
}

export interface ShareableCreatorContext {
  creatorId: string;
  handle: string;
  persona: DbCreatorPersona;
  forbiddenTopics: string[];
  language: "en" | "ja" | "zh-TW";
}

export interface ShareableContent {
  creatorId: string;
  templateId: string;
  surface: ShareableSurface;
  text: string;
  hashtags?: string[];
  tokensUsed: number;
  variationSeed: number;
  generatedAt: string;
}

export class ShareableContentGenerator {
  constructor(
    private readonly text: ITextProvider,
    private readonly embedding: EmbedProvider,
    private readonly db: RagDbClient
  ) {}

  async generate(
    creator: ShareableCreatorContext,
    template: ShareableTemplate,
    surface: ShareableSurface,
    topic: string
  ): Promise<ShareableContent> {
    if (!template.surfaces.includes(surface)) {
      throw new Error(
        `Template "${template.id}" does not support surface "${surface}"`
      );
    }

    const [ragChunks, variation] = await Promise.all([
      retrieveRagChunks(this.db, this.embedding, creator.creatorId, topic),
      Promise.resolve(computeVariationParams(creator.creatorId, template.id)),
    ]);

    const personaParams: ShareablePersonaParams = {
      creatorHandle: creator.handle,
      persona: creator.persona,
      intensityDial: creator.persona.intensity_dial,
      forbiddenTopics: creator.forbiddenTopics,
      language: creator.language,
    };

    const systemPrompt = buildShareableSystemPrompt(personaParams, surface, variation);
    const userPrompt = buildUserPrompt(template.skeleton, topic);

    const ctx: TextContext = {
      creatorId: creator.creatorId,
      systemPrompt,
      ragChunks,
      intensityDial: creator.persona.intensity_dial as TextContext["intensityDial"],
      language: creator.language,
      forbiddenTopics: creator.forbiddenTopics,
    };

    const response = await this.text.generate(userPrompt, ctx);
    const { text, hashtags } = formatForSurface(
      response.text,
      surface,
      creator.creatorId,
      topic
    );

    return {
      creatorId: creator.creatorId,
      templateId: template.id,
      surface,
      text,
      hashtags,
      tokensUsed: response.tokensUsed,
      variationSeed: variation.seed,
      generatedAt: new Date().toISOString(),
    };
  }
}
