// RAG retrieval — fetches per-creator corpus chunks via pgvector cosine similarity.
// Uses the match_creator_content SQL function (migration 005_rag_retrieval_fn.sql).

export interface RagDbClient {
  rpc(
    fn: string,
    params: Record<string, unknown>
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

// Minimal interface so this package doesn't need a hard dep on @7of1/ai-providers.
// The concrete GmiEmbeddingAdapter from that package satisfies this shape.
export interface EmbedProvider {
  embed(text: string): Promise<{ embedding: number[] }>;
}

export interface RagChunk {
  id: string;
  chunk_text: string;
  source_type: string;
  similarity: number;
}

export async function retrieveRagChunks(
  db: RagDbClient,
  embedding: EmbedProvider,
  creatorId: string,
  topic: string,
  topK = 5
): Promise<string[]> {
  const result = await embedding.embed(topic);
  const { data, error } = await db.rpc("match_creator_content", {
    query_embedding: result.embedding,
    p_creator_id: creatorId,
    match_count: topK,
  });
  if (error) throw new Error(`RAG retrieval failed: ${error.message}`);
  return ((data as RagChunk[]) ?? []).map((r) => r.chunk_text);
}
