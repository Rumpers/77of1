// Character Card V2 Zod schema — SillyTavern-standard persona spec (PERSONA-01).
// Source: github.com/malfoyslastname/character-card-spec-v2/blob/main/spec_v2.md
//
// Stored in twins.character_card JSONB (per D-02-03). Validated at the persona-wizard
// write path (plan 02-07) AND consumed by buildSystemPrompt (plan 02-02 system-prompt.ts).
//
// Per RESEARCH Pattern 1 — required fields: name, description, personality, scenario,
// first_mes, mes_example. Optional: creator_notes, system_prompt, post_history_instructions,
// alternate_greetings, tags, creator, character_version.
import { z } from "zod/v4";

export const characterCardV2Schema = z.object({
  spec: z.literal("chara_card_v2"),
  spec_version: z.literal("2.0"),
  data: z.object({
    name: z.string().min(1).max(64),
    description: z.string().max(4000),
    personality: z.string().max(2000),
    scenario: z.string().max(2000),
    first_mes: z.string().min(1).max(2000),
    mes_example: z.string().max(4000),
    creator_notes: z.string().optional(),
    system_prompt: z.string().optional(),
    post_history_instructions: z.string().max(2000).optional(),
    alternate_greetings: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    creator: z.string().optional(),
    character_version: z.string().optional(),
  }),
});

export type CharacterCardV2 = z.infer<typeof characterCardV2Schema>;
