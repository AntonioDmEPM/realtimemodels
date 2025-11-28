import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AgentResult {
  agent: string;
  success: boolean;
  data?: any;
  error?: string;
}

interface OrchestrationPlan {
  agents: string[];
  reasoning: string;
  query_refinements?: Record<string, string>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, knowledgeBaseId, conversationHistory = [] } = await req.json();
    
    if (!query) {
      throw new Error('Query is required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[Orchestrator] Received query:', query);

    // Step 1: Plan which agents to invoke
    const planResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an AI orchestrator that analyzes user queries and decides which specialized agents to invoke.

Available agents:
1. "knowledge_base" - Searches internal knowledge base documents for company/product specific information
2. "web_search" - Searches the internet for current/external information

Analyze the query and return a JSON object with:
- agents: array of agent names to invoke (can be one or both)
- reasoning: brief explanation of why these agents were chosen
- query_refinements: optional object mapping agent name to a refined/optimized query for that agent

Rules:
- If the query asks about internal documents, products, or company-specific info, use knowledge_base
- If the query asks about current events, external info, or general knowledge, use web_search
- If unsure or query could benefit from both, use both agents
- Always return valid JSON only, no markdown`
          },
          {
            role: 'user',
            content: query
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!planResponse.ok) {
      const errorText = await planResponse.text();
      console.error('[Orchestrator] Planning failed:', errorText);
      throw new Error('Failed to plan agent orchestration');
    }

    const planData = await planResponse.json();
    let plan: OrchestrationPlan;
    
    try {
      const planContent = planData.choices[0].message.content;
      // Clean potential markdown code blocks
      const cleanJson = planContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      plan = JSON.parse(cleanJson);
    } catch (e) {
      console.error('[Orchestrator] Failed to parse plan, defaulting to both agents');
      plan = { agents: ['knowledge_base', 'web_search'], reasoning: 'Default fallback' };
    }

    console.log('[Orchestrator] Execution plan:', plan);

    // Step 2: Execute agents in parallel
    const agentPromises: Promise<AgentResult>[] = [];

    if (plan.agents.includes('knowledge_base') && knowledgeBaseId) {
      const kbQuery = plan.query_refinements?.knowledge_base || query;
      agentPromises.push(executeKnowledgeBaseAgent(supabase, kbQuery, knowledgeBaseId));
    }

    if (plan.agents.includes('web_search')) {
      const webQuery = plan.query_refinements?.web_search || query;
      agentPromises.push(executeWebSearchAgent(webQuery));
    }

    const agentResults = await Promise.all(agentPromises);
    console.log('[Orchestrator] Agent results:', agentResults.map(r => ({ agent: r.agent, success: r.success })));

    // Step 3: Synthesize results
    const synthesisResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a helpful AI assistant. You have been provided with information from specialized agents. 
Synthesize the information into a coherent, helpful response.
If there are conflicts between sources, note them.
If no relevant information was found, say so honestly.
Be concise but comprehensive.`
          },
          ...conversationHistory,
          {
            role: 'user',
            content: `User query: ${query}

Agent results:
${agentResults.map(r => `
[${r.agent.toUpperCase()} AGENT]
${r.success ? JSON.stringify(r.data, null, 2) : `Error: ${r.error}`}
`).join('\n')}

Please synthesize a helpful response based on the above information.`
          }
        ],
        stream: true,
      }),
    });

    if (!synthesisResponse.ok) {
      throw new Error('Failed to synthesize response');
    }

    // Return streaming response with agent metadata
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        // First, send agent execution info
        const metadata = {
          type: 'orchestration_metadata',
          plan,
          agentResults: agentResults.map(r => ({
            agent: r.agent,
            success: r.success,
            error: r.error
          }))
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(metadata)}\n\n`));

        // Then stream the synthesis
        const reader = synthesisResponse.body!.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }

        controller.close();
      }
    });

    return new Response(readable, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('[Orchestrator] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function executeKnowledgeBaseAgent(
  supabase: any,
  query: string,
  knowledgeBaseId: string
): Promise<AgentResult> {
  console.log('[KB Agent] Searching knowledge base:', knowledgeBaseId);
  
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    // Generate embedding for the query
    const embeddingResponse = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query,
      }),
    });

    if (!embeddingResponse.ok) {
      throw new Error('Failed to generate embedding');
    }

    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.data[0].embedding;

    // Search knowledge base using the embedding
    const { data: chunks, error } = await supabase.rpc('search_similar_chunks', {
      query_embedding: JSON.stringify(embedding),
      kb_id: knowledgeBaseId,
      p_user_id: '00000000-0000-0000-0000-000000000000', // Service role bypasses RLS
      match_threshold: 0.5,
      match_count: 5
    });

    if (error) {
      console.error('[KB Agent] Search error:', error);
      throw error;
    }

    return {
      agent: 'knowledge_base',
      success: true,
      data: {
        chunks: chunks || [],
        totalResults: chunks?.length || 0
      }
    };
  } catch (error) {
    console.error('[KB Agent] Error:', error);
    return {
      agent: 'knowledge_base',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function executeWebSearchAgent(query: string): Promise<AgentResult> {
  console.log('[Web Search Agent] Searching for:', query);
  
  try {
    const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY') || Deno.env.get('SERPAPI_API_KEY');
    
    if (!SERPAPI_KEY) {
      return {
        agent: 'web_search',
        success: false,
        error: 'Web search API key not configured'
      };
    }

    const searchParams = new URLSearchParams({
      q: query,
      api_key: SERPAPI_KEY,
      engine: 'google',
      num: '5'
    });

    const response = await fetch(`https://serpapi.com/search?${searchParams}`);
    
    if (!response.ok) {
      throw new Error(`Search API error: ${response.status}`);
    }

    const data = await response.json();
    
    const results = (data.organic_results || []).slice(0, 5).map((r: any) => ({
      title: r.title,
      snippet: r.snippet,
      link: r.link
    }));

    return {
      agent: 'web_search',
      success: true,
      data: {
        results,
        totalResults: results.length
      }
    };
  } catch (error) {
    console.error('[Web Search Agent] Error:', error);
    return {
      agent: 'web_search',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
