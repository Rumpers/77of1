import { describe, it, expect } from "vitest";
import {
  calculateLedgerSplit,
  CREATOR_SHARE_RATE,
  PLATFORM_SHARE_RATE,
} from "../../lib/credits";

// ─── 80/20 split enforcement ──────────────────────────────────────────────────
// creator_share = amount * 0.80 always — hard business rule, never negotiable.
// platform_share = amount * 0.20 - payment_processing_fee

describe("calculateLedgerSplit — 80/20 enforcement", () => {
  it("creator gets exactly 80% of every fan credit spend", () => {
    const { creatorShare } = calculateLedgerSplit(100);
    expect(creatorShare).toBe(80);
  });

  it("platform gets 20% when no processing fee", () => {
    const { platformShare } = calculateLedgerSplit(100);
    expect(platformShare).toBe(20);
  });

  it("processing fee is deducted from platform share only — never from creator 80%", () => {
    const { creatorShare, platformShare } = calculateLedgerSplit(100, 5);
    expect(creatorShare).toBe(80);   // creator is always 80%, unaffected by fee
    expect(platformShare).toBe(15);  // 20 - 5
  });

  it("80/20 holds for small amounts", () => {
    const { creatorShare, platformShare } = calculateLedgerSplit(10);
    expect(creatorShare).toBeCloseTo(8);
    expect(platformShare).toBeCloseTo(2);
  });

  it("total creator + platform equals amount when no processing fee", () => {
    const amount = 100;
    const { creatorShare, platformShare } = calculateLedgerSplit(amount);
    expect(creatorShare + platformShare).toBe(amount);
  });

  it("creator share rate constant is exactly 0.80", () => {
    expect(CREATOR_SHARE_RATE).toBe(0.8);
  });

  it("platform share rate constant is exactly 0.20", () => {
    expect(PLATFORM_SHARE_RATE).toBe(0.2);
  });

  it("split is correct for a single-credit deduction", () => {
    const { creatorShare, platformShare } = calculateLedgerSplit(1);
    expect(creatorShare).toBeCloseTo(0.8);
    expect(platformShare).toBeCloseTo(0.2);
  });

  it("throws on zero amount", () => {
    expect(() => calculateLedgerSplit(0)).toThrow("amountCredits must be positive");
  });

  it("throws on negative amount", () => {
    expect(() => calculateLedgerSplit(-10)).toThrow("amountCredits must be positive");
  });

  it("throws on negative processing fee", () => {
    expect(() => calculateLedgerSplit(100, -1)).toThrow(
      "paymentProcessingFee cannot be negative"
    );
  });

  it("payment_processing_fee is preserved in result", () => {
    const { paymentProcessingFee } = calculateLedgerSplit(100, 3);
    expect(paymentProcessingFee).toBe(3);
  });
});
