// Builds the system prompt for shareable content generation.
// Assembles persona foundation inline (avoids circular ESM dep on @7of1/ai-providers)
// then appends surface instruction and variation directive.
// Two creators always get different system prompts: persona fields differ + variation differs.

import type { DbCreatorPersona, DbIntensityDial, DbEmojiUsage } from "@7of1/types";
import type { VariationParams } from "./variation.js";

export type ShareableSurface = "social" | "fan_page";

export interface ShareablePersonaParams {
  creatorHandle: string;
  persona: DbCreatorPersona;
  intensityDial: DbIntensityDial;
  forbiddenTopics: string[];
  language: "en" | "ja" | "zh-TW";
}

const SURFACE_INSTRUCTION: Record<ShareableSurface, string> = {
  social:
    "You are writing a SHORT shareable social post (IG/TikTok caption style). " +
    "Keep the final output to NO MORE THAN 280 characters of body text — excluding any hashtags. " +
    "Hook readers in the first line. Make it instantly shareable.",
  fan_page:
    "You are writing a fan page teaser/free sample of 300–500 words. " +
    "Pull readers into your world, give real value, and leave them wanting more. " +
    "This is a longer, richer piece — not a social post.",
};

const EMOJI_INSTRUCTION: Record<DbEmojiUsage, string> = {
  none: "Use no emojis.",
  minimal: "Use emojis sparingly (1–2 per message at most).",
  moderate: "Use emojis naturally throughout your messages.",
  heavy: "Use emojis liberally and expressively.",
};

const INTENSITY_INSTRUCTION: Record<DbIntensityDial, string> = {
  warm: "Keep your tone warm, friendly, and supportive.",
  intimate: "Be more personal and affectionate. You can be flirty but keep it tasteful.",
  explicit: "Adult content is permitted within the creator's stated style and hard stops.",
};

function buildPersonaSection(p: ShareablePersonaParams): string {
  const { creatorHandle, persona, intensityDial, forbiddenTopics, language } = p;
  const sections: string[] = [];
  sections.push(
    `You are ${creatorHandle}'s AI twin. Write in her voice, exactly as she would.`
  );
  sections.push(
    [
      `Greeting style: ${persona.greeting_style}`,
      `You refer to fans as: ${persona.fan_endearment}`,
      EMOJI_INSTRUCTION[persona.emoji_usage],
      `How you treat fans: ${persona.treatment_style}`,
      persona.personality_traits.length > 0
        ? `Your personality: ${persona.personality_traits.join(", ")}.`
        : null,
      `Message style: ${persona.message_style}`,
    ]
      .filter(Boolean)
      .join("\n")
  );
  sections.push(`Tone: ${INTENSITY_INSTRUCTION[intensityDial]}`);
  sections.push(`Language: ${language === "en" ? "English" : language === "ja" ? "Japanese" : "Traditional Chinese"}`);
  if (forbiddenTopics.length > 0) {
    sections.push(
      `Hard stops — NEVER mention: ${forbiddenTopics.join(", ")}.`
    );
  }
  return sections.join("\n\n");
}

export function buildShareableSystemPrompt(
  personaParams: ShareablePersonaParams,
  surface: ShareableSurface,
  variation: VariationParams
): string {
  const persona = buildPersonaSection(personaParams);
  return [
    persona,
    `\n\nContent type: ${SURFACE_INSTRUCTION[surface]}`,
    `\nStyle directive for this piece: ${variation.styleDirective}`,
  ].join("");
}

export function buildUserPrompt(skeleton: string, topic: string): string {
  return skeleton.replace(/\{topic\}/g, topic);
}
