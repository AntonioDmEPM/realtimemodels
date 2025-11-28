// Types for the multi-agent orchestration system

export interface AgentResult {
  agent: string;
  success: boolean;
  data?: any;
  error?: string;
}

export interface OrchestrationPlan {
  agents: string[];
  reasoning: string;
  query_refinements?: Record<string, string>;
}

export interface OrchestrationMetadata {
  type: 'orchestration_metadata';
  plan: OrchestrationPlan;
  agentResults: Array<{
    agent: string;
    success: boolean;
    error?: string;
  }>;
}

export interface AgentActivity {
  id: string;
  agent: string;
  status: 'pending' | 'running' | 'success' | 'error';
  startTime: number;
  endTime?: number;
  result?: any;
  error?: string;
}

export interface OrchestratorState {
  isProcessing: boolean;
  currentPlan?: OrchestrationPlan;
  activities: AgentActivity[];
  response?: string;
}

export type AgentType = 'knowledge_base' | 'web_search';

export const AGENT_DISPLAY_NAMES: Record<AgentType, string> = {
  knowledge_base: 'Knowledge Base',
  web_search: 'Web Search'
};

export const AGENT_ICONS: Record<AgentType, string> = {
  knowledge_base: '📚',
  web_search: '🌐'
};
