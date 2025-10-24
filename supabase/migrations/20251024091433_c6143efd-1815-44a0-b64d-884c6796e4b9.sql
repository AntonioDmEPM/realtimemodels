-- Fix ambiguous column reference in search_similar_chunks function
DROP FUNCTION IF EXISTS public.search_similar_chunks(vector, uuid, uuid, double precision, integer);

CREATE OR REPLACE FUNCTION public.search_similar_chunks(
  query_embedding vector,
  kb_id uuid,
  p_user_id uuid,
  match_threshold double precision DEFAULT 0.7,
  match_count integer DEFAULT 5
)
RETURNS TABLE(
  id uuid,
  document_id uuid,
  content text,
  similarity double precision,
  metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    document_chunks.id,
    document_chunks.document_id,
    document_chunks.content,
    1 - (document_chunks.embedding <=> query_embedding) AS similarity,
    document_chunks.metadata
  FROM document_chunks
  WHERE document_chunks.knowledge_base_id = kb_id
    -- Validate ownership: Only return chunks if knowledge base belongs to the user
    AND EXISTS (
      SELECT 1 FROM knowledge_bases
      WHERE knowledge_bases.id = kb_id AND knowledge_bases.user_id = p_user_id
    )
    AND 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY document_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;