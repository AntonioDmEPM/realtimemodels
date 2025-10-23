import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SERPAPI_API_KEY = Deno.env.get('SERPAPI_API_KEY');
    console.log('API Key present:', !!SERPAPI_API_KEY);
    console.log('API Key length:', SERPAPI_API_KEY?.length || 0);
    
    if (!SERPAPI_API_KEY) {
      throw new Error('SERPAPI_API_KEY is not configured');
    }

    const { query } = await req.json();
    
    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query parameter is required' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Performing web search for:', query);

    // Call SerpAPI
    const searchUrl = new URL('https://serpapi.com/search');
    searchUrl.searchParams.append('q', query);
    searchUrl.searchParams.append('api_key', SERPAPI_API_KEY);
    searchUrl.searchParams.append('engine', 'google');
    searchUrl.searchParams.append('num', '5'); // Get top 5 results

    console.log('Calling SerpAPI URL:', searchUrl.toString().replace(SERPAPI_API_KEY, 'API_KEY_HIDDEN'));

    const response = await fetch(searchUrl.toString());
    
    console.log('SerpAPI response status:', response.status);
    console.log('SerpAPI response statusText:', response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('SerpAPI error response:', errorText);
      throw new Error(`SerpAPI error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('SerpAPI response received');

    // Extract relevant information
    const results = {
      query: query,
      results: (data.organic_results || []).map((result: any) => ({
        title: result.title,
        link: result.link,
        snippet: result.snippet
      })),
      answer_box: data.answer_box ? {
        answer: data.answer_box.answer || data.answer_box.snippet,
        title: data.answer_box.title
      } : null
    };

    return new Response(
      JSON.stringify(results), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in web-search function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
