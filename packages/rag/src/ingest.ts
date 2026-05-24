// RAG ingestion pipeline — creator content → chunks → embed → store in pgvector
// Called after onboarding Step 2 (persona exercise completed) and whenever new
// creator content arrives (captions, posts, etc.)

import { createClient } from "@supabase/supabase-js";
import type { IEmbeddingProvider } from "@7of1/ai-providers";
import { chunkText } from "./chunk.js";

export interface IngestInput {
  creatorId: string;
  content: string;
  sourceType: "persona_exercise" | "caption" | "post" | "bio";
}

export interface IngestResult {
  creatorId: string;
  chunksIngested: number;
  provider: string;
  sourceType: string;
}

function getDb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  return createClient(url, key);
}

function vectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export async function ingestCreatorContent(
  input: IngestInput,
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
      embedding: vectorLiteral(embedding),
      source_type: chunk.sourceType,
    });

    if (error) {
      throw new Error(
        `Failed to insert embedding chunk ${chunk.index} for creator ${input.creatorId}: ${error.message}`
      );
    }
    ingested++;

    // Log token usage for cost tracking
    console.log(
      `[rag:ingest] creator=${input.creatorId} chunk=${chunk.index} tokens=${tokensUsed} provider=${embeddingProvider.provider}`
    );
  }

  return {
    creatorId: input.creatorId,
    chunksIngested: ingested,
    provider: embeddingProvider.provider,
    sourceType: input.sourceType,
  };
}

// Convenience: ingest all fields from a persona exercise at once
export async function ingestPersonaExercise(
  creatorId: string,
  personaFields: Record<string, string>,
  embeddingProvider: IEmbeddingProvider
): Promise<IngestResult[]> {
  const results: IngestResult[] = [];

  for (const [field, value] of Object.entries(personaFields)) {
    if (!value?.trim()) continue;
    // Tag each field with the field name as part of source_type for provenance
    const content = `[${field}] ${value}`;
    const result = await ingestCreatorContent(
      { creatorId, content, sourceType: "persona_exercise" },
      embeddingProvider
    );
    results.push(result);
  }

  return results;
}
