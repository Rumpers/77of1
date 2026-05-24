// GMI-first outbound moderation — implements IModeratorProvider via GMI chat completions.
// Classify generated text before it reaches the fan surface.
// Env vars: GMI_API_URL (base), GMI_API_KEY, GMI_MODERATION_MODEL (default: gpt-4o-mini)
import type { IModeratorProvider, ModerationResult } from "@7of1/types";

const HARM_CATEGORIES = [
  "harassment",
  "hate_speech",
  "explicit_sexual",
  "violence",
  "self_harm",
  "spam",
] as const;

// Strict JSON-only system prompt — temperature 0 to minimise hallucination.
// Adult content between consenting creators and adult fans is platform-allowed;
// flag only genuinely harmful content (non-consensual, abuse, explicit violence, etc.).
const SYSTEM_PROMPT = `You are a content safety classifier for a creator monetization platform.
Given text, assess whether it is safe to deliver to fans.
Respond ONLY with valid JSON in this exact format (no other text):
{"passed":true,"flaggedCategories":[],"confidence":0.0}

Field definitions:
- confidence: risk score 0.0 (completely safe) to 1.0 (definitely harmful)
- flaggedCategories: array, subset of ["harassment","hate_speech","explicit_sexual","violence","self_harm","spam"]
- passed: must be true only if confidence < 0.5 AND flaggedCategories is empty

Platform context: adult content from consenting creators to consenting adult fans is permitted.
Flag only: non-consensual content, content targeting minors, real-person abuse, graphic violence, illegal acts.`;

interface GmiChatResponse {
  choices: { message: { content: string } }[];
}

interface RawClassification {
  passed?: unknown;
  flaggedCategories?: unknown;
  confidence?: unknown;
}

export class GmiModeratorProvider implements IModeratorProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string
  ) {}

  async moderate(
    text: string,
    language: "en" | "ja" | "zh-TW"
  ): Promise<ModerationResult> {
    const userContent = `Language: ${language}\nText to classify:\n${text}`;

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 128,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GMI moderation API error ${res.status}: ${body}`);
    }

    const data = (await res.json()) as GmiChatResponse;
    const raw = JSON.parse(data.choices[0].message.content) as RawClassification;

    const confidence =
      typeof raw.confidence === "number"
        ? Math.max(0, Math.min(1, raw.confidence))
        : 0.5;

    const flaggedCategories = Array.isArray(raw.flaggedCategories)
      ? (raw.flaggedCategories as string[]).filter((c) =>
          (HARM_CATEGORIES as readonly string[]).includes(c)
        )
      : [];

    // Re-derive passed from the fields to guard against LLM inconsistency
    const passed =
      typeof raw.passed === "boolean"
        ? raw.passed && confidence < 0.5 && flaggedCategories.length === 0
        : confidence < 0.5 && flaggedCategories.length === 0;

    return { passed, flaggedCategories, confidence };
  }
}

// Azure Content Safety fallback stub — implements IModeratorProvider contract.
// Swap in when GMI benchmark fails; no orchestration changes needed.
export class AzureModeratorProvider implements IModeratorProvider {
  constructor(
    private readonly endpoint: string,
    private readonly apiKey: string
  ) {}

  async moderate(
    text: string,
    _language: "en" | "ja" | "zh-TW"
  ): Promise<ModerationResult> {
    const res = await fetch(
      `${this.endpoint}/contentsafety/text:analyze?api-version=2023-10-01`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Ocp-Apim-Subscription-Key": this.apiKey,
        },
        body: JSON.stringify({
          text,
          categories: ["Hate", "SelfHarm", "Sexual", "Violence"],
          outputType: "FourSeverityLevels",
        }),
      }
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Azure Content Safety error ${res.status}: ${body}`);
    }

    interface AzureCategory {
      category: string;
      severity: number;
    }
    const data = (await res.json()) as { categoriesAnalysis: AzureCategory[] };
    const flaggedCategories: string[] = [];
    let maxSeverity = 0;

    for (const cat of data.categoriesAnalysis) {
      if (cat.severity >= 2) {
        flaggedCategories.push(cat.category.toLowerCase());
      }
      if (cat.severity > maxSeverity) maxSeverity = cat.severity;
    }

    const confidence = Math.min(1, maxSeverity / 6);
    return {
      passed: flaggedCategories.length === 0 && confidence < 0.5,
      flaggedCategories,
      confidence,
    };
  }
}

// Factory: returns GMI if env vars set, throws with CEO-escalation note if not.
// Never silently fall back — CEO must approve the gap before Azure is wired.
export function createGmiModeratorProvider(): GmiModeratorProvider {
  const baseUrl = process.env.GMI_API_URL;
  const apiKey = process.env.GMI_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error(
      "[moderator] GMI_API_URL or GMI_API_KEY not set. " +
        "GMI capability gap — escalate to CEO before switching to Azure Content Safety."
    );
  }
  const model = process.env.GMI_MODERATION_MODEL ?? "gpt-4o-mini";
  return new GmiModeratorProvider(baseUrl, apiKey, model);
}
