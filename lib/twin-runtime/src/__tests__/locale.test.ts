import { describe, expect, it } from "vitest";
import { normalizeLocale } from "@workspace/twin-runtime/locale";

describe("normalizeLocale", () => {
  it.each([
    ["en", "en"],
    ["EN", "en"],
    ["en-US", "en"],
    ["ja", "ja"],
    ["ja-JP", "ja"],
    ["zh-tw", "zh-TW"],
    ["zh-TW", "zh-TW"],
    ["zh-Hant-TW", "zh-TW"],
    ["zh-CN", "en"],
    ["", "en"],
  ] as const)('normalizeLocale("%s") === "%s"', (input, expected) => {
    expect(normalizeLocale(input)).toBe(expected);
  });

  it("returns 'en' for null", () => {
    expect(normalizeLocale(null)).toBe("en");
  });

  it("returns 'en' for undefined", () => {
    expect(normalizeLocale(undefined)).toBe("en");
  });
});
