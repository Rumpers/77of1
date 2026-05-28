// OpenAI omni-moderation-latest provider — Phase 2 L1/L3 safety surface.
// Pattern mirrors GmiTextProvider (PATTERNS S3, A6): env-keyed constructor,
// fetch-based POST, ProviderError / ProviderTransientError taxonomy, optional
// Helicone observability routing.
//
// CLAUDE.md mandate: OpenAI is used ONLY for moderation, not for LLM text
// generation. GMI Cloud is the LLM mandate; OpenAI is the moderation mandate.

import type {
  IModeratorProvider,
  ModerationResult,
} from "../interfaces.js";
import { ProviderError, ProviderTransientError } from "../interfaces.js";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const HELICONE_OPENAI_BASE_URL = "https://oai.helicone.ai/v1";
const MODEL_ID = "omni-moderation-latest";

interface OpenAIModerationResponse {
  id: string;
  model: string;
  results: Array<{
    flagged: boolean;
    categories: Record<string, boolean>;
    category_scores: Record<string, number>;
  }>;
}

export class OpenAiModeratorProvider implements IModeratorProvider {
  readonly modelId = MODEL_ID;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly heliconeApiKey: string | undefined;

  constructor(opts?: {
    apiKey?: string;
    baseUrl?: string;
    heliconeApiKey?: string;
  }) {
    this.apiKey = opts?.apiKey ?? process.env["OPENAI_API_KEY"] ?? "";
    if (!this.apiKey) {
      throw new Error(
        "OPENAI_API_KEY is required for moderation. Set it in Replit Secrets or the OPENAI_API_KEY env var.",
      );
    }
    this.heliconeApiKey =
      opts?.heliconeApiKey ?? process.env["HELICONE_API_KEY"];

    // Helicone routes via its own OpenAI-compatible proxy URL when enabled.
    const defaultBase = this.heliconeApiKey
      ? HELICONE_OPENAI_BASE_URL
      : DEFAULT_OPENAI_BASE_URL;
    this.baseUrl = opts?.baseUrl ?? defaultBase;
  }

  async moderate(text: string): Promise<ModerationResult> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };

    if (this.heliconeApiKey) {
      headers["Helicone-Auth"] = `Bearer ${this.heliconeApiKey}`;
      headers["Helicone-Property-Pipeline"] = "moderation";
    }

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/moderations`, {
        method: "POST",
        headers,
        body: JSON.stringify({ model: this.modelId, input: text }),
      });
    } catch (err) {
      throw new ProviderTransientError(
        `OpenAI network error: ${(err as Error).message}`,
        undefined,
        "openai",
      );
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const msg = `OpenAI API error: ${res.status} ${res.statusText} — ${body}`;
      if (res.status >= 500) {
        throw new ProviderTransientError(msg, res.status, "openai");
      }
      throw new ProviderError(msg, res.status, "openai");
    }

    const data = (await res.json()) as OpenAIModerationResponse;
    const result = data.results?.[0];
    if (!result) {
      // Defensive — OpenAI always returns one result per input, but fall back
      // to a non-flagged shape rather than throwing if the contract changes.
      return {
        flagged: false,
        categories: [],
        scores: {},
        primaryCategory: null,
      };
    }

    const flaggedCategories: string[] = Object.entries(result.categories ?? {})
      .filter(([, v]) => v === true)
      .map(([k]) => k);

    // Highest-scoring flagged category — used to pick the deflection string.
    let primaryCategory: string | null = null;
    let highestScore = -1;
    for (const cat of flaggedCategories) {
      const score = result.category_scores?.[cat] ?? 0;
      if (score > highestScore) {
        highestScore = score;
        primaryCategory = cat;
      }
    }

    return {
      flagged: result.flagged === true,
      categories: flaggedCategories,
      scores: result.category_scores ?? {},
      primaryCategory,
    };
  }
}
