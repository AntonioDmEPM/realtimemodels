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
    const { transcript, validationRules } = await req.json();

    if (!transcript) {
      return new Response(
        JSON.stringify({ valid: true, reason: 'Empty transcript - skipping validation' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      // Default to valid if no API key (fail open for UX)
      return new Response(
        JSON.stringify({ valid: true, reason: 'Validation service unavailable' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are a content validation assistant. Your job is to validate if the given transcript complies with the provided rules.

VALIDATION RULES:
${validationRules || 'No specific rules provided - approve all content.'}

Respond with a JSON object containing:
- "valid": boolean (true if transcript passes all rules, false otherwise)
- "reason": string (brief explanation of the validation result)

Be strict but fair. If no rules are violated, approve the content.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Validate this transcript:\n\n"${transcript}"` }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'validation_result',
              description: 'Return the validation result',
              parameters: {
                type: 'object',
                properties: {
                  valid: { type: 'boolean', description: 'Whether the transcript passes validation' },
                  reason: { type: 'string', description: 'Brief explanation of the result' }
                },
                required: ['valid', 'reason'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'validation_result' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Validation API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ valid: true, reason: 'Rate limited - skipping validation' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Fail open for other errors
      return new Response(
        JSON.stringify({ valid: true, reason: 'Validation service error - skipping' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('Validation response:', JSON.stringify(data, null, 2));

    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      console.log('Validation result:', result);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fallback: try to parse from content
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      try {
        const parsed = JSON.parse(content);
        return new Response(
          JSON.stringify(parsed),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch {
        // If can't parse, default to valid
        return new Response(
          JSON.stringify({ valid: true, reason: 'Could not parse validation response' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ valid: true, reason: 'No validation response received' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Validation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ valid: true, reason: `Validation error: ${errorMessage}` }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
