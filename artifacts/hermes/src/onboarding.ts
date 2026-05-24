// Onboarding Step 2 — persona exercise completed → RAG ingest
// Triggered when a creator finishes the persona exercise flow.
// Embeds persona fields and stores them in creator_content_embeddings.
//
// Note: embedding + RAG helpers are inlined here since packages/ai-providers
// and packages/rag do not have source in the new Replit workspace layout yet.

import { createClient } from "@supabase/supabase-js";

function getDb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  return createClient(url, key);
}

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
  const db = getDb();
  const chunks = chunkText(input.content, input.sourceType);
  let ingested = 0;
  for (const chunk of chunks) {
    const { embedding, tokensUsed } = await embeddingProvider.embed(chunk.text);
    const { error } = await db.from("creator_content_embeddings").insert({
      creator_id: input.creatorId,
      chunk_text: chunk.text,
      embedding: `[${embedding.join(",")}]`,
      source_type: chunk.sourceType,
    });
    if (error) throw new Error(`Failed to insert embedding chunk ${chunk.index} for creator ${input.creatorId}: ${error.message}`);
    ingested++;
    console.log(`[rag:ingest] creator=${input.creatorId} chunk=${chunk.index} tokens=${tokensUsed} provider=${embeddingProvider.provider}`);
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
  const db = getDb();

  const { data: persona, error } = await db
    .from("creator_personas")
    .select("greeting_style, fan_endearment, treatment_style, personality_traits, message_style, bounds")
    .eq("creator_id", creatorId)
    .maybeSingle();

  if (error) throw new Error(`Persona load failed: ${error.message}`);
  if (!persona) throw new Error(`No persona found for creator ${creatorId}`);

  const personaFields: Record<string, string> = {
    greeting_style: (persona as Record<string, unknown>).greeting_style as string ?? "",
    fan_endearment: (persona as Record<string, unknown>).fan_endearment as string ?? "",
    treatment_style: (persona as Record<string, unknown>).treatment_style as string ?? "",
    personality_traits: Array.isArray((persona as Record<string, unknown>).personality_traits)
      ? ((persona as Record<string, unknown>).personality_traits as string[]).join(". ")
      : "",
    message_style: (persona as Record<string, unknown>).message_style as string ?? "",
    bounds: Array.isArray((persona as Record<string, unknown>).bounds)
      ? ((persona as Record<string, unknown>).bounds as string[]).join(". ")
      : "",
  };

  const embeddingProvider = createEmbeddingProvider();
  const results = await ingestPersonaExercise(creatorId, personaFields, embeddingProvider);

  const totalChunks = results.reduce((sum, r) => sum + r.chunksIngested, 0);
  const provider = results[0]?.provider ?? embeddingProvider.provider;

  console.log(`[onboarding] persona RAG ingest complete creator=${creatorId} chunks=${totalChunks} provider=${provider}`);

  return { creatorId, totalChunks, provider };
}
