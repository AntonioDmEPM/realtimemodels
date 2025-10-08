import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== chat-completion function invoked ===');
    
    const OPENAI_API_KEY = Deno.env.get('OpenAI_API_Token');
    if (!OPENAI_API_KEY) {
      console.error('OpenAI_API_Token is not configured in secrets');
      throw new Error('OpenAI_API_Token is not configured');
    }

    const { messages, model, knowledgeBaseId } = await req.json();
    console.log('Request params - model:', model, 'messages count:', messages?.length);

    let knowledgeContext = '';
    
    // If knowledge base is configured, search for relevant context
    if (knowledgeBaseId && messages.length > 0) {
      const lastUserMessage = messages[messages.length - 1]?.content;
      
      if (lastUserMessage) {
        console.log('Searching knowledge base:', knowledgeBaseId);
        
        try {
          // Generate embedding for the query
          const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'text-embedding-3-small',
              input: lastUserMessage,
            }),
          });

          if (embeddingResponse.ok) {
            const embeddingData = await embeddingResponse.json();
            const queryEmbedding = embeddingData.data[0].embedding;

            // Search similar chunks in knowledge base
            const supabaseUrl = Deno.env.get('SUPABASE_URL');
            const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
            
            if (!supabaseUrl || !supabaseKey) {
              console.error('Supabase credentials not configured');
              throw new Error('Supabase credentials not configured');
            }
            
            const searchResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/search_similar_chunks`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
              },
              body: JSON.stringify({
                query_embedding: queryEmbedding,
                p_knowledge_base_id: knowledgeBaseId,
                match_threshold: 0.7,
                match_count: 3,
              }),
            });

            if (searchResponse.ok) {
              const chunks = await searchResponse.json();
              console.log('Found knowledge chunks:', chunks.length);
              
              if (chunks.length > 0) {
                knowledgeContext = '\n\nRelevant context from knowledge base:\n' + 
                  chunks.map((chunk: any) => chunk.content).join('\n\n');
              }
            }
          }
        } catch (error) {
          console.error('Knowledge base search error:', error);
          // Continue without knowledge context
        }
      }
    }

    // Prepare messages with knowledge context
    const messagesWithContext = [...messages];
    if (knowledgeContext && messagesWithContext.length > 0) {
      const lastIndex = messagesWithContext.length - 1;
      messagesWithContext[lastIndex] = {
        ...messagesWithContext[lastIndex],
        content: messagesWithContext[lastIndex].content + knowledgeContext
      };
    }

    console.log('Calling OpenAI Chat Completions API...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'gpt-5-mini',
        messages: messagesWithContext,
        max_completion_tokens: 4096,
      }),
    });

    console.log('OpenAI API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error details:', {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText
      });
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('OpenAI API success - completion generated');
    
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error message:', errorMessage);
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: error instanceof Error ? error.stack : undefined 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
