// 80/20 split is a hard business rule — never modify these constants without CTO approval.
export const CREATOR_SHARE_RATE = 0.80 as const;
export const PLATFORM_SHARE_RATE = 0.20 as const;

export interface LedgerSplit {
  creatorShare: number;
  platformShare: number;
  paymentProcessingFee: number;
}

/**
 * Calculate 80/20 creator/platform split for a credit deduction.
 * Processing fee is deducted from platform_share only — never from creator's 80%.
 */
export function calculateLedgerSplit(
  amountCredits: number,
  paymentProcessingFee = 0
): LedgerSplit {
  if (amountCredits <= 0) throw new Error("amountCredits must be positive");
  if (paymentProcessingFee < 0) throw new Error("paymentProcessingFee cannot be negative");

  return {
    creatorShare: amountCredits * CREATOR_SHARE_RATE,
    platformShare: amountCredits * PLATFORM_SHARE_RATE - paymentProcessingFee,
    paymentProcessingFee,
  };
}
