-- Update search_similar_chunks to use SECURITY INVOKER instead of SECURITY DEFINER
-- This ensures the function respects RLS policies rather than bypassing them

CREATE OR REPLACE FUNCTION public.search_similar_chunks(
  query_embedding text,
  kb_id uuid,
  p_user_id uuid,
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Validate that the user owns the knowledge base
  IF NOT EXISTS (
    SELECT 1 FROM knowledge_bases 
    WHERE knowledge_bases.id = kb_id 
    AND knowledge_bases.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Knowledge base not found or access denied';
  END IF;

  RETURN QUERY
  SELECT
    dc.id,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding::vector) as similarity
  FROM document_chunks dc
  WHERE dc.knowledge_base_id = kb_id
    AND dc.embedding IS NOT NULL
    AND 1 - (dc.embedding <=> query_embedding::vector) > match_threshold
  ORDER BY dc.embedding <=> query_embedding::vector
  LIMIT match_count;
END;
$$;