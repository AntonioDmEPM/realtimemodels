import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  AgentActivity, 
  OrchestrationPlan, 
  OrchestratorState,
  OrchestrationMetadata 
} from '@/types/agentTypes';

interface UseAgentOrchestratorOptions {
  knowledgeBaseId?: string;
  onResponse?: (response: string) => void;
  onError?: (error: string) => void;
}

export function useAgentOrchestrator(options: UseAgentOrchestratorOptions = {}) {
  const [state, setState] = useState<OrchestratorState>({
    isProcessing: false,
    activities: [],
  });

  const processQuery = useCallback(async (
    query: string,
    conversationHistory: Array<{ role: string; content: string }> = []
  ) => {
    setState(prev => ({
      ...prev,
      isProcessing: true,
      currentPlan: undefined,
      activities: [],
      response: undefined,
    }));

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-orchestrator`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            query,
            knowledgeBaseId: options.knowledgeBaseId,
            conversationHistory,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Orchestration failed');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let metadataProcessed = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);

            // Handle orchestration metadata
            if (parsed.type === 'orchestration_metadata') {
              const metadata = parsed as OrchestrationMetadata;
              
              // Update plan
              setState(prev => ({
                ...prev,
                currentPlan: metadata.plan,
              }));

              // Create activities from results
              const activities: AgentActivity[] = metadata.agentResults.map((result, idx) => ({
                id: `${result.agent}-${idx}`,
                agent: result.agent,
                status: result.success ? 'success' : 'error',
                startTime: Date.now() - 1000,
                endTime: Date.now(),
                error: result.error,
              }));

              setState(prev => ({
                ...prev,
                activities,
              }));

              metadataProcessed = true;
              continue;
            }

            // Handle streaming content
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullResponse += content;
              setState(prev => ({
                ...prev,
                response: fullResponse,
              }));
              options.onResponse?.(fullResponse);
            }
          } catch {
            // Ignore parse errors for incomplete chunks
          }
        }
      }

      setState(prev => ({
        ...prev,
        isProcessing: false,
      }));

      return fullResponse;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Orchestrator Hook] Error:', errorMessage);
      
      setState(prev => ({
        ...prev,
        isProcessing: false,
      }));

      options.onError?.(errorMessage);
      throw error;
    }
  }, [options.knowledgeBaseId, options.onResponse, options.onError]);

  const reset = useCallback(() => {
    setState({
      isProcessing: false,
      activities: [],
    });
  }, []);

  return {
    ...state,
    processQuery,
    reset,
  };
}
