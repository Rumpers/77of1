// COMPLY-02 — SB 243 self-harm helpline injection (plan 02-05 GREEN).
// Unit: composeFlaggedReply(moderationResult, locale) returns helpline-injected
// string when self-harm flagged. Verifies the locked helpline numbers per
// D-02-05 (overrides CLAUDE.md stale `0120-783-556`).
//
// Mocks @workspace/db so the safety-audit dependency chain doesn't require a
// real DB. composeFlaggedReply itself does NOT touch the DB.

import { describe, it, expect, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  db: { insert: () => ({ values: async () => undefined }) },
  safetyAuditLogTable: {},
}));

import { composeFlaggedReply } from "../lib/moderation.js";
import { getHelpline } from "../lib/helplines.js";
import type { ModerationResult } from "../providers/interfaces.js";

function selfHarmResult(): ModerationResult {
  return {
    flagged: true,
    categories: ["self-harm", "self-harm/intent"],
    scores: { "self-harm": 0.91, "self-harm/intent": 0.85 },
    primaryCategory: "self-harm",
  };
}

describe("COMPLY-02: SB 243 self-harm helpline injection", () => {
  it("locale=ja → reply contains JP helpline 0120-279-338 (D-02-05, overrides CLAUDE.md)", () => {
    const reply = composeFlaggedReply(selfHarmResult(), "ja");
    expect(reply).toContain("0120-279-338");
    expect(reply).toContain("よりそいホットライン");
  });

  it("locale=zh-TW → reply contains 1925", () => {
    const reply = composeFlaggedReply(selfHarmResult(), "zh-TW");
    expect(reply).toContain("1925");
  });

  it("locale=en → reply contains 988", () => {
    const reply = composeFlaggedReply(selfHarmResult(), "en");
    expect(reply).toContain("988");
  });

  it("locale=zh-HK → reply contains 2389 2222 (HK fallback)", () => {
    const reply = composeFlaggedReply(selfHarmResult(), "zh-HK");
    expect(reply).toContain("2389 2222");
  });

  it("does NOT silently refuse — reply is non-empty and contains both helpline + deflection", () => {
    const reply = composeFlaggedReply(selfHarmResult(), "en");
    expect(reply.length).toBeGreaterThan(0);
    // helpline is first segment (split on first "\n\n"), deflection second
    const parts = reply.split("\n\n");
    expect(parts.length).toBeGreaterThanOrEqual(2);
    expect(parts[0]).toContain("988");
    // deflection (default — UI-SPEC) — "Let's talk about something else."
    expect(parts.slice(1).join("\n\n")).toContain("something else");
  });

  it("helpline is the first ~120 chars (Web client splits on first '\\n\\n')", () => {
    const reply = composeFlaggedReply(selfHarmResult(), "en");
    const firstSegment = reply.split("\n\n")[0]!;
    expect(firstSegment).toBe(getHelpline("en"));
  });

  it("does NOT prepend helpline for non-self-harm categories (sexual flagged)", () => {
    const sexualResult: ModerationResult = {
      flagged: true,
      categories: ["sexual"],
      scores: { sexual: 0.92 },
      primaryCategory: "sexual",
    };
    const reply = composeFlaggedReply(sexualResult, "en");
    expect(reply).not.toContain("988");
    // Just the deflection
    expect(reply).toContain("Tell me about your day instead?");
  });
});

describe("getHelpline — locale-keyed numbers (Pitfall #13 — never LLM-generated)", () => {
  it("returns 988 for en", () => {
    expect(getHelpline("en")).toContain("988");
  });
  it("returns 0120-279-338 for ja", () => {
    expect(getHelpline("ja")).toContain("0120-279-338");
  });
  it("returns 1925 for zh-TW", () => {
    expect(getHelpline("zh-TW")).toContain("1925");
  });
  it("returns 2389 2222 for zh-HK", () => {
    expect(getHelpline("zh-HK")).toContain("2389 2222");
  });
  it("falls back to en helpline for unknown locale", () => {
    expect(getHelpline("xx")).toBe(getHelpline("en"));
  });
});
