-- Drop GraphRAG function
DROP FUNCTION IF EXISTS public.search_graph_entities(text, uuid, uuid, integer);

-- Drop GraphRAG tables (in correct order due to dependencies)
DROP TABLE IF EXISTS public.graph_relationships CASCADE;
DROP TABLE IF EXISTS public.graph_entities CASCADE;
DROP TABLE IF EXISTS public.graph_documents CASCADE;
DROP TABLE IF EXISTS public.graph_knowledge_bases CASCADE;