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
    const token = authHeader.replace('Bearer ', '');
    
    // Create authenticated Supabase client with user's JWT token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('Authentication failed:', userError);
      throw new Error('Unauthorized');
    }

    console.log('User authenticated:', user.id);
    
    // Rate limiting - 20 requests per minute
    const rateLimitWindow = new Date(Date.now() - 60000);
    const { data: rateLimitData } = await supabase
      .from('rate_limits')
      .select('request_count')
      .eq('user_id', user.id)
      .eq('function_name', 'chat-completion')
      .gte('window_start', rateLimitWindow.toISOString())
      .single();

    if (rateLimitData && rateLimitData.request_count >= 20) {
      return new Response(JSON.stringify({ 
        error: 'Rate limit exceeded. Please wait before making more requests.' 
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update rate limit counter
    const windowStart = new Date(Math.floor(Date.now() / 60000) * 60000);
    await supabase.from('rate_limits').upsert({
      user_id: user.id,
      function_name: 'chat-completion',
      window_start: windowStart.toISOString(),
      request_count: (rateLimitData?.request_count || 0) + 1
    }, {
      onConflict: 'user_id,function_name,window_start'
    });
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const OPENAI_API_KEY = Deno.env.get('OpenAI_API_Token');
    
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured in secrets');
      throw new Error('Lovable AI key not configured');
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
      // Skip validation for assistant messages with tool_calls (no content required)
      if (msg.role === 'assistant' && msg.tool_calls) {
        continue;
      }
      // Skip validation for tool messages (content will be validated separately)
      if (msg.role === 'tool') {
        if (!msg.content || typeof msg.content !== 'string') {
          throw new Error('Tool message must have string content');
        }
        if (!msg.tool_call_id) {
          throw new Error('Tool message must have tool_call_id');
        }
        continue;
      }
      // Regular message validation
      if (!msg.content || typeof msg.content !== 'string') {
        throw new Error('Invalid message format');
      }
      if (msg.content.length > 50000) {
        throw new Error('Message content too long (max 50000 characters)');
      }
    }
    
    // Validate model - use Lovable AI models
    const allowedModels = ['google/gemini-2.5-pro', 'google/gemini-2.5-flash', 'google/gemini-2.5-flash-lite', 'openai/gpt-5', 'openai/gpt-5-mini', 'openai/gpt-5-nano'];
    const validatedModel = model && allowedModels.includes(model) ? model : 'google/gemini-2.5-flash';
    
    // Validate knowledge base ID format if provided
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (knowledgeBaseId && !uuidRegex.test(knowledgeBaseId)) {
      throw new Error('Invalid knowledge base ID format');
    }

    let knowledgeContext = '';
    
    // If knowledge base is configured, search for relevant context
    if (knowledgeBaseId && messages.length > 0 && OPENAI_API_KEY) {
      try {
        // Validate knowledge base ownership
        const { data: kb, error: kbError } = await supabase
          .from('knowledge_bases')
          .select('id')
          .eq('id', knowledgeBaseId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (kbError) {
          console.error('Error querying knowledge base:', kbError);
          // Continue without knowledge base
        } else if (!kb) {
          console.warn('Knowledge base not found or no access:', { knowledgeBaseId, userId: user.id });
          // Continue without knowledge base
        } else {
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
                // Convert array to pgvector format string
                const { data: chunks, error: searchError } = await supabase
                  .rpc('search_similar_chunks', {
                    query_embedding: `[${queryEmbedding.join(',')}]`,
                    kb_id: knowledgeBaseId,
                    p_user_id: user.id,
                    match_threshold: 0.7,
                    match_count: 3,
                  });

                if (!searchError && chunks) {
                  console.log('Found knowledge chunks:', chunks.length);
                  
                  if (chunks.length > 0) {
                    // Store search event for display
                    console.log('KB search results:', chunks.map((c: any) => ({
                      content: c.content.substring(0, 100),
                      similarity: c.similarity
                    })));
                    
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
      } catch (error) {
        console.error('Knowledge base validation error:', error);
        // Continue without knowledge base
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
    
    // Define tools - web search and optionally knowledge base search
    const tools = [
      {
        type: "function",
        function: {
          name: "web_search",
          description: "Search the web for current information, news, or any real-time data. Use this when you need up-to-date information beyond your training cutoff or when the user asks about current events, recent developments, or specific real-time information.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The search query to look up on the web"
              }
            },
            required: ["query"]
          }
        }
      }
    ];
    
    // Add knowledge base search tool if configured
    if (knowledgeBaseId && OPENAI_API_KEY) {
      tools.push({
        type: "function",
        function: {
          name: "search_knowledge_base",
          description: "Search the knowledge base for relevant information from uploaded documents. Use this when the user asks questions that might be answered by the knowledge base content.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The search query to find relevant information in the knowledge base"
              }
            },
            required: ["query"]
          }
        }
      });
    }

    console.log('Calling Lovable AI Gateway...');
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: validatedModel,
        messages: messagesWithContext,
        tools,
        tool_choice: "auto"
      }),
    });

    console.log('Lovable AI response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error details:', {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText
      });
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: 'Rate limits exceeded, please try again later.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: 'Payment required, please add funds to your Lovable AI workspace.' 
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`Lovable AI error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Lovable AI success - completion generated');
    
    // Check if AI wants to use tools
    if (data.choices?.[0]?.message?.tool_calls) {
      const toolCall = data.choices[0].message.tool_calls[0];
      
      if (toolCall.function.name === 'web_search') {
        console.log('AI requested web search:', toolCall.function.arguments);
        const args = JSON.parse(toolCall.function.arguments);
        
        // Return tool call to client for execution
        return new Response(JSON.stringify({
          ...data,
          requires_tool: true,
          tool_name: 'web_search',
          tool_arguments: args
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (toolCall.function.name === 'search_knowledge_base') {
        console.log('AI requested knowledge base search:', toolCall.function.arguments);
        const args = JSON.parse(toolCall.function.arguments);
        
        // Return tool call to client for execution
        return new Response(JSON.stringify({
          ...data,
          requires_tool: true,
          tool_name: 'search_knowledge_base',
          tool_arguments: args
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
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
