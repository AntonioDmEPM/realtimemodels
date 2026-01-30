import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limit configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30;

// Input validation constants
const MAX_QUERY_LENGTH = 500;
const VALID_SEARCH_TYPES = ['web', 'shopping', 'amazon', 'maps'];
const VALID_SERVICES = ['searchapi', 'serpapi'];

// Validate and sanitize query input
function validateQuery(query: unknown): string {
  if (!query || typeof query !== 'string') {
    throw new Error('Query must be a non-empty string');
  }
  
  const trimmedQuery = query.trim();
  
  if (trimmedQuery.length === 0) {
    throw new Error('Query cannot be empty');
  }
  
  if (trimmedQuery.length > MAX_QUERY_LENGTH) {
    throw new Error(`Query too long (max ${MAX_QUERY_LENGTH} characters)`);
  }
  
  // Check for null bytes or other suspicious patterns
  if (trimmedQuery.includes('\0')) {
    throw new Error('Invalid characters in query');
  }
  
  return trimmedQuery;
}

// Validate search type
function validateSearchType(searchType: unknown): string {
  if (!searchType) return 'web';
  
  if (typeof searchType !== 'string' || !VALID_SEARCH_TYPES.includes(searchType)) {
    throw new Error(`Invalid search type. Must be one of: ${VALID_SEARCH_TYPES.join(', ')}`);
  }
  
  return searchType;
}

// Validate service
function validateService(service: unknown): string {
  if (!service) return 'searchapi';
  
  if (typeof service !== 'string' || !VALID_SERVICES.includes(service)) {
    throw new Error(`Invalid service. Must be one of: ${VALID_SERVICES.join(', ')}`);
  }
  
  return service;
}

// Check rate limit for user
async function checkRateLimit(supabase: any, userId: string, functionName: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  
  // Get current request count for this user in the current window
  const { data: rateLimits, error: fetchError } = await supabase
    .from('rate_limits')
    .select('id, request_count, window_start')
    .eq('user_id', userId)
    .eq('function_name', functionName)
    .gte('window_start', windowStart)
    .order('window_start', { ascending: false })
    .limit(1);
  
  if (fetchError) {
    console.error('Error checking rate limit:', fetchError);
    // Allow request if rate limit check fails (fail-open for availability)
    return true;
  }
  
  if (!rateLimits || rateLimits.length === 0) {
    // No existing record, create new one
    const { error: insertError } = await supabase
      .from('rate_limits')
      .insert({
        user_id: userId,
        function_name: functionName,
        window_start: new Date().toISOString(),
        request_count: 1
      });
    
    if (insertError) {
      console.error('Error creating rate limit record:', insertError);
    }
    return true;
  }
  
  const currentRecord = rateLimits[0];
  
  if (currentRecord.request_count >= MAX_REQUESTS_PER_WINDOW) {
    return false; // Rate limit exceeded
  }
  
  // Increment request count
  const { error: updateError } = await supabase
    .from('rate_limits')
    .update({ request_count: currentRecord.request_count + 1 })
    .eq('id', currentRecord.id);
  
  if (updateError) {
    console.error('Error updating rate limit:', updateError);
  }
  
  return true;
}

serve(async (req) => {
  // Handle CORS preflight requests
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

    // Rate limiting check
    const isAllowed = await checkRateLimit(supabase, userId, 'web-search');
    if (!isAllowed) {
      console.log('Rate limit exceeded for user:', userId);
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate input
    const body = await req.json();
    const query = validateQuery(body.query);
    const service = validateService(body.service);
    const searchType = validateSearchType(body.searchType);

    console.log('User:', userId, '| Service:', service, '| Type:', searchType, '| Query:', query.substring(0, 50));

    const SEARCHAPI_TOKEN = Deno.env.get('SERPAPI_API_KEY');
    const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY');
    
    if (service === 'searchapi' && !SEARCHAPI_TOKEN) {
      throw new Error('SearchAPI token is not configured');
    }
    
    if (service === 'serpapi' && !SERPAPI_KEY) {
      throw new Error('SerpAPI key is not configured');
    }

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
        throw new Error(`SerpAPI error: ${response.statusText}`);
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
        throw new Error(`SearchAPI error: ${response.statusText}`);
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
