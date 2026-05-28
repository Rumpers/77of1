// Provider error taxonomy + moderation result shape.
//
// Moved to twin-runtime in plan 02-06a as a Rule 3 (blocking) deviation:
// `moderation.ts` consumes these types/classes, so they must travel with it
// into the shared package. api-server's `providers/interfaces.ts` re-exports
// these symbols so `instanceof ProviderError` continues to work across both
// the api-server provider code path and twin-runtime's moderation pipeline.
//
// IMPORTANT: there is exactly ONE source of truth for these classes
// (this file). api-server must re-export them, NOT redeclare them — class
// identity matters for the `instanceof` check in `routes/twin.ts`.

export interface ModerationResult {
  flagged: boolean;
  categories: string[];           // category names whose `categories[<name>]` is true
  scores: Record<string, number>; // raw OpenAI category_scores map
  primaryCategory: string | null; // highest-scoring flagged category, or null
}

export interface IModeratorProvider {
  readonly modelId: string;
  moderate(text: string): Promise<ModerationResult>;
}

// Non-retryable — 4xx from provider (bad request, invalid model, auth failure)
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly provider?: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

// Retryable — 5xx from provider (server error, rate limit, temporary outage)
// BullMQ workers should treat this as a signal to retry with backoff.
export class ProviderTransientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly provider?: string,
  ) {
    super(message);
    this.name = "ProviderTransientError";
  }
}
