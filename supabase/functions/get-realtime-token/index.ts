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
    
    const OPENAI_API_KEY = Deno.env.get('OpenAI_API_Token');
    console.log('OpenAI_API_Token exists:', !!OPENAI_API_KEY);
    console.log('OpenAI_API_Token length:', OPENAI_API_KEY?.length);
    
    if (!OPENAI_API_KEY) {
      console.error('OpenAI_API_Token is not configured in secrets');
      throw new Error('OpenAI_API_Token is not configured');
    }

    const { model, voice } = await req.json();
    
    // Input validation
    const allowedModels = ['gpt-4o-realtime-preview-2024-12-17', 'gpt-realtime-mini'];
    const allowedVoices = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'];
    
    const validatedModel = model && allowedModels.includes(model) ? model : 'gpt-4o-realtime-preview-2024-12-17';
    const validatedVoice = voice && allowedVoices.includes(voice) ? voice : 'ash';
    
    console.log('Validated params - model:', validatedModel, 'voice:', validatedVoice);
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
