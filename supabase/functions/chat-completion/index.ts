import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
    
    const OPENAI_API_KEY = Deno.env.get('OpenAI_API_Token');
    if (!OPENAI_API_KEY) {
      console.error('OpenAI_API_Token is not configured in secrets');
      throw new Error('OpenAI_API_Token is not configured');
    }

    const { messages, model, knowledgeBaseId } = await req.json();
    console.log('Request params - model:', model, 'messages count:', messages?.length);
    
    // Input validation
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('Messages must be a non-empty array');
    }
    
    if (messages.length > 100) {
      throw new Error('Too many messages (max 100)');
    }
    
    // Validate each message
    for (const msg of messages) {
      if (!msg.content || typeof msg.content !== 'string') {
        throw new Error('Invalid message format');
      }
      if (msg.content.length > 50000) {
        throw new Error('Message content too long (max 50000 characters)');
      }
    }
    
    // Validate model
    const allowedModels = ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-4o', 'gpt-4o-mini'];
    const validatedModel = model && allowedModels.includes(model) ? model : 'gpt-5-mini';
    
    // Validate knowledge base ID format if provided
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (knowledgeBaseId && !uuidRegex.test(knowledgeBaseId)) {
      throw new Error('Invalid knowledge base ID format');
    }

    let knowledgeContext = '';
    
    // If knowledge base is configured, search for relevant context
    if (knowledgeBaseId && messages.length > 0) {
      // Validate knowledge base ownership
      const { data: kb, error: kbError } = await supabase
        .from('knowledge_bases')
        .select('id')
        .eq('id', knowledgeBaseId)
        .eq('user_id', user.id)
        .single();

      if (kbError || !kb) {
        console.error('Knowledge base not found or unauthorized:', kbError);
        throw new Error('Knowledge base not found or unauthorized');
      }

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

            // Search similar chunks in knowledge base using authenticated user
            const { data: chunks, error: searchError } = await supabase
              .rpc('search_similar_chunks', {
                query_embedding: queryEmbedding,
                kb_id: knowledgeBaseId,
                p_user_id: user.id,
                match_threshold: 0.7,
                match_count: 3,
              });

            if (!searchError && chunks) {
              console.log('Found knowledge chunks:', chunks.length);
              
              if (chunks.length > 0) {
                knowledgeContext = '\n\nRelevant context from knowledge base:\n' + 
                  chunks.map((chunk: any) => chunk.content).join('\n\n');
              }
            } else if (searchError) {
              console.error('Knowledge base search error:', searchError);
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
        model: validatedModel,
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
    console.error('Error details:', errorMessage);
    
    return new Response(JSON.stringify({ 
      error: 'Failed to generate completion'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
