import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check rate limit
    const now = new Date();
    const windowStart = new Date(now.getTime() - 60 * 60 * 1000);
    
    const { data: rateLimitData } = await supabaseClient
      .from('rate_limits')
      .select('*')
      .eq('user_id', user.id)
      .eq('function_name', 'process-graph-document')
      .gte('window_start', windowStart.toISOString())
      .single();

    if (rateLimitData && rateLimitData.request_count >= 10) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Maximum 10 documents per hour.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const graphKnowledgeBaseId = formData.get('graphKnowledgeBaseId') as string;
    const textContent = formData.get('textContent') as string;

    if (!file || !graphKnowledgeBaseId || !textContent) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create document record
    const { data: documentData, error: docError } = await supabaseClient
      .from('graph_documents')
      .insert({
        graph_knowledge_base_id: graphKnowledgeBaseId,
        user_id: user.id,
        filename: file.name,
        file_type: file.type,
        file_size: file.size,
        status: 'processing',
      })
      .select()
      .single();

    if (docError || !documentData) {
      console.error('Error creating document:', docError);
      return new Response(JSON.stringify({ error: 'Failed to create document' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract entities and relationships using AI
    const openAIApiKey = Deno.env.get('OpenAI_API_Token');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = `Extract entities and relationships from the following text. Return a JSON object with two arrays: "entities" and "relationships".

Each entity should have:
- name: the entity name
- type: the category (Person, Organization, Location, Concept, etc.)
- description: a brief description

Each relationship should have:
- source: the name of the source entity
- target: the name of the target entity
- type: the relationship type (works_for, located_in, related_to, etc.)
- description: a brief description of the relationship

Text:
${textContent.substring(0, 15000)}

Return ONLY valid JSON, no other text.`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert at extracting entities and relationships from text to build knowledge graphs. Always return valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`OpenAI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const extractedData = JSON.parse(aiData.choices[0].message.content);

    // Insert entities
    const entityMap = new Map();
    let entityCount = 0;

    if (extractedData.entities && extractedData.entities.length > 0) {
      for (const entity of extractedData.entities) {
        const { data: entityData, error: entityError } = await supabaseClient
          .from('graph_entities')
          .insert({
            graph_knowledge_base_id: graphKnowledgeBaseId,
            graph_document_id: documentData.id,
            name: entity.name,
            type: entity.type,
            description: entity.description,
          })
          .select()
          .single();

        if (!entityError && entityData) {
          entityMap.set(entity.name, entityData.id);
          entityCount++;
        }
      }
    }

    // Insert relationships
    let relationshipCount = 0;
    if (extractedData.relationships && extractedData.relationships.length > 0) {
      for (const rel of extractedData.relationships) {
        const sourceId = entityMap.get(rel.source);
        const targetId = entityMap.get(rel.target);

        if (sourceId && targetId) {
          const { error: relError } = await supabaseClient
            .from('graph_relationships')
            .insert({
              graph_knowledge_base_id: graphKnowledgeBaseId,
              graph_document_id: documentData.id,
              source_entity_id: sourceId,
              target_entity_id: targetId,
              relationship_type: rel.type,
              description: rel.description,
            });

          if (!relError) {
            relationshipCount++;
          }
        }
      }
    }

    // Update document status
    await supabaseClient
      .from('graph_documents')
      .update({
        status: 'completed',
        entity_count: entityCount,
        relationship_count: relationshipCount,
      })
      .eq('id', documentData.id);

    // Update rate limit
    if (rateLimitData) {
      await supabaseClient
        .from('rate_limits')
        .update({ request_count: rateLimitData.request_count + 1 })
        .eq('id', rateLimitData.id);
    } else {
      await supabaseClient
        .from('rate_limits')
        .insert({
          user_id: user.id,
          function_name: 'process-graph-document',
          window_start: windowStart.toISOString(),
          request_count: 1,
        });
    }

    return new Response(JSON.stringify({
      success: true,
      documentId: documentData.id,
      entityCount,
      relationshipCount,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing graph document:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
