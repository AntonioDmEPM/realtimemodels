-- Drop the existing function first
DROP FUNCTION IF EXISTS public.search_similar_chunks(vector, uuid, uuid, double precision, integer);

-- Create knowledge_documents table to track uploaded documents
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  knowledge_base_id UUID NOT NULL REFERENCES public.knowledge_bases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  upload_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create knowledge_chunks table to store document chunks with embeddings
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  knowledge_base_id UUID NOT NULL REFERENCES public.knowledge_bases(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx ON public.knowledge_chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create index for knowledge_base_id lookups
CREATE INDEX IF NOT EXISTS knowledge_chunks_kb_id_idx ON public.knowledge_chunks(knowledge_base_id);
CREATE INDEX IF NOT EXISTS knowledge_documents_kb_id_idx ON public.knowledge_documents(knowledge_base_id);

-- Enable Row Level Security
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for knowledge_documents
CREATE POLICY "Users can view their own documents"
  ON public.knowledge_documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own documents"
  ON public.knowledge_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents"
  ON public.knowledge_documents FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents"
  ON public.knowledge_documents FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for knowledge_chunks
CREATE POLICY "Users can view their own chunks"
  ON public.knowledge_chunks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own chunks"
  ON public.knowledge_chunks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chunks"
  ON public.knowledge_chunks FOR DELETE
  USING (auth.uid() = user_id);

-- Create the search_similar_chunks function
CREATE OR REPLACE FUNCTION public.search_similar_chunks(
  query_embedding vector(1536),
  kb_id UUID,
  p_user_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  similarity FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify user owns the knowledge base
  IF NOT EXISTS (
    SELECT 1 FROM knowledge_bases 
    WHERE knowledge_bases.id = kb_id AND knowledge_bases.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied to knowledge base';
  END IF;

  RETURN QUERY
  SELECT
    kc.id,
    kc.content,
    1 - (kc.embedding <=> query_embedding) AS similarity,
    kc.metadata
  FROM knowledge_chunks kc
  WHERE kc.knowledge_base_id = kb_id
    AND kc.user_id = p_user_id
    AND 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;