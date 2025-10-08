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

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const knowledgeBaseId = formData.get('knowledge_base_id') as string;

    if (!file || !knowledgeBaseId) {
      throw new Error('Missing file or knowledge_base_id');
    }

    console.log(`Processing file: ${file.name}, size: ${file.size}, type: ${file.type}`);

    // Create document record
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        knowledge_base_id: knowledgeBaseId,
        user_id: user.id,
        filename: file.name,
        file_type: file.type,
        file_size: file.size,
        status: 'processing'
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
    
    // Chunk the content with smaller size to fit embedding model limits (~500 chars = ~125 tokens)
    const chunks = chunkText(fileContent, 500);
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
            model: 'text-embedding-ada-002',
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

        // Store chunk with embedding
        const { error: chunkError } = await supabase
          .from('document_chunks')
          .insert({
            document_id: document.id,
            knowledge_base_id: knowledgeBaseId,
            chunk_index: i,
            content: chunk,
            embedding: JSON.stringify(embedding),
            metadata: { chunk_size: chunk.length }
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
      .from('documents')
      .update({
        status: successCount === chunks.length ? 'completed' : 'partial',
        chunk_count: successCount,
        error_message: successCount < chunks.length ? `Only ${successCount}/${chunks.length} chunks processed` : null
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
    if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = paragraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(c => c.length > 0);
}