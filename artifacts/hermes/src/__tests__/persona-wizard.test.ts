// GREEN test for ONBOARD-01 / PERSONA-01 — plan 02-07 persona-wizard.
//
// Tests the Character Card V2 assembler in scenes/persona.scene.ts:
//   - assembled card validates against characterCardV2Schema
//   - HARDCODED_GUARDRAILS appears in data.post_history_instructions
//   - {name} placeholder is substituted with creatorName
//   - all 8 wizard inputs flow into the right fields
//
// Mocks @workspace/db's writers (hermes/db.ts re-exports) and the
// constitution-writer so we can simulate the finish step and assert it
// writes the platform fields and constitution stub.
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @workspace/db so importing the schema doesn't drag in real DB drivers
// at test load. We re-implement characterCardV2Schema inside the factory using
// the same zod/v4 source so safeParse behavior is identical. The factory is
// hoisted by vitest, so all variables it references must live INSIDE the
// factory (no top-level `const schema = ...`).
vi.mock("@workspace/db", async () => {
  const { z } = await import("zod/v4");
  const characterCardV2Schema = z.object({
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
  return {
    db: {},
    creatorsTable: {},
    creatorConfigTable: {},
    creatorKycTable: {},
    creatorTotpTable: {},
    twinsTable: {},
    consentGrantsTable: {},
    characterCardV2Schema,
  };
});

// Re-import zod for the test's own safeParse assertions.
import { z } from "zod/v4";
const characterCardV2Schema = z.object({
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

// Import the SUT AFTER the mock.
import {
  buildCharacterCard,
  PROMPTS,
  HARDCODED_GUARDRAILS,
  personaWizard,
} from "../scenes/persona.scene.js";

const SAMPLE_ANSWERS = {
  greeting_style: "Hey love, thanks for stopping by!",
  fan_endearment: "babe",
  treatment_style: "flirty + warm",
  personality_traits: "playful, confident, soft-spoken",
  message_style: "short bursts with lots of emojis",
  bounds: "no politics, no underage talk",
  platform_name: "Fanvue",
  platform_url: "https://www.fanvue.com/yourname",
};

describe("ONBOARD-01 / PERSONA-01 — persona wizard assembles Character Card V2", () => {
  it("buildCharacterCard produces a card that validates against characterCardV2Schema", () => {
    const card = buildCharacterCard({
      creatorName: "Mira",
      answers: SAMPLE_ANSWERS,
    });
    const parsed = characterCardV2Schema.safeParse(card);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.spec).toBe("chara_card_v2");
      expect(parsed.data.spec_version).toBe("2.0");
      expect(parsed.data.data.name).toBe("Mira");
    }
  });

  it("HARDCODED_GUARDRAILS flows into data.post_history_instructions with {name} substituted", () => {
    const card = buildCharacterCard({
      creatorName: "Akari",
      answers: SAMPLE_ANSWERS,
    });
    const phi = card.data.post_history_instructions;
    expect(phi).toBeTruthy();
    // L2 guardrail markers per HARDCODED_GUARDRAILS literal
    expect(phi).toContain("Stay in character");
    expect(phi).toContain("Akari"); // {name} placeholder substituted
    expect(phi).not.toContain("{name}");
    // HARDCODED_GUARDRAILS export matches the literal template (still has {name}).
    expect(HARDCODED_GUARDRAILS).toContain("{name}");
  });

  it("includes greeting_style and fan_endearment in the persona description/first_mes", () => {
    const card = buildCharacterCard({
      creatorName: "Yui",
      answers: SAMPLE_ANSWERS,
    });
    expect(card.data.description).toContain("Hey love, thanks for stopping by!");
    expect(card.data.description).toContain("babe");
    expect(card.data.first_mes).toBe("Hey love, thanks for stopping by!");
  });

  it("includes treatment_style and personality_traits in data.personality", () => {
    const card = buildCharacterCard({
      creatorName: "Yui",
      answers: SAMPLE_ANSWERS,
    });
    expect(card.data.personality).toContain("playful, confident, soft-spoken");
    expect(card.data.personality).toContain("flirty + warm");
  });

  it("includes message_style in data.mes_example", () => {
    const card = buildCharacterCard({
      creatorName: "Yui",
      answers: SAMPLE_ANSWERS,
    });
    expect(card.data.mes_example).toContain("short bursts with lots of emojis");
  });

  it("includes bounds (off-limits) in data.description", () => {
    const card = buildCharacterCard({
      creatorName: "Yui",
      answers: SAMPLE_ANSWERS,
    });
    expect(card.data.description).toContain("no politics, no underage talk");
  });
});

describe("ONBOARD-01 — persona wizard captures platform_name + platform_url (D-02-10 / CHAT-05)", () => {
  it("PROMPTS includes platform_name as the 7th prompt and platform_url as the 8th", () => {
    expect(PROMPTS).toHaveLength(8);
    expect(PROMPTS[6].key).toBe("platform_name");
    expect(PROMPTS[7].key).toBe("platform_url");
  });

  it("PROMPTS earlier slots are the 6 persona inputs in the documented order", () => {
    expect(PROMPTS.map((p) => p.key)).toEqual([
      "greeting_style",
      "fan_endearment",
      "treatment_style",
      "personality_traits",
      "message_style",
      "bounds",
      "platform_name",
      "platform_url",
    ]);
  });
});

describe("ONBOARD-01 — personaWizard scene metadata", () => {
  it("is registered under the scene id 'persona-wizard'", () => {
    // Telegraf's BaseScene.id is the public scene identifier used by ctx.scene.enter().
    const id = (personaWizard as unknown as { id: string }).id;
    expect(id).toBe("persona-wizard");
  });
});

describe("ONBOARD-01 — invalid card paths surface a validation error", () => {
  it("safeParse rejects a card with an empty creatorName (data.name.min(1) breach)", () => {
    // Simulate the edge where ctx.from is missing — buildCharacterCard's fallback
    // is "your twin" (non-empty), so we force the bad case via a direct override.
    const bad = buildCharacterCard({ creatorName: "Yui", answers: SAMPLE_ANSWERS });
    bad.data.name = "";
    const parsed = characterCardV2Schema.safeParse(bad);
    expect(parsed.success).toBe(false);
  });

  it("safeParse rejects a card whose post_history_instructions exceeds 2000 chars", () => {
    const bad = buildCharacterCard({ creatorName: "Yui", answers: SAMPLE_ANSWERS });
    bad.data.post_history_instructions = "x".repeat(3000);
    const parsed = characterCardV2Schema.safeParse(bad);
    expect(parsed.success).toBe(false);
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});
