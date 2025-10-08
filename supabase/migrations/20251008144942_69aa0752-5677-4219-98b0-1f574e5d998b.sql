-- Fix security warnings by recreating functions with proper search_path

-- Drop and recreate update_updated_at_column with CASCADE to handle dependencies
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate triggers that were dropped
CREATE TRIGGER update_knowledge_bases_updated_at
  BEFORE UPDATE ON public.knowledge_bases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Fix search_similar_chunks function
DROP FUNCTION IF EXISTS search_similar_chunks(vector, UUID, FLOAT, INT);

CREATE OR REPLACE FUNCTION public.search_similar_chunks(
  query_embedding vector(1536),
  kb_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  similarity FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    AND 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY document_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Fix update_sessions_updated_at function
DROP FUNCTION IF EXISTS public.update_sessions_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION public.update_sessions_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate sessions trigger
CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sessions_updated_at();