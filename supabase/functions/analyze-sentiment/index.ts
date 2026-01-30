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
    // Authentication: Extract and validate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const token = authHeader.replace('Bearer ', '');
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Validate JWT and get user claims
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error('Auth error:', claimsError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub as string;
    console.log('Authenticated user:', userId);

    const { text, item_id } = await req.json();

    // Input validation
    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing or invalid text parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (text.length > 10000) {
      return new Response(JSON.stringify({ error: 'Text too long (max 10000 characters)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('User:', userId, '| Analyzing sentiment for text of length:', text.length);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: "You are a sentiment analysis system. Analyze the emotional tone of the user's message and respond ONLY with a JSON object containing: sentiment (one of: positive, neutral, negative, mixed), confidence (0-1), reason (brief explanation). No other text."
          },
          {
            role: "user",
            content: `Analyze the sentiment of this message: "${text}"`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_sentiment",
              description: "Report the analyzed sentiment",
              parameters: {
                type: "object",
                properties: {
                  sentiment: {
                    type: "string",
                    enum: ["positive", "neutral", "negative", "mixed"],
                    description: "The detected sentiment"
                  },
                  confidence: {
                    type: "number",
                    description: "Confidence level from 0 to 1"
                  },
                  reason: {
                    type: "string",
                    description: "Brief explanation of the sentiment"
                  }
                },
                required: ["sentiment", "confidence", "reason"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "report_sentiment" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract the tool call arguments
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const sentimentData = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify({
        item_id,
        sentiment: sentimentData.sentiment,
        confidence: sentimentData.confidence,
        reason: sentimentData.reason,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fallback: try to parse from content
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      try {
        const parsed = JSON.parse(content);
        return new Response(JSON.stringify({
          item_id,
          sentiment: parsed.sentiment || 'neutral',
          confidence: parsed.confidence || 0.5,
          reason: parsed.reason || 'Unable to determine',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch {
        // Parse failed
      }
    }

    return new Response(JSON.stringify({
      item_id,
      sentiment: 'neutral',
      confidence: 0.5,
      reason: 'Analysis inconclusive',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Sentiment analysis error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      sentiment: 'neutral',
      confidence: 0,
      reason: 'Error during analysis'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
