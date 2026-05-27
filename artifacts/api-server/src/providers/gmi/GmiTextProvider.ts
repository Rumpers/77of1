// GMI Inference API text provider — Platform scaffold (OF-108)
// AI Engineer owns orchestration logic on top; Platform owns HTTP client,
// error handling, cost tracking, and Helicone observability headers.

import type {
  ITextProvider,
  TextGenerationInput,
  TextGenerationResult,
  CostEstimate,
} from "../interfaces.js";
import { ProviderError, ProviderTransientError } from "../interfaces.js";

const DEFAULT_GMI_BASE_URL = "https://api.gmi-serving.com/v1";
const MODEL_ID = "deepseek-ai/DeepSeek-V3.2";
// GMI DeepSeek-V3.2 pricing: $0.00069 per 1k tokens (input+output combined)
const GMI_RATE_PER_1K_TOKENS = 0.00069;
const DEFAULT_MAX_TOKENS = 512;

interface GmiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GmiCompletionResponse {
  id: string;
  model: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class GmiTextProvider implements ITextProvider {
  readonly modelId = MODEL_ID;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly heliconeApiKey: string | undefined;

  constructor(opts?: {
    apiKey?: string;
    baseUrl?: string;
    heliconeApiKey?: string;
  }) {
    this.apiKey = opts?.apiKey ?? process.env["GMI_API_KEY"] ?? "";
    if (!this.apiKey) {
      throw new Error(
        "GMI_API_KEY is required. Set it in Replit Secrets or the GMI_API_KEY env var."
      );
    }
    this.baseUrl =
      opts?.baseUrl ??
      process.env["GMI_API_BASE_URL"] ??
      DEFAULT_GMI_BASE_URL;
    this.heliconeApiKey =
      opts?.heliconeApiKey ?? process.env["HELICONE_API_KEY"];
  }

  async generateText(input: TextGenerationInput): Promise<TextGenerationResult> {
    const { creatorId, fanId, messages, systemPrompt, ragContext, maxTokens } =
      input;

    const gmiMessages: GmiMessage[] = [
      { role: "system", content: buildSystemMessage(systemPrompt, ragContext) },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };

    if (this.heliconeApiKey) {
      headers["Helicone-Auth"] = `Bearer ${this.heliconeApiKey}`;
      headers["Helicone-Property-creator-id"] = creatorId;
      headers["Helicone-Property-fan-id"] = fanId;
    }

    const startMs = Date.now();

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: this.modelId,
          messages: gmiMessages,
          max_tokens: maxTokens ?? DEFAULT_MAX_TOKENS,
          temperature: 0.85,
        }),
      });
    } catch (err) {
      // Network-level failure — treat as transient so BullMQ can retry
      throw new ProviderTransientError(
        `GMI network error: ${(err as Error).message}`,
        undefined,
        "gmi"
      );
    }

    const latencyMs = Date.now() - startMs;

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const msg = `GMI API error: ${res.status} ${res.statusText} — ${body}`;

      if (res.status >= 500) {
        throw new ProviderTransientError(msg, res.status, "gmi");
      }
      throw new ProviderError(msg, res.status, "gmi");
    }

    const data = (await res.json()) as GmiCompletionResponse;
    const content = data.choices[0]?.message?.content ?? "";
    const tokensUsed = data.usage?.total_tokens ?? 0;

    return {
      content,
      tokensUsed,
      modelId: data.model ?? this.modelId,
      latencyMs,
    };
  }

  estimateCost(input: TextGenerationInput): CostEstimate {
    // Token estimation: ~4 chars per token for LLM text
    const systemMsg = buildSystemMessage(
      input.systemPrompt,
      input.ragContext
    );
    const allText =
      systemMsg + input.messages.map((m) => m.content).join(" ");
    const inputTokens = Math.ceil(allText.length / 4);
    const outputTokens = input.maxTokens ?? DEFAULT_MAX_TOKENS;
    const totalTokens = inputTokens + outputTokens;

    return {
      inputTokens,
      outputTokens,
      estimatedCostUsd: (totalTokens / 1000) * GMI_RATE_PER_1K_TOKENS,
    };
  }
}

function buildSystemMessage(
  systemPrompt: string,
  ragContext: string | undefined
): string {
  if (!ragContext) return systemPrompt;
  return `${systemPrompt}\n\nRelevant context (use naturally, do not recite verbatim):\n${ragContext}`;
}
