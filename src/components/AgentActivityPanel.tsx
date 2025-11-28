import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Brain, Database, Globe } from 'lucide-react';
import { AgentActivity, OrchestrationPlan, AGENT_DISPLAY_NAMES } from '@/types/agentTypes';
import { cn } from '@/lib/utils';

interface AgentActivityPanelProps {
  plan?: OrchestrationPlan;
  activities: AgentActivity[];
  isProcessing: boolean;
}

const getAgentIcon = (agent: string) => {
  switch (agent) {
    case 'knowledge_base':
      return <Database className="h-4 w-4" />;
    case 'web_search':
      return <Globe className="h-4 w-4" />;
    default:
      return <Brain className="h-4 w-4" />;
  }
};

const getStatusIcon = (status: AgentActivity['status']) => {
  switch (status) {
    case 'pending':
      return <div className="h-4 w-4 rounded-full bg-muted animate-pulse" />;
    case 'running':
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    case 'success':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-destructive" />;
  }
};

const getStatusColor = (status: AgentActivity['status']) => {
  switch (status) {
    case 'pending':
      return 'bg-muted text-muted-foreground';
    case 'running':
      return 'bg-primary/20 text-primary';
    case 'success':
      return 'bg-green-500/20 text-green-600';
    case 'error':
      return 'bg-destructive/20 text-destructive';
  }
};

export default function AgentActivityPanel({ 
  plan, 
  activities, 
  isProcessing 
}: AgentActivityPanelProps) {
  if (!plan && activities.length === 0 && !isProcessing) {
    return null;
  }

  return (
    <Card className="p-4 bg-card/50 backdrop-blur-sm border-primary/20">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-sm">Agent Orchestration</h3>
          {isProcessing && (
            <Badge variant="outline" className="ml-auto animate-pulse">
              Processing
            </Badge>
          )}
        </div>

        {/* Planning Phase */}
        {plan && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Reasoning:</span> {plan.reasoning}
            </p>
            <div className="flex flex-wrap gap-2">
              {plan.agents.map((agent) => (
                <Badge 
                  key={agent} 
                  variant="secondary"
                  className="flex items-center gap-1"
                >
                  {getAgentIcon(agent)}
                  {AGENT_DISPLAY_NAMES[agent as keyof typeof AGENT_DISPLAY_NAMES] || agent}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Agent Activities */}
        {activities.length > 0 && (
          <div className="space-y-2">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-md transition-all",
                  getStatusColor(activity.status)
                )}
              >
                {getAgentIcon(activity.agent)}
                <span className="text-sm font-medium flex-1">
                  {AGENT_DISPLAY_NAMES[activity.agent as keyof typeof AGENT_DISPLAY_NAMES] || activity.agent}
                </span>
                {getStatusIcon(activity.status)}
                {activity.endTime && activity.startTime && (
                  <span className="text-xs opacity-70">
                    {activity.endTime - activity.startTime}ms
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
