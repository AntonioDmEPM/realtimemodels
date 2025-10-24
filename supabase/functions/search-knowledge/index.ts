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
    
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('Authentication failed:', userError);
      throw new Error('Unauthorized');
    }

    console.log('User authenticated:', user.id);
    
    // Rate limiting - 30 requests per minute
    const rateLimitWindow = new Date(Date.now() - 60000);
    const { data: rateLimitData } = await supabase
      .from('rate_limits')
      .select('request_count')
      .eq('user_id', user.id)
      .eq('function_name', 'search-knowledge')
      .gte('window_start', rateLimitWindow.toISOString())
      .single();

    if (rateLimitData && rateLimitData.request_count >= 30) {
      return new Response(JSON.stringify({ 
        error: 'Rate limit exceeded. Please wait before searching again.' 
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update rate limit counter
    const windowStart = new Date(Math.floor(Date.now() / 60000) * 60000);
    await supabase.from('rate_limits').upsert({
      user_id: user.id,
      function_name: 'search-knowledge',
      window_start: windowStart.toISOString(),
      request_count: (rateLimitData?.request_count || 0) + 1
    }, {
      onConflict: 'user_id,function_name,window_start'
    });
    
    const OPENAI_API_KEY = Deno.env.get('OpenAI_API_Token');
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI_API_Token is not configured');
    }

    const { query, knowledge_base_id, match_threshold = 0.7, match_count = 5 } = await req.json();

    // Input validation
    if (!query || typeof query !== 'string') {
      throw new Error('Query must be a non-empty string');
    }
    
    if (query.length > 10000) {
      throw new Error('Query too long (max 10000 characters)');
    }
    
    if (!knowledge_base_id || typeof knowledge_base_id !== 'string') {
      throw new Error('knowledge_base_id is required');
    }
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(knowledge_base_id)) {
      throw new Error('Invalid knowledge_base_id format');
    }
    
    // Validate numeric parameters
    const validatedThreshold = Math.max(0, Math.min(1, Number(match_threshold) || 0.7));
    const validatedCount = Math.max(1, Math.min(50, Number(match_count) || 5));

    // Validate knowledge base ownership
    const { data: kb, error: kbError } = await supabase
      .from('knowledge_bases')
      .select('id')
      .eq('id', knowledge_base_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (kbError) {
      console.error('Error querying knowledge base:', kbError);
      throw new Error('Error accessing knowledge base');
    }
    
    if (!kb) {
      console.error('Knowledge base not found:', { knowledge_base_id, userId: user.id });
      throw new Error('Knowledge base not found or you do not have access to it');
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

    // Search for similar chunks using the database function (convert to pgvector format)
    const { data: results, error: searchError } = await supabase
      .rpc('search_similar_chunks', {
        query_embedding: `[${queryEmbedding.join(',')}]`,
        kb_id: knowledge_base_id,
        p_user_id: user.id,
        match_threshold: validatedThreshold,
        match_count: validatedCount
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error details:', errorMessage);
    
    return new Response(
      JSON.stringify({ error: 'Failed to search knowledge base' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});