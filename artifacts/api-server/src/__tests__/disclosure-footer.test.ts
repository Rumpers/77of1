// COMPLY-01 — SB 243 AI disclosure footer (unit).
// Source of truth: artifacts/api-server/src/lib/disclosure.ts.
// Pure function — no DB, no fetch, no env mocks needed.
import { describe, it, expect } from "vitest";
import { getDisclosureFooter } from "../lib/disclosure.js";

describe("COMPLY-01: SB 243 AI disclosure footer", () => {
  it("returns 'AI twin · @{handle}_ai' for locale='en'", () => {
    expect(getDisclosureFooter("en", "sakura")).toBe("AI twin · @sakura_ai");
  });

  it("returns localized prefix for ja (AIツイン)", () => {
    expect(getDisclosureFooter("ja", "sakura")).toBe("AIツイン · @sakura_ai");
  });

  it("returns localized prefix for zh-TW (AI分身)", () => {
    expect(getDisclosureFooter("zh-TW", "sakura")).toBe("AI分身 · @sakura_ai");
  });

  it("sanitises non-[a-zA-Z0-9_] handle characters", () => {
    // Crafted handles with separators / unicode must not be able to break the
    // disclosure string contract.
    expect(getDisclosureFooter("en", "sakura·foo")).toBe(
      "AI twin · @sakurafoo_ai",
    );
    expect(getDisclosureFooter("en", "sak@ura")).toBe("AI twin · @sakura_ai");
  });

  it("handles empty / null-ish handle safely (no crash, empty after sanitisation)", () => {
    expect(getDisclosureFooter("en", "")).toBe("AI twin · @_ai");
    // Cast to string for the test boundary — runtime callers should pass real
    // strings, but the helper coerces defensively.
    expect(getDisclosureFooter("en", undefined as unknown as string)).toBe(
      "AI twin · @_ai",
    );
  });
});
