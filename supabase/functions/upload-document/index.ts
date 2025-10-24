import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    console.log('=== upload-document function invoked ===');
    
    const OPENAI_API_KEY = Deno.env.get('OpenAI_API_Token');
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI_API_Token is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('User authenticated:', user.id);

    // Rate limiting - 5 uploads per hour (very expensive operation)
    const rateLimitWindow = new Date(Date.now() - 3600000); // 1 hour ago
    const { data: rateLimitData } = await supabase
      .from('rate_limits')
      .select('request_count')
      .eq('user_id', user.id)
      .eq('function_name', 'upload-document')
      .gte('window_start', rateLimitWindow.toISOString())
      .single();

    if (rateLimitData && rateLimitData.request_count >= 5) {
      return new Response(JSON.stringify({ 
        error: 'Rate limit exceeded. You can upload up to 5 documents per hour.' 
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update rate limit counter
    const windowStart = new Date(Math.floor(Date.now() / 3600000) * 3600000); // Round to hour
    await supabase.from('rate_limits').upsert({
      user_id: user.id,
      function_name: 'upload-document',
      window_start: windowStart.toISOString(),
      request_count: (rateLimitData?.request_count || 0) + 1
    }, {
      onConflict: 'user_id,function_name,window_start'
    });

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const knowledgeBaseId = formData.get('knowledge_base_id') as string;

    if (!file || !knowledgeBaseId) {
      throw new Error('Missing file or knowledge_base_id');
    }

    console.log(`Processing file: ${file.name}, size: ${file.size}, type: ${file.type}`);

    // Create document record
    const { data: document, error: docError } = await supabase
      .from('knowledge_documents')
      .insert({
        knowledge_base_id: knowledgeBaseId,
        user_id: user.id,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        upload_status: 'processing'
      })
      .select()
      .single();

    if (docError) {
      console.error('Error creating document:', docError);
      throw docError;
    }

    console.log('Document record created:', document.id);

    // Get the text content from the uploaded file
    // The client extracts PDF text before uploading
    const textContent = formData.get('text_content') as string;
    
    if (!textContent) {
      throw new Error('No text content provided. PDF text extraction must be done on client side.');
    }
    
    let fileContent = textContent;
    
    // Remove null bytes and other problematic characters
    fileContent = fileContent.replace(/\0/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
    
    if (!fileContent || fileContent.length < 10) {
      throw new Error('No readable text content found in document');
    }
    
    // Chunk the content to fit embedding model limits (aim for ~1500 chars = ~375 tokens, well under 8192 limit)
    const chunks = chunkText(fileContent, 1500);
    console.log(`Created ${chunks.length} chunks from document`);

    // Generate embeddings and store chunks
    let successCount = 0;
    for (let i = 0; i < chunks.length; i++) {
      try {
        const chunk = chunks[i];
        console.log(`Processing chunk ${i + 1}/${chunks.length}`);
        
        // Generate embedding using OpenAI
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: chunk
          }),
        });

        if (!embeddingResponse.ok) {
          const errorText = await embeddingResponse.text();
          console.error(`OpenAI embedding error for chunk ${i}:`, errorText);
          continue;
        }

        const embeddingData = await embeddingResponse.json();
        const embedding = embeddingData.data[0].embedding;

        // Store chunk with embedding (convert to pgvector format)
        const { error: chunkError } = await supabase
          .from('knowledge_chunks')
          .insert({
            user_id: user.id,
            document_id: document.id,
            knowledge_base_id: knowledgeBaseId,
            content: chunk,
            embedding: `[${embedding.join(',')}]`,
            metadata: { chunk_index: i, chunk_size: chunk.length }
          });

        if (chunkError) {
          console.error(`Error storing chunk ${i}:`, chunkError);
        } else {
          successCount++;
        }
      } catch (error) {
        console.error(`Error processing chunk ${i}:`, error);
      }
    }

    // Update document status
    const { error: updateError } = await supabase
      .from('knowledge_documents')
      .update({
        upload_status: successCount === chunks.length ? 'completed' : 'partial'
      })
      .eq('id', document.id);

    if (updateError) {
      console.error('Error updating document status:', updateError);
    }

    console.log(`Document processing complete. ${successCount}/${chunks.length} chunks stored`);

    return new Response(
      JSON.stringify({
        success: true,
        document_id: document.id,
        chunks_processed: successCount,
        total_chunks: chunks.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in upload-document:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function to chunk text
function chunkText(text: string, maxChunkSize: number): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    // If a single paragraph is too long, split it by sentences
    if (paragraph.length > maxChunkSize) {
      // Save current chunk if it exists
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      // Split long paragraph by sentences
      const sentences = paragraph.split(/[.!?]+\s+/);
      for (const sentence of sentences) {
        if (sentence.length > maxChunkSize) {
          // If even a sentence is too long, split by character limit
          for (let i = 0; i < sentence.length; i += maxChunkSize) {
            chunks.push(sentence.slice(i, i + maxChunkSize).trim());
          }
        } else if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = sentence;
        } else {
          currentChunk += (currentChunk ? '. ' : '') + sentence;
        }
      }
    } else if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = paragraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }
  
  if (currentChunk && currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(c => c.length > 0);
}