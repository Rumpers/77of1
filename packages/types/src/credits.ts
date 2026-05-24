import type { ContentType } from "./platform";

// ─── Credit deduction API ─────────────────────────────────────────────────────

// POST /api/credits/deduct — called by the AI Twin Engine per fan interaction.
// Idempotent on interactionId — safe to retry with the same ID.
export interface CreditDeductionRequest {
  creatorId: string;
  fanId: string;
  interactionId: string; // idempotency key; unique per fan interaction
  cost: number;          // positive integer credits to deduct
}

export type CreditDeductionErrorCode =
  | "insufficient_credits"
  | "fan_not_found"
  | "duplicate_transaction"
  | "invalid_cost";

export interface CreditDeductionResponse {
  success: true;
  remainingBalance: number;
}

export interface CreditDeductionErrorResponse {
  error: string;
  remainingBalance?: number; // only present for insufficient_credits
}

// ─── Payout webhook interface ─────────────────────────────────────────────────

export type PayoutWebhookEventType =
  | "payout.scheduled"
  | "payout.processing"
  | "payout.completed"
  | "payout.failed"
  | "payout.reversed";

export type PayoutCurrency = "USD" | "JPY" | "TWD";
export type PayoutProvider = "stripe" | "line_pay";

export interface PayoutWebhookEvent {
  eventId: string; // idempotency key
  eventType: PayoutWebhookEventType;
  payoutId: string;
  creatorId: string;
  amountCents: number; // amount in smallest currency unit (cents / yen / TWD)
  currency: PayoutCurrency;
  payoutProvider: PayoutProvider;
  timestamp: string; // ISO 8601
  metadata: Record<string, string>;
}

// ─── Payout summary ───────────────────────────────────────────────────────────

export interface PayoutSummary {
  payoutId: string;
  creatorId: string;
  periodStart: string; // ISO 8601
  periodEnd: string; // ISO 8601
  totalCreditsEarned: number;
  grossAmountCents: number; // before platform fee
  platformFeeCents: number; // 30% default; exact rate in creator_config
  netAmountCents: number; // disbursed amount
  currency: PayoutCurrency;
  payoutProvider: PayoutProvider;
  status: "pending" | "processing" | "paid" | "failed";
  scheduledAt: string; // ISO 8601
  paidAt: string | null; // ISO 8601; null until paid
}

// ─── Credit balance ───────────────────────────────────────────────────────────

export interface FanCreditBalance {
  fanId: string;
  credits: number; // current spendable balance
  reservedCredits: number; // held for in-flight jobs; not yet deducted
  lastUpdatedAt: string; // ISO 8601
}
