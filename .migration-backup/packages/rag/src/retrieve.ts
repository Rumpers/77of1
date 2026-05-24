// RAG retrieval — top-k cosine similarity search per creator
// Calls match_creator_content() SQL function (migration 005)
// Per-creator isolation is enforced by p_creator_id filter — never leaks cross-creator.

import { createClient } from "@supabase/supabase-js";
import type { IEmbeddingProvider } from "@7of1/ai-providers";

export interface RagChunk {
  id: string;
  chunkText: string;
  sourceType: string;
  similarity: number;
  createdAt: string;
}

export interface RetrieveOptions {
  creatorId: string;
  fanMessage: string;
  k?: number; // default 5
}

export interface RetrieveResult {
  chunks: RagChunk[];
  provider: string;
  latencyMs: number;
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

export async function retrieveCreatorChunks(
  opts: RetrieveOptions,
  embeddingProvider: IEmbeddingProvider
): Promise<RetrieveResult> {
  const start = Date.now();
  const k = opts.k ?? 5;

  const { embedding, provider } = await embeddingProvider.embed(opts.fanMessage);
  const db = getDb();

  const { data, error } = await db.rpc("match_creator_content", {
    query_embedding: vectorLiteral(embedding),
    p_creator_id: opts.creatorId,
    match_count: k,
  });

  if (error) {
    throw new Error(`RAG retrieval failed for creator ${opts.creatorId}: ${error.message}`);
  }

  const chunks: RagChunk[] = (data ?? []).map((row: {
    id: string;
    chunk_text: string;
    source_type: string;
    similarity: number;
    created_at: string;
  }) => ({
    id: row.id,
    chunkText: row.chunk_text,
    sourceType: row.source_type,
    similarity: row.similarity,
    createdAt: row.created_at,
  }));

  const latencyMs = Date.now() - start;
  console.log(
    `[rag:retrieve] creator=${opts.creatorId} k=${k} found=${chunks.length} latency=${latencyMs}ms provider=${provider}`
  );

  return { chunks, provider, latencyMs };
}
