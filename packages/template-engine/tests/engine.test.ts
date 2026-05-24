import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TemplateEngine } from "../src/engine.js";
import type { TemplateDefinition, ModalityConsent } from "../src/types.js";

const engine = new TemplateEngine();

const fanEngagementTemplate: TemplateDefinition = {
  templateId: "fan-engagement-v1",
  name: "Fan Engagement Post",
  slots: [
    { name: "hero", preferredModality: "video", description: "Talking-head video greeting" },
    { name: "message", preferredModality: "voice", description: "Personal voice note" },
    { name: "caption", preferredModality: "text", description: "Short text caption" },
  ],
};

const textOnly: ModalityConsent = {
  textEnabled: true,
  voiceEnabled: false,
  videoEnabled: false,
  imageEnabled: false,
};

const textAndVoice: ModalityConsent = {
  textEnabled: true,
  voiceEnabled: true,
  videoEnabled: false,
  imageEnabled: false,
};

const allGranted: ModalityConsent = {
  textEnabled: true,
  voiceEnabled: true,
  videoEnabled: true,
  imageEnabled: true,
};

describe("TemplateEngine.resolve — full template", () => {
  it("resolves all slots at preferred when full consent is granted", () => {
    const result = engine.resolve(fanEngagementTemplate, allGranted);

    assert.equal(result.templateId, "fan-engagement-v1");
    assert.equal(result.allSlotsAtPreferred, true);

    const hero = result.slots.find((s) => s.name === "hero")!;
    assert.equal(hero.resolvedModality, "video");
    assert.equal(hero.wasDegraded, false);

    const message = result.slots.find((s) => s.name === "message")!;
    assert.equal(message.resolvedModality, "voice");
    assert.equal(message.wasDegraded, false);

    const caption = result.slots.find((s) => s.name === "caption")!;
    assert.equal(caption.resolvedModality, "text");
    assert.equal(caption.wasDegraded, false);
  });

  // Consent-absent case 1: no video, has voice
  it("degrades hero (video) → voice when videoEnabled=false, voiceEnabled=true", () => {
    const result = engine.resolve(fanEngagementTemplate, textAndVoice);

    assert.equal(result.allSlotsAtPreferred, false);

    const hero = result.slots.find((s) => s.name === "hero")!;
    assert.equal(hero.resolvedModality, "voice");
    assert.equal(hero.wasDegraded, true);
    assert.equal(hero.degradedReason, "no_video_consent");

    // voice slot still resolved at preferred (voice is available)
    const message = result.slots.find((s) => s.name === "message")!;
    assert.equal(message.resolvedModality, "voice");
    assert.equal(message.wasDegraded, false);
  });

  // Consent-absent case 2: text-only consent — both video and voice degrade to text
  it("degrades all non-text slots to text when only textEnabled=true", () => {
    const result = engine.resolve(fanEngagementTemplate, textOnly);

    assert.equal(result.allSlotsAtPreferred, false);

    const hero = result.slots.find((s) => s.name === "hero")!;
    assert.equal(hero.resolvedModality, "text");
    assert.equal(hero.wasDegraded, true);
    assert.equal(hero.degradedReason, "no_video_consent");

    const message = result.slots.find((s) => s.name === "message")!;
    assert.equal(message.resolvedModality, "text");
    assert.equal(message.wasDegraded, true);
    assert.equal(message.degradedReason, "no_voice_consent");

    const caption = result.slots.find((s) => s.name === "caption")!;
    assert.equal(caption.resolvedModality, "text");
    assert.equal(caption.wasDegraded, false);
  });

  it("does not crash on an empty slot list", () => {
    const empty: TemplateDefinition = {
      templateId: "empty-template",
      name: "Empty",
      slots: [],
    };
    const result = engine.resolve(empty, textOnly);
    assert.equal(result.slots.length, 0);
    assert.equal(result.allSlotsAtPreferred, true);
  });
});

describe("TemplateEngine.resolve — mixed-modality template with image", () => {
  const richTemplate: TemplateDefinition = {
    templateId: "rich-post-v1",
    name: "Rich Post",
    slots: [
      { name: "cover", preferredModality: "image" },
      { name: "video_clip", preferredModality: "video" },
      { name: "body", preferredModality: "text" },
    ],
  };

  // Consent-absent case 3: no image, no video → both degrade to text
  it("degrades image → text and video → text when only textEnabled=true", () => {
    const result = engine.resolve(richTemplate, textOnly);

    const cover = result.slots.find((s) => s.name === "cover")!;
    assert.equal(cover.resolvedModality, "text");
    assert.equal(cover.degradedReason, "no_image_consent");

    const clip = result.slots.find((s) => s.name === "video_clip")!;
    assert.equal(clip.resolvedModality, "text");
    assert.equal(clip.degradedReason, "no_video_consent");

    assert.equal(result.allSlotsAtPreferred, false);
  });
});
