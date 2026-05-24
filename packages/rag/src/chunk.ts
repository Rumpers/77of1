// Text chunking for RAG ingestion
// Simple word-boundary chunking with overlap; no external tokenizer dependency.
// Heuristic: ~0.75 words per token. Targeting ~400-token chunks with 50-token overlap.

export interface TextChunk {
  text: string;
  sourceType: string;
  index: number;
}

const WORDS_PER_TOKEN = 0.75;

export function chunkText(
  text: string,
  sourceType: string,
  maxTokens = 400,
  overlapTokens = 50
): TextChunk[] {
  const maxWords = Math.floor(maxTokens * WORDS_PER_TOKEN);
  const overlapWords = Math.floor(overlapTokens * WORDS_PER_TOKEN);

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const chunks: TextChunk[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + maxWords, words.length);
    const chunk = words.slice(start, end).join(" ");
    if (chunk.trim()) {
      chunks.push({ text: chunk, sourceType, index: chunks.length });
    }
    if (end >= words.length) break;
    start = end - overlapWords;
  }

  return chunks;
}
