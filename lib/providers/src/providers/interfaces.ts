// Provider adapter interfaces — OF-106
// Contract boundary between Platform (infrastructure) and AI Engineer (implementations).
// Swapping providers = changing config, not rewriting code.

export interface TextMessage {
  role: "user" | "assistant";
  content: string;
}

export interface TextGenerationInput {
  creatorId: string;
  fanId: string;
  messages: TextMessage[];
  systemPrompt: string;
  ragContext?: string;
  maxTokens?: number;
}

export interface TextGenerationResult {
  content: string;
  tokensUsed: number;
  modelId: string;
  latencyMs: number;
}

export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export interface ITextProvider {
  readonly modelId: string;
  generateText(input: TextGenerationInput): Promise<TextGenerationResult>;
  estimateCost(input: TextGenerationInput): CostEstimate;
}

export interface VoiceGenerationInput {
  creatorId: string;
  text: string;
  voiceModelId: string; // provider-specific clone ID
  languageCode: "en" | "ja" | "zh-TW";
}

export interface VoiceGenerationResult {
  providerJobId: string;
}

export interface VoiceJobStatus {
  status: "pending" | "processing" | "done" | "failed";
  audioUrl?: string;
  durationSeconds?: number;
}

export interface IVoiceProvider {
  enqueueVoiceGeneration(
    input: VoiceGenerationInput
  ): Promise<VoiceGenerationResult>;
  getJobStatus(providerJobId: string): Promise<VoiceJobStatus>;
}

export interface VideoGenerationInput {
  creatorId: string;
  script: string;
  avatarModelId: string;
  languageCode: "en" | "ja" | "zh-TW";
}

export interface VideoGenerationResult {
  providerJobId: string;
}

export interface VideoJobStatus {
  status: "pending" | "processing" | "done" | "failed";
  videoUrl?: string;
  durationSeconds?: number;
}

export interface IVideoProvider {
  enqueueVideoGeneration(
    input: VideoGenerationInput
  ): Promise<VideoGenerationResult>;
  getJobStatus(providerJobId: string): Promise<VideoJobStatus>;
}

export interface ProviderRegistry {
  text: ITextProvider;
  voice: IVoiceProvider;
  video: IVideoProvider;
}

// ── Payment provider ─────────────────────────────────────────────────────────

export interface ChargeResult {
  success: boolean;
  /** Stripe decline code or internal error code on failure */
  errorCode?: string;
  errorMessage?: string;
}

export interface PaymentMethodStatus {
  valid: boolean;
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
}

export interface RefundResult {
  refundId: string;
}

export interface IPaymentProvider {
  /** Attempt to charge the subscription immediately (idempotent by subscriptionId). */
  retryCharge(subscriptionId: string): Promise<ChargeResult>;
  /** Cancel the subscription in the payment gateway. */
  cancelSubscription(subscriptionId: string): Promise<void>;
  /** Retrieve payment method health for the customer. */
  getPaymentMethodStatus(customerId: string): Promise<PaymentMethodStatus>;
  /** Issue a refund against a payment intent. */
  createRefund(paymentIntentId: string, amountCents: number, reason: string): Promise<RefundResult>;
}

// Non-retryable — 4xx from provider (bad request, invalid model, auth failure).
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly provider?: string
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

// Retryable — 5xx from provider (server error, rate limit, temporary outage).
// BullMQ workers should catch this and retry with backoff.
export class ProviderTransientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly provider?: string
  ) {
    super(message);
    this.name = "ProviderTransientError";
  }
}

// ── Email provider — HID-001 ──────────────────────────────────────────────────

export type EmailLocale = "en" | "ja" | "zh-TW";

// All known transactional email templates.
// New templates are added here and implemented in email-templates.ts.
export type EmailTemplate =
  | "magic_link"             // auth: fan/creator magic link sign-in
  | "otp"                    // auth: OTP delivery (HID-003-C)
  | "payment_receipt"        // billing: fan payment confirmation
  | "refund_confirmation"    // billing: refund outcome (HID-011-E)
  | "dunning_soft_fail"      // dunning ladder (OF-169)
  | "dunning_paused"
  | "dunning_reminder_2"
  | "dunning_reminder_3"
  | "dunning_cancelled"
  | "consent_receipt"        // privacy: consent record on file
  | "account_deletion_request"  // account: deletion grace period started
  | "account_deletion_complete"; // account: deletion confirmed

export interface EmailInput {
  to: string;
  template: EmailTemplate;
  /** Locale selection: user pref → browser Accept-Language → "en" fallback. */
  locale?: EmailLocale;
  /** Template variable substitutions. Keys match {{key}} placeholders. */
  data: Record<string, string | number | boolean>;
  replyTo?: string;
  /** Arbitrary key/value tags forwarded to provider for analytics (PostHog). */
  tags?: Record<string, string>;
}

export interface EmailResult {
  messageId: string;
  success: boolean;
  /** True when the address was in the suppression list — email not sent. */
  suppressed?: boolean;
}

export interface IEmailProvider {
  sendEmail(input: EmailInput): Promise<EmailResult>;
  /** Add an address to the suppression list (bounce / complaint / opt-out). */
  suppressAddress(
    email: string,
    reason: "bounce" | "complaint" | "unsubscribe"
  ): Promise<void>;
  /** Return true if the address is currently suppressed. */
  isSuppressed(email: string): Promise<boolean>;
}
