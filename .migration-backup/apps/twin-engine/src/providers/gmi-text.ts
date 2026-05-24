import type { ITextProvider, TextContext, TextResponse } from "@7of1/types";

const GMI_BASE_URL = "https://api.gmi-serving.com/v1";
// DeepSeek-V3.2 via GMI inference — strong multilingual (EN/JA/ZH-TW), cost-efficient,
// served on GMI's own infrastructure (GMI-first rule satisfied).
const DEFAULT_MODEL = "deepseek-ai/DeepSeek-V3.2";

interface GMIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GMICompletionResponse {
  id: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

function buildSystemPrompt(ctx: TextContext): string {
  const langLabel: Record<TextContext["language"], string> = {
    en: "English",
    ja: "Japanese",
    "zh-TW": "Traditional Chinese",
  };

  const intensityNote: Record<TextContext["intensityDial"], string> = {
    warm:
      "Keep the tone warm, friendly, and appropriate for all fans. Avoid explicit content.",
    intimate:
      "The fan has unlocked a more personal tier. Be warmer and more personal but stay tasteful.",
    explicit:
      "The fan has granted explicit consent. Adult content is permitted within creator bounds.",
  };

  const parts = [
    ctx.systemPrompt,
    `\nReply exclusively in ${langLabel[ctx.language]}.`,
    `\nTone guidance: ${intensityNote[ctx.intensityDial]}`,
  ];

  if (ctx.ragChunks.length > 0) {
    parts.push(
      "\n\nRelevant context about you (use naturally, do not recite verbatim):\n" +
        ctx.ragChunks.map((c, i) => `[${i + 1}] ${c}`).join("\n")
    );
  }

  return parts.join("");
}

export class GMITextProvider implements ITextProvider {
  readonly modelId: string;
  private readonly apiKey: string;

  constructor(options?: { modelId?: string; apiKey?: string }) {
    this.modelId = options?.modelId ?? DEFAULT_MODEL;
    this.apiKey = options?.apiKey ?? process.env["GMI_API_KEY"] ?? "";
    if (!this.apiKey) {
      throw new Error(
        "GMI_API_KEY is required. Set it via Replit Secrets or the GMI_API_KEY environment variable."
      );
    }
  }

  async generate(prompt: string, context: TextContext): Promise<TextResponse> {
    const messages: GMIMessage[] = [
      { role: "system", content: buildSystemPrompt(context) },
      { role: "user", content: prompt },
    ];

    const startMs = Date.now();

    const res = await fetch(`${GMI_BASE_URL}/chat/completions`, {
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
      throw new Error(
        `GMI API error: ${res.status} ${res.statusText} — ${body}`
      );
    }

    const data = (await res.json()) as GMICompletionResponse;
    const text = data.choices[0]?.message?.content ?? "";
    const tokensUsed = data.usage?.total_tokens ?? 0;

    return { text, latencyMs, tokensUsed, modelId: data.model ?? this.modelId };
  }
}
