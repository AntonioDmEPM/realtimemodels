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
    console.log('=== get-realtime-token function invoked ===');
    
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('Authentication failed:', userError);
      throw new Error('Unauthorized');
    }

    console.log('User authenticated:', user.id);
    
    // Rate limiting - 5 requests per minute for realtime sessions
    const rateLimitWindow = new Date(Date.now() - 60000); // 1 minute ago
    const { data: rateLimitData } = await supabase
      .from('rate_limits')
      .select('request_count')
      .eq('user_id', user.id)
      .eq('function_name', 'get-realtime-token')
      .gte('window_start', rateLimitWindow.toISOString())
      .single();

    if (rateLimitData && rateLimitData.request_count >= 5) {
      return new Response(JSON.stringify({ 
        error: 'Rate limit exceeded. Please wait before starting a new session.' 
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update rate limit counter
    const windowStart = new Date(Math.floor(Date.now() / 60000) * 60000); // Round to minute
    await supabase.from('rate_limits').upsert({
      user_id: user.id,
      function_name: 'get-realtime-token',
      window_start: windowStart.toISOString(),
      request_count: (rateLimitData?.request_count || 0) + 1
    }, {
      onConflict: 'user_id,function_name,window_start'
    });
    
    const OPENAI_API_KEY = Deno.env.get('OpenAI_API_Token');
    
    if (!OPENAI_API_KEY) {
      console.error('OpenAI_API_Token is not configured in secrets');
      throw new Error('OpenAI_API_Token is not configured');
    }

    const { model, voice, instructions } = await req.json();
    
    // Input validation - using new 2025-12-15 model snapshots
    const allowedModels = ['gpt-realtime-mini-2025-12-15', 'gpt-4o-realtime-preview-2024-12-17'];
    const allowedVoices = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'];
    
    const validatedModel = model && allowedModels.includes(model) ? model : 'gpt-realtime-mini-2025-12-15';
    const validatedVoice = voice && allowedVoices.includes(voice) ? voice : 'ash';
    
    // Use provided instructions or fallback to default
    const sessionInstructions = (instructions && typeof instructions === 'string' && instructions.trim().length > 0) 
      ? instructions 
      : 'You are a helpful assistant. When you need current information or real-time data, use the web_search tool.';
    
    console.log('Using instructions:', sessionInstructions.substring(0, 100) + '...');
    
    console.log('Validated params - model:', validatedModel, 'voice:', validatedVoice);
    console.log('✅ Configuring session with input_audio_transcription: whisper-1');
    console.log('Calling OpenAI API...');
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: validatedModel,
        voice: validatedVoice,
        instructions: sessionInstructions,
        modalities: ["audio", "text"],
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: {
          model: "whisper-1"
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 1000
        },
        tools: [
          {
            type: "function",
            name: "web_search",
            description: "Search the web for current information. Use this when you need up-to-date information or when the user asks about current events.",
            parameters: {
              type: "object",
              properties: {
                query: { type: "string", description: "The search query" }
              },
              required: ["query"]
            }
          }
        ],
        tool_choice: "auto"
      }),
    });

    console.log('OpenAI API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error details:", {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText
      });
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('OpenAI API success - session created');
    
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Function error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error details:", errorMessage);
    
    return new Response(JSON.stringify({ 
      error: 'Failed to generate realtime session'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
