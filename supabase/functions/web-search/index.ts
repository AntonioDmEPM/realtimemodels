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
    
    const { query, service = 'searchapi', searchType = 'web' } = await req.json();
    console.log('Using search service:', service);
    console.log('Search type:', searchType);
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

    console.log('Performing search for:', query);

    let response;
    let data;

    if (service === 'serpapi') {
      // Call SerpAPI with specialized search types
      const searchUrl = new URL('https://serpapi.com/search');
      
      // Configure engine based on search type
      if (searchType === 'shopping') {
        searchUrl.searchParams.append('engine', 'google_shopping');
        searchUrl.searchParams.append('q', query);
      } else if (searchType === 'amazon') {
        searchUrl.searchParams.append('engine', 'amazon');
        searchUrl.searchParams.append('search_query', query);
      } else if (searchType === 'maps') {
        searchUrl.searchParams.append('engine', 'google_maps');
        searchUrl.searchParams.append('q', query);
        searchUrl.searchParams.append('type', 'search');
      } else {
        searchUrl.searchParams.append('engine', 'google');
        searchUrl.searchParams.append('q', query);
        searchUrl.searchParams.append('num', '5');
      }
      
      searchUrl.searchParams.append('api_key', SERPAPI_KEY!);

      console.log('Calling SerpAPI with type:', searchType);

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
      // Call SearchAPI - only supports web search
      if (searchType !== 'web') {
        throw new Error(`SearchAPI only supports web search. Please use SerpAPI for ${searchType} searches.`);
      }
      
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

    // Extract relevant information based on search type
    let results: any = {
      query: query,
      service: service,
      searchType: searchType
    };

    if (searchType === 'shopping') {
      // Extract shopping results
      results.shopping_results = (data.shopping_results || []).slice(0, 5).map((item: any) => ({
        title: item.title,
        link: item.link,
        price: item.price,
        rating: item.rating,
        reviews: item.reviews,
        source: item.source,
        thumbnail: item.thumbnail
      }));
    } else if (searchType === 'amazon') {
      // Extract Amazon results
      results.shopping_results = (data.search_results || []).slice(0, 5).map((item: any) => ({
        title: item.title,
        link: item.link,
        price: item.price,
        rating: item.rating,
        reviews: item.reviews_count,
        thumbnail: item.thumbnail
      }));
    } else if (searchType === 'maps') {
      // Extract local business results
      results.local_results = (data.local_results || []).slice(0, 5).map((place: any) => ({
        title: place.title,
        address: place.address,
        phone: place.phone,
        rating: place.rating,
        reviews: place.reviews,
        type: place.type,
        hours: place.hours,
        website: place.website
      }));
    } else {
      // Standard web results
      results.results = (data.organic_results || []).map((result: any) => ({
        title: result.title,
        link: result.link,
        snippet: result.snippet || result.description
      }));
      results.answer_box = data.answer_box ? {
        answer: data.answer_box.answer || data.answer_box.snippet,
        title: data.answer_box.title
      } : null;
    }

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
