import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== search-knowledge function invoked ===');
    
    const OPENAI_API_KEY = Deno.env.get('OpenAI_API_Token');
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI_API_Token is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { query, knowledge_base_id, match_threshold = 0.7, match_count = 5 } = await req.json();

    if (!query || !knowledge_base_id) {
      throw new Error('Missing query or knowledge_base_id');
    }

    console.log(`Searching knowledge base ${knowledge_base_id} for: "${query}"`);

    // Generate embedding for the query
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: query
      }),
    });

    if (!embeddingResponse.ok) {
      const errorText = await embeddingResponse.text();
      console.error('OpenAI embedding error:', errorText);
      throw new Error('Failed to generate query embedding');
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    console.log('Query embedding generated, searching for similar chunks...');

    // Search for similar chunks using the database function
    const { data: results, error: searchError } = await supabase
      .rpc('search_similar_chunks', {
        query_embedding: JSON.stringify(queryEmbedding),
        kb_id: knowledge_base_id,
        match_threshold: match_threshold,
        match_count: match_count
      });

    if (searchError) {
      console.error('Search error:', searchError);
      throw searchError;
    }

    console.log(`Found ${results?.length || 0} matching chunks`);

    return new Response(
      JSON.stringify({
        success: true,
        results: results || [],
        query: query
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-knowledge:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});