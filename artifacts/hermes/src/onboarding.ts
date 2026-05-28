// Onboarding Step 2 — persona exercise completed → RAG ingest
// Triggered when a creator finishes the persona exercise flow.
// Embeds persona fields and stores them in creator_content_embeddings.
//
// Note: embedding + RAG helpers are inlined here since packages/ai-providers
// and packages/rag do not have source in the new Replit workspace layout yet.
//
// PHASE-1 STUB: creator_personas and creator_content_embeddings are not in
// the Phase 1 @workspace/db schema. All DB calls in this file that reference
// those tables are replaced with logged stubs. Wire in Phase 2 when the schema
// is extended.

// ── Embedding provider ─────────────────────────────────────────────────────

interface EmbeddingResult {
  embedding: number[];
  tokensUsed: number;
  provider: "gmi" | "openai";
}

interface IEmbeddingProvider {
  readonly provider: "gmi" | "openai";
  embed(text: string): Promise<EmbeddingResult>;
}

class GmiEmbeddingAdapter implements IEmbeddingProvider {
  readonly provider = "gmi" as const;
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string = "text-embedding-3-small"
  ) {}
  async embed(text: string): Promise<EmbeddingResult> {
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, input: text }),
    });
    if (!res.ok) throw new Error(`GMI embedding failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { data: { embedding: number[] }[]; usage: { total_tokens: number } };
    return { embedding: data.data[0].embedding, tokensUsed: data.usage.total_tokens, provider: "gmi" };
  }
}

class OpenAiEmbeddingAdapter implements IEmbeddingProvider {
  readonly provider = "openai" as const;
  constructor(private readonly apiKey: string, private readonly model: string = "text-embedding-3-small") {}
  async embed(text: string): Promise<EmbeddingResult> {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, input: text, dimensions: 1536 }),
    });
    if (!res.ok) throw new Error(`OpenAI embedding failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { data: { embedding: number[] }[]; usage: { total_tokens: number } };
    return { embedding: data.data[0].embedding, tokensUsed: data.usage.total_tokens, provider: "openai" };
  }
}

function createEmbeddingProvider(): IEmbeddingProvider {
  const gmiUrl = process.env.GMI_API_URL;
  const gmiKey = process.env.GMI_API_KEY;
  if (gmiUrl && gmiKey) {
    const model = process.env.GMI_EMBEDDING_MODEL ?? "text-embedding-3-small";
    return new GmiEmbeddingAdapter(gmiUrl, gmiKey, model);
  }
  console.warn("[embedding] GMI_API_URL/GMI_API_KEY not set — using OpenAI fallback");
  return new OpenAiEmbeddingAdapter(process.env.OPENAI_API_KEY ?? "");
}

// ── RAG ingest ─────────────────────────────────────────────────────────────

interface TextChunk { text: string; sourceType: string; index: number }

function chunkText(text: string, sourceType: string, maxTokens = 400, overlapTokens = 50): TextChunk[] {
  const maxWords = Math.floor(maxTokens * 0.75);
  const overlapWords = Math.floor(overlapTokens * 0.75);
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const chunks: TextChunk[] = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + maxWords, words.length);
    const chunk = words.slice(start, end).join(" ");
    if (chunk.trim()) chunks.push({ text: chunk, sourceType, index: chunks.length });
    if (end >= words.length) break;
    start = end - overlapWords;
  }
  return chunks;
}

interface IngestResult {
  creatorId: string;
  chunksIngested: number;
  provider: string;
  sourceType: string;
}

async function ingestCreatorContent(
  input: { creatorId: string; content: string; sourceType: string },
  embeddingProvider: IEmbeddingProvider
): Promise<IngestResult> {
  const chunks = chunkText(input.content, input.sourceType);
  let ingested = 0;
  for (const chunk of chunks) {
    const { tokensUsed } = await embeddingProvider.embed(chunk.text);
    // PHASE-1 STUB: creator_content_embeddings not in @workspace/db — out of Phase 1 schema scope
    console.log(`[hermes] STUB: creator_content_embeddings insert deferred to Phase 2 — out of Phase 1 schema scope`);
    console.log(`[rag:ingest] creator=${input.creatorId} chunk=${chunk.index} tokens=${tokensUsed} provider=${embeddingProvider.provider}`);
    ingested++;
  }
  return { creatorId: input.creatorId, chunksIngested: ingested, provider: embeddingProvider.provider, sourceType: input.sourceType };
}

async function ingestPersonaExercise(
  creatorId: string,
  personaFields: Record<string, string>,
  embeddingProvider: IEmbeddingProvider
): Promise<IngestResult[]> {
  const results: IngestResult[] = [];
  for (const [field, value] of Object.entries(personaFields)) {
    if (!value?.trim()) continue;
    const result = await ingestCreatorContent(
      { creatorId, content: `[${field}] ${value}`, sourceType: "persona_exercise" },
      embeddingProvider
    );
    results.push(result);
  }
  return results;
}

// ── Public API ─────────────────────────────────────────────────────────────

export interface OnboardingIngestResult {
  creatorId: string;
  totalChunks: number;
  provider: string;
}

// Called after persona exercise is completed (Step 2 of onboarding).
// Loads persona from DB and ingests all fields into the RAG index.
export async function triggerPersonaRagIngest(
  creatorId: string
): Promise<OnboardingIngestResult> {
  // PHASE-1 STUB: creator_personas not in @workspace/db — out of Phase 1 schema scope
  console.log(`[hermes] STUB: creator_personas select deferred to Phase 2 — out of Phase 1 schema scope`);

  // Use empty persona fields for the stub — embeddings will also be stubbed
  const personaFields: Record<string, string> = {
    greeting_style: "",
    fan_endearment: "",
    treatment_style: "",
    personality_traits: "",
    message_style: "",
    bounds: "",
  };

  const embeddingProvider = createEmbeddingProvider();
  const results = await ingestPersonaExercise(creatorId, personaFields, embeddingProvider);

  const totalChunks = results.reduce((sum, r) => sum + r.chunksIngested, 0);
  const provider = results[0]?.provider ?? embeddingProvider.provider;

  console.log(`[onboarding] persona RAG ingest complete creator=${creatorId} chunks=${totalChunks} provider=${provider}`);

  return { creatorId, totalChunks, provider };
}
