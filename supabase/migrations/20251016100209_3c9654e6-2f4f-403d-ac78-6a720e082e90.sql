-- Create tables for GraphRAG knowledge base system

-- Graph knowledge bases table
CREATE TABLE IF NOT EXISTS public.graph_knowledge_bases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Graph documents table
CREATE TABLE IF NOT EXISTS public.graph_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  graph_knowledge_base_id UUID NOT NULL REFERENCES public.graph_knowledge_bases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  error_message TEXT,
  entity_count INTEGER DEFAULT 0,
  relationship_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Graph entities table (nodes in the graph)
CREATE TABLE IF NOT EXISTS public.graph_entities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  graph_knowledge_base_id UUID NOT NULL REFERENCES public.graph_knowledge_bases(id) ON DELETE CASCADE,
  graph_document_id UUID NOT NULL REFERENCES public.graph_documents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  properties JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Graph relationships table (edges in the graph)
CREATE TABLE IF NOT EXISTS public.graph_relationships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  graph_knowledge_base_id UUID NOT NULL REFERENCES public.graph_knowledge_bases(id) ON DELETE CASCADE,
  graph_document_id UUID NOT NULL REFERENCES public.graph_documents(id) ON DELETE CASCADE,
  source_entity_id UUID NOT NULL REFERENCES public.graph_entities(id) ON DELETE CASCADE,
  target_entity_id UUID NOT NULL REFERENCES public.graph_entities(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  description TEXT,
  properties JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.graph_knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_relationships ENABLE ROW LEVEL SECURITY;

-- RLS policies for graph_knowledge_bases
CREATE POLICY "Users can view their own graph knowledge bases"
  ON public.graph_knowledge_bases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own graph knowledge bases"
  ON public.graph_knowledge_bases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own graph knowledge bases"
  ON public.graph_knowledge_bases FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own graph knowledge bases"
  ON public.graph_knowledge_bases FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for graph_documents
CREATE POLICY "Users can view their own graph documents"
  ON public.graph_documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own graph documents"
  ON public.graph_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own graph documents"
  ON public.graph_documents FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own graph documents"
  ON public.graph_documents FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for graph_entities
CREATE POLICY "Users can view entities from their graph documents"
  ON public.graph_entities FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.graph_documents
    WHERE graph_documents.id = graph_entities.graph_document_id
    AND graph_documents.user_id = auth.uid()
  ));

CREATE POLICY "Users can create entities for their graph documents"
  ON public.graph_entities FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.graph_documents
    WHERE graph_documents.id = graph_entities.graph_document_id
    AND graph_documents.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete entities from their graph documents"
  ON public.graph_entities FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.graph_documents
    WHERE graph_documents.id = graph_entities.graph_document_id
    AND graph_documents.user_id = auth.uid()
  ));

-- RLS policies for graph_relationships
CREATE POLICY "Users can view relationships from their graph documents"
  ON public.graph_relationships FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.graph_documents
    WHERE graph_documents.id = graph_relationships.graph_document_id
    AND graph_documents.user_id = auth.uid()
  ));

CREATE POLICY "Users can create relationships for their graph documents"
  ON public.graph_relationships FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.graph_documents
    WHERE graph_documents.id = graph_relationships.graph_document_id
    AND graph_documents.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete relationships from their graph documents"
  ON public.graph_relationships FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.graph_documents
    WHERE graph_documents.id = graph_relationships.graph_document_id
    AND graph_documents.user_id = auth.uid()
  ));

-- Create indexes for better query performance
CREATE INDEX idx_graph_documents_graph_kb ON public.graph_documents(graph_knowledge_base_id);
CREATE INDEX idx_graph_entities_graph_kb ON public.graph_entities(graph_knowledge_base_id);
CREATE INDEX idx_graph_entities_document ON public.graph_entities(graph_document_id);
CREATE INDEX idx_graph_entities_name ON public.graph_entities(name);
CREATE INDEX idx_graph_entities_type ON public.graph_entities(type);
CREATE INDEX idx_graph_relationships_graph_kb ON public.graph_relationships(graph_knowledge_base_id);
CREATE INDEX idx_graph_relationships_document ON public.graph_relationships(graph_document_id);
CREATE INDEX idx_graph_relationships_source ON public.graph_relationships(source_entity_id);
CREATE INDEX idx_graph_relationships_target ON public.graph_relationships(target_entity_id);

-- Create trigger for updated_at on graph_knowledge_bases
CREATE TRIGGER update_graph_knowledge_bases_updated_at
  BEFORE UPDATE ON public.graph_knowledge_bases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on graph_documents
CREATE TRIGGER update_graph_documents_updated_at
  BEFORE UPDATE ON public.graph_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to search graph entities and relationships
CREATE OR REPLACE FUNCTION public.search_graph_entities(
  query_text TEXT,
  kb_id UUID,
  p_user_id UUID,
  max_results INTEGER DEFAULT 10
)
RETURNS TABLE(
  entity_id UUID,
  entity_name TEXT,
  entity_type TEXT,
  entity_description TEXT,
  related_entities JSONB,
  relationships JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH matching_entities AS (
    SELECT 
      e.id,
      e.name,
      e.type,
      e.description
    FROM graph_entities e
    WHERE e.graph_knowledge_base_id = kb_id
      AND EXISTS (
        SELECT 1 FROM graph_knowledge_bases
        WHERE id = kb_id AND user_id = p_user_id
      )
      AND (
        e.name ILIKE '%' || query_text || '%'
        OR e.type ILIKE '%' || query_text || '%'
        OR e.description ILIKE '%' || query_text || '%'
      )
    LIMIT max_results
  ),
  entity_relationships AS (
    SELECT
      me.id AS entity_id,
      jsonb_agg(DISTINCT jsonb_build_object(
        'id', e2.id,
        'name', e2.name,
        'type', e2.type
      )) FILTER (WHERE e2.id IS NOT NULL) AS related_entities,
      jsonb_agg(DISTINCT jsonb_build_object(
        'type', r.relationship_type,
        'description', r.description,
        'target', e2.name
      )) FILTER (WHERE r.id IS NOT NULL) AS relationships
    FROM matching_entities me
    LEFT JOIN graph_relationships r ON r.source_entity_id = me.id
    LEFT JOIN graph_entities e2 ON e2.id = r.target_entity_id
    GROUP BY me.id
  )
  SELECT
    me.id,
    me.name,
    me.type,
    me.description,
    COALESCE(er.related_entities, '[]'::jsonb),
    COALESCE(er.relationships, '[]'::jsonb)
  FROM matching_entities me
  LEFT JOIN entity_relationships er ON er.entity_id = me.id;
END;
$$;