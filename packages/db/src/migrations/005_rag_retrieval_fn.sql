-- OF-61: RAG retrieval function for per-creator similarity search
-- Uses pgvector cosine distance (<=>)
-- Called via supabase.rpc('match_creator_content', { ... })

create or replace function match_creator_content(
  query_embedding vector(1536),
  p_creator_id    uuid,
  match_count     int default 5
)
returns table (
  id          uuid,
  chunk_text  text,
  source_type text,
  similarity  float,
  created_at  timestamptz
)
language sql
stable
security definer
as $$
  select
    id,
    chunk_text,
    source_type,
    1 - (embedding <=> query_embedding) as similarity,
    created_at
  from creator_content_embeddings
  where creator_id = p_creator_id
    and embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;
