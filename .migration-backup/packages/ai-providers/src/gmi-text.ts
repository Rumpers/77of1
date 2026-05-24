// GMI text provider — OF-62
// Implements ITextProvider using GMI's inference endpoint (api.gmi-serving.com).
// Default model: DeepSeek-V3.2 — strong multilingual (EN/JA/ZH-TW), GMI-first policy.
//
// System prompt is built by the persona builder (OF-62) and passed via TextContext.
// This adapter assembles the final GMI request: systemPrompt + RAG chunks + fan message.
//
// Hard-stop enforcement lives at the dispatch layer (apps/worker/src/text-dispatch.ts)
// where the forbidden topic list is available. This adapter is a clean transport only.

import type { ITextProvider, TextContext, TextResponse } from "@7of1/types";

const GMI_BASE_URL = "https://api.gmi-serving.com/v1";
// DeepSeek-V3.2: strong multilingual (EN/JA/ZH-TW), cost-efficient on GMI infra.
const DEFAULT_MODEL = "deepseek-ai/DeepSeek-V3.2";

interface GMIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GMICompletionResponse {
  choices: Array<{ message: { role: string; content: string }; finish_reason: string }>;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  model: string;
}

function buildFinalSystem(ctx: TextContext): string {
  const parts = [ctx.systemPrompt];
  if (ctx.ragChunks.length > 0) {
    parts.push(
      "\n\nRelevant context (use naturally, do not recite verbatim):\n" +
        ctx.ragChunks.map((c, i) => `[${i + 1}] ${c}`).join("\n")
    );
  }
  return parts.join("");
}

export class GmiTextProvider implements ITextProvider {
  readonly modelId: string;

  constructor(
    private readonly apiKey: string,
    modelId?: string,
    private readonly baseUrl: string = GMI_BASE_URL
  ) {
    this.modelId = modelId ?? DEFAULT_MODEL;
    if (!this.apiKey) {
      throw new Error(
        "GMI_API_KEY is required. Set it via Replit Secrets or env var."
      );
    }
  }

  async generate(prompt: string, context: TextContext): Promise<TextResponse> {
    const messages: GMIMessage[] = [
      { role: "system", content: buildFinalSystem(context) },
      { role: "user", content: prompt },
    ];

    const startMs = Date.now();

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelId,
        messages,
        max_tokens: 512,
        temperature: 0.85,
      }),
    });

    const latencyMs = Date.now() - startMs;

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GMI API error ${res.status}: ${body}`);
    }

    const data = (await res.json()) as GMICompletionResponse;
    const text = data.choices[0]?.message?.content ?? "";
    const tokensUsed = data.usage?.total_tokens ?? 0;

    return { text, latencyMs, tokensUsed, modelId: data.model ?? this.modelId };
  }
}

// createGmiTextProvider: factory with GMI-first check.
// Logs CEO-escalation warning if GMI_API_KEY is not configured.
export function createGmiTextProvider(): ITextProvider {
  const apiKey = process.env.GMI_API_KEY;

  if (!apiKey) {
    // GMI gap — must surface to CEO (PRD §15). Never silent-fallback.
    console.warn(
      "[gmi-text] GMI_API_KEY not set — no text provider available. " +
        "This GMI capability gap MUST be escalated to CEO per PRD §15."
    );
    throw new Error(
      "GMI_API_KEY is required. Escalate GMI capability gap to CEO before using an external fallback."
    );
  }

  const model = process.env.GMI_TEXT_MODEL ?? DEFAULT_MODEL;
  return new GmiTextProvider(apiKey, model);
}
