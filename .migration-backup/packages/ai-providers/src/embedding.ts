// Embedding provider interface — GMI first, OpenAI fallback
// vector(1536) matches text-embedding-3-small and text-embedding-ada-002

export interface EmbeddingResult {
  embedding: number[];
  tokensUsed: number;
  provider: "gmi" | "openai";
}

export interface IEmbeddingProvider {
  readonly provider: "gmi" | "openai";
  embed(text: string): Promise<EmbeddingResult>;
  healthCheck(): Promise<boolean>;
}

// GMI embedding via OpenAI-compatible API endpoint.
// Env: GMI_API_URL (base), GMI_API_KEY, GMI_EMBEDDING_MODEL
export class GmiEmbeddingAdapter implements IEmbeddingProvider {
  readonly provider = "gmi" as const;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string = "text-embedding-3-small"
  ) {}

  async embed(text: string): Promise<EmbeddingResult> {
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, input: text }),
    });
    if (!res.ok) {
      throw new Error(
        `GMI embedding failed: ${res.status} ${await res.text()}`
      );
    }
    const data = (await res.json()) as {
      data: { embedding: number[] }[];
      usage: { total_tokens: number };
    };
    return {
      embedding: data.data[0].embedding,
      tokensUsed: data.usage.total_tokens,
      provider: "gmi",
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.embed("ping");
      return true;
    } catch {
      return false;
    }
  }
}

// OpenAI text-embedding-3-small at 1536 dims (matches vector(1536) schema)
// Env: OPENAI_API_KEY
export class OpenAiEmbeddingAdapter implements IEmbeddingProvider {
  readonly provider = "openai" as const;

  constructor(
    private readonly apiKey: string,
    private readonly model: string = "text-embedding-3-small"
  ) {}

  async embed(text: string): Promise<EmbeddingResult> {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: text,
        dimensions: 1536,
      }),
    });
    if (!res.ok) {
      throw new Error(
        `OpenAI embedding failed: ${res.status} ${await res.text()}`
      );
    }
    const data = (await res.json()) as {
      data: { embedding: number[] }[];
      usage: { total_tokens: number };
    };
    return {
      embedding: data.data[0].embedding,
      tokensUsed: data.usage.total_tokens,
      provider: "openai",
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.embed("ping");
      return true;
    } catch {
      return false;
    }
  }
}

// Factory: GMI if env vars present, else OpenAI.
// Escalate to CEO if GMI_API_URL is not set — that signals an unresolved GMI capability gap.
export function createEmbeddingProvider(): IEmbeddingProvider {
  const gmiUrl = process.env.GMI_API_URL;
  const gmiKey = process.env.GMI_API_KEY;
  if (gmiUrl && gmiKey) {
    const model = process.env.GMI_EMBEDDING_MODEL ?? "text-embedding-3-small";
    return new GmiEmbeddingAdapter(gmiUrl, gmiKey, model);
  }
  // GMI gap: falling back to OpenAI — flag this to CEO
  console.warn(
    "[embedding] GMI_API_URL/GMI_API_KEY not set — using OpenAI fallback. " +
      "GMI capability gap must be surfaced to CEO per provider strategy."
  );
  const openAiKey = process.env.OPENAI_API_KEY ?? "";
  return new OpenAiEmbeddingAdapter(openAiKey);
}
