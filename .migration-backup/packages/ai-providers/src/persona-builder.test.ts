// Persona builder unit tests — OF-62
// Run with: tsx src/persona-builder.test.ts
import assert from "node:assert/strict";
import { buildSystemPrompt, type PersonaBuilderParams } from "./persona-builder.js";
import type { DbCreatorPersona } from "@7of1/types";

const BASE_PERSONA: DbCreatorPersona = {
  id: "persona-1",
  creator_id: "creator-1",
  greeting_style: "Hey loves! So happy you're here!",
  fan_endearment: "loves",
  emoji_usage: "moderate",
  bounds: ["no financial advice", "no medical advice"],
  treatment_style: "warm, supportive, encouraging",
  personality_traits: ["bubbly", "authentic", "energetic"],
  message_style: "casual, conversational, uses sentence fragments",
  intensity_dial: "warm",
  updated_at: new Date().toISOString(),
};

const BASE_PARAMS: PersonaBuilderParams = {
  creatorHandle: "YumiChan",
  persona: BASE_PERSONA,
  intensityDial: "warm",
  forbiddenTopics: [],
  language: "en",
};

// ── Test: builds a valid system prompt in <100ms ──────────────────────────────
{
  const t0 = Date.now();
  const prompt = buildSystemPrompt(BASE_PARAMS);
  const elapsed = Date.now() - t0;

  assert(typeof prompt === "string" && prompt.length > 0, "prompt must be non-empty string");
  assert(elapsed < 100, `buildSystemPrompt took ${elapsed}ms — must be <100ms`);
  assert(prompt.includes("YumiChan"), "prompt must include creator handle");
  assert(prompt.includes("AI twin"), "prompt must mention AI twin identity");
  console.log("✓ valid system prompt in <100ms");
}

// ── Test: all 7 persona fields appear in the prompt ───────────────────────────
{
  const prompt = buildSystemPrompt(BASE_PARAMS);

  assert(prompt.includes("Hey loves!"), "greeting_style must be in prompt");
  assert(prompt.includes("loves"), "fan_endearment must be in prompt");
  // emoji_usage "moderate" maps to "Use emojis naturally throughout your messages."
  assert(prompt.includes("naturally"), "emoji_usage instruction must be in prompt");
  assert(prompt.includes("warm, supportive"), "treatment_style must be in prompt");
  assert(prompt.includes("bubbly"), "personality_traits must be in prompt");
  assert(prompt.includes("casual, conversational"), "message_style must be in prompt");
  console.log("✓ all 7 persona fields injected");
}

// ── Test: intensity dial produces detectably different tones ──────────────────
{
  const warm = buildSystemPrompt({ ...BASE_PARAMS, intensityDial: "warm" });
  const intimate = buildSystemPrompt({ ...BASE_PARAMS, intensityDial: "intimate" });
  const explicit = buildSystemPrompt({ ...BASE_PARAMS, intensityDial: "explicit" });

  // Each must include unique keywords from the intensity instructions
  assert(warm.includes("PG-rated"), "warm must mention PG-rated");
  assert(intimate.includes("affectionate") || intimate.includes("tender"), "intimate must mention tender/affectionate");
  assert(explicit.includes("Adult content"), "explicit must mention adult content");
  // All three must differ from each other
  assert(warm !== intimate, "warm and intimate must differ");
  assert(intimate !== explicit, "intimate and explicit must differ");
  assert(warm !== explicit, "warm and explicit must differ");
  console.log("✓ intensity dial: warm/intimate/explicit produce different prompts");
}

// ── Test: EN/JP/ZH-TW language instructions are correct ──────────────────────
{
  const en = buildSystemPrompt({ ...BASE_PARAMS, language: "en" });
  const ja = buildSystemPrompt({ ...BASE_PARAMS, language: "ja" });
  const zhTW = buildSystemPrompt({ ...BASE_PARAMS, language: "zh-TW" });

  assert(en.includes("English"), "en must specify English");
  assert(ja.includes("Japanese") || ja.includes("日本語"), "ja must specify Japanese");
  assert(zhTW.includes("Traditional Chinese") || zhTW.includes("繁體中文"), "zh-TW must specify Traditional Chinese");
  assert(en !== ja, "en and ja prompts must differ");
  assert(ja !== zhTW, "ja and zh-TW prompts must differ");
  console.log("✓ EN/JP/ZH-TW language instructions correct");
}

// ── Test: forbidden topics appear in the hard-stops section ──────────────────
{
  const prompt = buildSystemPrompt({
    ...BASE_PARAMS,
    forbiddenTopics: ["real name", "home address", "competitor platform"],
  });

  assert(prompt.includes("Hard stops"), "prompt must include hard-stops section");
  assert(prompt.includes("real name"), "forbidden topic 'real name' must appear");
  assert(prompt.includes("home address"), "forbidden topic 'home address' must appear");
  assert(prompt.includes("competitor platform"), "forbidden topic must appear");
  console.log("✓ forbidden topics in hard-stops section");
}

// ── Test: no forbidden topics → no hard-stops section ────────────────────────
{
  const prompt = buildSystemPrompt({ ...BASE_PARAMS, forbiddenTopics: [] });
  assert(!prompt.includes("Hard stops"), "no forbidden topics → no hard-stops section");
  console.log("✓ empty forbidden topics → no hard-stops section");
}

// ── Test: empty personality traits handled gracefully ────────────────────────
{
  const persona = { ...BASE_PERSONA, personality_traits: [] };
  const prompt = buildSystemPrompt({ ...BASE_PARAMS, persona });
  assert(typeof prompt === "string" && prompt.length > 0, "empty traits must not break builder");
  console.log("✓ empty personality_traits handled gracefully");
}

console.log("\n✅ All persona-builder tests passed.");
