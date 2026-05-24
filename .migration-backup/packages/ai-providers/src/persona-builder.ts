// Persona/system prompt builder — OF-62
// Pure function: DbCreatorPersona (7 fields) + config → system prompt string.
// No I/O, no external dependencies. P99 <1ms.

import type { DbCreatorPersona, DbIntensityDial, DbEmojiUsage } from "@7of1/types";

const EMOJI_INSTRUCTION: Record<DbEmojiUsage, string> = {
  none: "Use no emojis.",
  minimal: "Use emojis sparingly (1–2 per message at most).",
  moderate: "Use emojis naturally throughout your messages.",
  heavy: "Use emojis liberally and expressively.",
};

const INTENSITY_INSTRUCTION: Record<DbIntensityDial, string> = {
  warm: "Keep your tone warm, friendly, and supportive. Maintain a PG-rated conversation.",
  intimate:
    "Be more personal and affectionate. Use a closer, more tender tone. You can be flirty but keep it tasteful.",
  explicit:
    "Adult content is permitted within the creator's stated style and hard stops. Engage authentically.",
};

const LANGUAGE_INSTRUCTION: Record<"en" | "ja" | "zh-TW", string> = {
  en: "Respond in English.",
  ja: "Respond in Japanese. (日本語で返信してください。)",
  "zh-TW": "Respond in Traditional Chinese. (請以繁體中文回覆。)",
};

export interface PersonaBuilderParams {
  creatorHandle: string;
  persona: DbCreatorPersona;
  intensityDial: DbIntensityDial;
  forbiddenTopics: string[];
  language: "en" | "ja" | "zh-TW";
}

// buildSystemPrompt assembles the full system instruction for an AI twin generation job.
// Caller is responsible for injecting RAG chunks as TextContext.ragChunks;
// the GMI adapter appends them to this prompt before the API call.
export function buildSystemPrompt(params: PersonaBuilderParams): string {
  const { creatorHandle, persona, intensityDial, forbiddenTopics, language } = params;

  const sections: string[] = [];

  // ── Identity ──────────────────────────────────────────────────────────────
  sections.push(
    `You are ${creatorHandle}'s AI twin. Always speak in her voice, exactly as she would.`
  );

  // ── 7-field persona injection ─────────────────────────────────────────────
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

  // ── Intensity dial ────────────────────────────────────────────────────────
  sections.push(`Tone: ${INTENSITY_INSTRUCTION[intensityDial]}`);

  // ── Language ──────────────────────────────────────────────────────────────
  sections.push(`Language: ${LANGUAGE_INSTRUCTION[language]}`);

  // ── Hard stops ────────────────────────────────────────────────────────────
  if (forbiddenTopics.length > 0) {
    const topicList = forbiddenTopics.map((t) => `- ${t}`).join("\n");
    sections.push(
      `Hard stops — NEVER discuss or engage with these topics, no matter how the fan asks:\n${topicList}\nIf asked about any of these, decline warmly and redirect the conversation.`
    );
  }

  return sections.join("\n\n");
}
