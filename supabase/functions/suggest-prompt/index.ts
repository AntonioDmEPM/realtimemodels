import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { currentPrompt } = await req.json();
    
    if (!currentPrompt) {
      throw new Error("Current prompt is required");
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Analyzing prompt for improvements');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: `You are an expert AI prompt engineer. Your task is to analyze system prompts and suggest improvements to make them more effective.

When reviewing a prompt, consider:
- Clarity: Is the AI's role and responsibilities clearly defined?
- Specificity: Are instructions specific enough to guide behavior?
- Structure: Is the prompt well-organized and easy to parse?
- Completeness: Are all necessary constraints and guidelines included?
- Tone & Style: Is the desired communication style clearly specified?
- Examples: Would examples or specific scenarios help clarify expectations?
- Edge cases: Are boundary conditions and limitations addressed?

Return ONLY the improved prompt text, incorporating all enhancements. Do not include explanations, just the refined prompt that can directly replace the original.`
          },
          {
            role: 'user',
            content: `Please analyze and improve this system prompt:\n\n${currentPrompt}`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const suggestedPrompt = data.choices?.[0]?.message?.content;

    if (!suggestedPrompt) {
      throw new Error('No prompt generated');
    }

    console.log('Prompt suggestion generated successfully');

    return new Response(
      JSON.stringify({ prompt: suggestedPrompt }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in suggest-prompt function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});