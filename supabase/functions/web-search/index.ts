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
    const SEARCHAPI_TOKEN = Deno.env.get('SERPAPI_API_KEY');
    const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY');
    
    const { query, service = 'searchapi' } = await req.json();
    console.log('Using search service:', service);
    console.log('SearchAPI Token present:', !!SEARCHAPI_TOKEN);
    console.log('SerpAPI Key present:', !!SERPAPI_KEY);
    
    if (service === 'searchapi' && !SEARCHAPI_TOKEN) {
      throw new Error('SearchAPI token is not configured');
    }
    
    if (service === 'serpapi' && !SERPAPI_KEY) {
      throw new Error('SerpAPI key is not configured');
    }
    
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

    let response;
    let data;

    if (service === 'serpapi') {
      // Call SerpAPI
      const searchUrl = new URL('https://serpapi.com/search');
      searchUrl.searchParams.append('engine', 'google');
      searchUrl.searchParams.append('q', query);
      searchUrl.searchParams.append('api_key', SERPAPI_KEY!);
      searchUrl.searchParams.append('num', '5');

      console.log('Calling SerpAPI');

      response = await fetch(searchUrl.toString());
      
      console.log('SerpAPI response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('SerpAPI error response:', errorText);
        throw new Error(`SerpAPI error: ${response.statusText} - ${errorText}`);
      }

      data = await response.json();
      console.log('SerpAPI response received');
    } else {
      // Call SearchAPI
      const searchUrl = new URL('https://www.searchapi.io/api/v1/search');
      searchUrl.searchParams.append('engine', 'google');
      searchUrl.searchParams.append('q', query);
      searchUrl.searchParams.append('num', '5');

      console.log('Calling SearchAPI');

      response = await fetch(searchUrl.toString(), {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${SEARCHAPI_TOKEN!}`
        }
      });
      
      console.log('SearchAPI response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('SearchAPI error response:', errorText);
        throw new Error(`SearchAPI error: ${response.statusText} - ${errorText}`);
      }

      data = await response.json();
      console.log('SearchAPI response received');
    }

    // Extract relevant information (both APIs have similar structure)
    const results = {
      query: query,
      service: service,
      results: (data.organic_results || []).map((result: any) => ({
        title: result.title,
        link: result.link,
        snippet: result.snippet || result.description
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
