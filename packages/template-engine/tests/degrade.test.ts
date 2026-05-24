import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveModality } from "../src/degrade.js";
import type { ModalityConsent } from "../src/types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const allGranted: ModalityConsent = {
  textEnabled: true,
  voiceEnabled: true,
  videoEnabled: true,
  imageEnabled: true,
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

// ─── Preferred available ──────────────────────────────────────────────────────

describe("preferred modality available", () => {
  it("returns video when videoEnabled", () => {
    const result = resolveModality("video", allGranted);
    assert.equal(result.resolved, "video");
    assert.equal(result.degradedReason, "preferred_available");
    assert.equal(result.wasDegraded, false);
  });

  it("returns voice when voiceEnabled", () => {
    const result = resolveModality("voice", allGranted);
    assert.equal(result.resolved, "voice");
    assert.equal(result.degradedReason, "preferred_available");
    assert.equal(result.wasDegraded, false);
  });

  it("returns text when textEnabled", () => {
    const result = resolveModality("text", textOnly);
    assert.equal(result.resolved, "text");
    assert.equal(result.degradedReason, "preferred_available");
    assert.equal(result.wasDegraded, false);
  });

  it("returns image when imageEnabled", () => {
    const result = resolveModality("image", allGranted);
    assert.equal(result.resolved, "image");
    assert.equal(result.degradedReason, "preferred_available");
    assert.equal(result.wasDegraded, false);
  });
});

// ─── Consent-absent degradation cases (acceptance criteria: ≥3) ──────────────

describe("degradation — video consent absent", () => {
  // Case 1: video absent, voice available → falls back to voice
  it("degrades video → voice when videoEnabled=false and voiceEnabled=true", () => {
    const result = resolveModality("video", textAndVoice);
    assert.equal(result.resolved, "voice");
    assert.equal(result.degradedReason, "no_video_consent");
    assert.equal(result.wasDegraded, true);
  });

  // Case 2: video absent, voice absent → falls back to text
  it("degrades video → text when videoEnabled=false and voiceEnabled=false", () => {
    const result = resolveModality("video", textOnly);
    assert.equal(result.resolved, "text");
    assert.equal(result.degradedReason, "no_video_consent");
    assert.equal(result.wasDegraded, true);
  });
});

describe("degradation — voice consent absent", () => {
  // Case 3: voice absent → falls back to text
  it("degrades voice → text when voiceEnabled=false", () => {
    const result = resolveModality("voice", textOnly);
    assert.equal(result.resolved, "text");
    assert.equal(result.degradedReason, "no_voice_consent");
    assert.equal(result.wasDegraded, true);
  });
});

describe("degradation — image consent absent", () => {
  // Case 4: image absent → falls back to text
  it("degrades image → text when imageEnabled=false", () => {
    const result = resolveModality("image", textOnly);
    assert.equal(result.resolved, "text");
    assert.equal(result.degradedReason, "no_image_consent");
    assert.equal(result.wasDegraded, true);
  });
});

// ─── Error path ───────────────────────────────────────────────────────────────

describe("error when no fallback available", () => {
  it("throws when textEnabled=false (programmer error — consent check must run first)", () => {
    const noConsent: ModalityConsent = {
      textEnabled: false,
      voiceEnabled: false,
      videoEnabled: false,
      imageEnabled: false,
    };
    assert.throws(
      () => resolveModality("video", noConsent),
      /No consented modality found/
    );
  });

  it("throws when text is preferred but textEnabled=false", () => {
    const noText: ModalityConsent = {
      textEnabled: false,
      voiceEnabled: true,
      videoEnabled: true,
      imageEnabled: true,
    };
    assert.throws(
      () => resolveModality("text", noText),
      /No consented modality found/
    );
  });
});
