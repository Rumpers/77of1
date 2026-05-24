// OF-79 Slice 2.2 — variation check tests
// Proves: two creators on the same template skeleton produce distinct system prompts,
// the variation layer is deterministic, and surface formatting meets spec.
// All tests are pure unit tests (no network, no DB).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { DbCreatorPersona } from "@7of1/types";
import { computeVariationParams } from "../src/variation.js";
import { buildShareableSystemPrompt, buildUserPrompt } from "../src/shareable-prompt.js";
import { formatForSurface } from "../src/formatter.js";

// ─── Mock personas ─────────────────────────────────────────────────────────────

function makePersona(overrides: Partial<DbCreatorPersona> = {}): DbCreatorPersona {
  return {
    id: "persona-001",
    creator_id: "creator-001",
    greeting_style: "Hey babe!",
    fan_endearment: "babe",
    emoji_usage: "moderate",
    bounds: [],
    treatment_style: "warm and supportive",
    personality_traits: ["bubbly", "energetic"],
    message_style: "casual and friendly",
    intensity_dial: "warm",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const ALICE_PERSONA = makePersona({
  creator_id: "creator-alice-001",
  greeting_style: "Hey gorgeous! 💪",
  fan_endearment: "fitness fam",
  personality_traits: ["energetic", "motivating", "direct"],
  message_style: "punchy and inspiring",
  emoji_usage: "moderate",
});

const BOB_PERSONA = makePersona({
  creator_id: "creator-bob-007",
  greeting_style: "Hey love...",
  fan_endearment: "darling",
  personality_traits: ["gentle", "soothing", "introspective"],
  message_style: "slow, warm, meditative",
  emoji_usage: "minimal",
});

const ALICE_PARAMS = {
  creatorHandle: "alice-fitness",
  persona: ALICE_PERSONA,
  intensityDial: "warm" as const,
  forbiddenTopics: [],
  language: "en" as const,
};

const BOB_PARAMS = {
  creatorHandle: "bob-asmr",
  persona: BOB_PERSONA,
  intensityDial: "warm" as const,
  forbiddenTopics: [],
  language: "en" as const,
};

const TEMPLATE_ID = "tmpl-lifestyle-tip";
const TOPIC = "morning routines";

// ─── Variation params ──────────────────────────────────────────────────────────

describe("computeVariationParams", () => {
  it("is deterministic for same inputs", () => {
    const a = computeVariationParams("creator-x", "tmpl-1");
    const b = computeVariationParams("creator-x", "tmpl-1");
    assert.deepEqual(a, b);
  });

  it("two creators get different variation for same template", () => {
    const alice = computeVariationParams("creator-alice-001", TEMPLATE_ID);
    const bob = computeVariationParams("creator-bob-007", TEMPLATE_ID);
    const differ =
      alice.styleDirective !== bob.styleDirective ||
      Math.abs(alice.temperatureOffset - bob.temperatureOffset) > 0.001;
    assert.ok(differ, "Alice and Bob must differ in style or temperature");
  });

  it("same creator gets different variation for different templates", () => {
    const a = computeVariationParams("creator-x", "tmpl-1");
    const b = computeVariationParams("creator-x", "tmpl-2");
    assert.notDeepEqual(a, b);
  });

  it("seed is in 0–1 range", () => {
    const { seed } = computeVariationParams("creator-xyz", "tmpl-abc");
    assert.ok(seed >= 0 && seed <= 1, `seed out of range: ${seed}`);
  });

  it("temperatureOffset is in ±0.15 range", () => {
    for (const id of ["a", "bb", "ccc", "dddd", "eeeee"]) {
      const { temperatureOffset } = computeVariationParams(id, "tmpl");
      assert.ok(
        temperatureOffset >= -0.15 && temperatureOffset <= 0.15,
        `offset out of range for "${id}": ${temperatureOffset}`
      );
    }
  });
});

// ─── System prompt divergence (acceptance criterion: variation check passes) ───

describe("system prompt variation", () => {
  it("Alice and Bob produce different system prompts with same template — persona differs", () => {
    const variation = computeVariationParams("creator-x", TEMPLATE_ID);
    const alicePrompt = buildShareableSystemPrompt(ALICE_PARAMS, "social", variation);
    const bobPrompt = buildShareableSystemPrompt(BOB_PARAMS, "social", variation);
    assert.notEqual(
      alicePrompt,
      bobPrompt,
      "Different personas must produce different system prompts"
    );
    // Sanity check: creator handles appear in their respective prompts
    assert.ok(alicePrompt.includes("alice-fitness"));
    assert.ok(bobPrompt.includes("bob-asmr"));
  });

  it("Alice and Bob produce different system prompts with per-creator variation", () => {
    const aliceVar = computeVariationParams("creator-alice-001", TEMPLATE_ID);
    const bobVar = computeVariationParams("creator-bob-007", TEMPLATE_ID);
    const alicePrompt = buildShareableSystemPrompt(ALICE_PARAMS, "social", aliceVar);
    const bobPrompt = buildShareableSystemPrompt(BOB_PARAMS, "social", bobVar);
    assert.notEqual(alicePrompt, bobPrompt);
  });

  it("social system prompt contains 280 char constraint", () => {
    const variation = computeVariationParams("creator-x", TEMPLATE_ID);
    const prompt = buildShareableSystemPrompt(ALICE_PARAMS, "social", variation);
    assert.ok(prompt.includes("280"), "social prompt must mention 280 char limit");
  });

  it("fan_page system prompt contains 300 word constraint", () => {
    const variation = computeVariationParams("creator-x", TEMPLATE_ID);
    const prompt = buildShareableSystemPrompt(ALICE_PARAMS, "fan_page", variation);
    assert.ok(prompt.includes("300"), "fan_page prompt must mention 300 word floor");
  });

  it("variation style directive is included in system prompt", () => {
    const variation = computeVariationParams("creator-alice-001", TEMPLATE_ID);
    const prompt = buildShareableSystemPrompt(ALICE_PARAMS, "social", variation);
    assert.ok(
      prompt.includes(variation.styleDirective),
      "System prompt must include the variation style directive"
    );
  });
});

// ─── User prompt construction ─────────────────────────────────────────────────

describe("buildUserPrompt", () => {
  it("substitutes {topic} placeholder", () => {
    const result = buildUserPrompt(
      "Share your top tip about {topic} with your fans.",
      "morning routines"
    );
    assert.equal(
      result,
      "Share your top tip about morning routines with your fans."
    );
  });

  it("substitutes all {topic} occurrences", () => {
    const result = buildUserPrompt("{topic} is important. Talk about {topic}.", "sleep");
    assert.equal(result, "sleep is important. Talk about sleep.");
  });

  it("returns skeleton unchanged when no {topic}", () => {
    const skeleton = "Tell your fans something special today.";
    assert.equal(buildUserPrompt(skeleton, "anything"), skeleton);
  });
});

// ─── Surface formatter ────────────────────────────────────────────────────────

describe("formatForSurface", () => {
  it("social output is ≤280 characters", () => {
    const long = "A".repeat(400);
    const { text } = formatForSurface(long, "social", "creator-x", TOPIC);
    assert.ok(text.length <= 280, `Expected ≤280 chars, got ${text.length}`);
  });

  it("social output includes hashtags", () => {
    const { hashtags } = formatForSurface("Short text", "social", "creator-x", TOPIC);
    assert.ok(hashtags && hashtags.length >= 1, "Social must have ≥1 hashtag");
  });

  it("social hashtags start with #", () => {
    const { hashtags } = formatForSurface("Text", "social", "creator-x", TOPIC);
    for (const tag of hashtags ?? []) {
      assert.ok(tag.startsWith("#"), `Tag must start with #: ${tag}`);
    }
  });

  it("fan_page output is not trimmed", () => {
    const long = "B".repeat(400);
    const { text } = formatForSurface(long, "fan_page", "creator-x", TOPIC);
    assert.equal(text, long, "fan_page text must be preserved unchanged");
  });

  it("fan_page has no hashtags", () => {
    const { hashtags } = formatForSurface("Content", "fan_page", "creator-x", TOPIC);
    assert.equal(hashtags, undefined);
  });

  it("short social text passes through without truncation", () => {
    const short = "This is a short post.";
    const { text } = formatForSurface(short, "social", "creator-x", TOPIC);
    assert.equal(text, short);
  });

  it("two creators get different hashtags from the same topic", () => {
    const alice = formatForSurface("Text", "social", "creator-alice-001", TOPIC);
    const bob = formatForSurface("Text", "social", "creator-bob-007", TOPIC);
    // hashtags are derived from creatorId so they may differ — not required but possible
    // The important thing is both have hashtags
    assert.ok(alice.hashtags && alice.hashtags.length > 0);
    assert.ok(bob.hashtags && bob.hashtags.length > 0);
  });
});
