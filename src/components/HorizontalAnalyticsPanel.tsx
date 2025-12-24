import { BarChart3, Activity, TrendingUp } from 'lucide-react';
import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import StatsDisplay from '@/components/StatsDisplay';
import TokenDashboard, { TokenDataPoint } from '@/components/TokenDashboard';
import EventLog from '@/components/EventLog';
import { SessionStats } from '@/utils/webrtcAudio';

interface EventEntry {
  timestamp: string;
  data: any;
}

interface HorizontalAnalyticsPanelProps {
  currentStats: SessionStats;
  sessionStats: SessionStats;
  tokenDataPoints: TokenDataPoint[];
  sessionStartTime: number | null;
  isActive: boolean;
  totalInputTokens: number;
  totalOutputTokens: number;
  events: EventEntry[];
}

export function HorizontalAnalyticsPanel({
  currentStats,
  sessionStats,
  tokenDataPoints,
  sessionStartTime,
  isActive,
  totalInputTokens,
  totalOutputTokens,
  events,
}: HorizontalAnalyticsPanelProps) {
  return (
    <div className="border-t bg-muted/30">
      <div className="p-3 border-b flex items-center gap-2">
        <BarChart3 className="h-4 w-4" />
        <h3 className="text-sm font-semibold">Analytics</h3>
      </div>
      
      <ScrollArea className="h-[220px]">
        <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Session Stats */}
          <Collapsible defaultOpen className="group/collapsible">
            <Card className="h-full">
              <CardHeader className="pb-2 px-3 pt-3">
                <CollapsibleTrigger className="flex w-full items-center justify-between hover:opacity-80">
                  <CardTitle className="text-xs font-medium flex items-center gap-2">
                    <Activity className="h-3 w-3 flex-shrink-0" />
                    <span>Session Stats</span>
                  </CardTitle>
                  <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="px-3 pb-3 space-y-2">
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">Recent</p>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <span className="text-muted-foreground">In:</span>
                      <span className="font-mono">{(currentStats.audioInputTokens + currentStats.textInputTokens).toLocaleString()}</span>
                      <span className="text-muted-foreground">Out:</span>
                      <span className="font-mono">{(currentStats.audioOutputTokens + currentStats.textOutputTokens).toLocaleString()}</span>
                      <span className="text-muted-foreground">Cost:</span>
                      <span className="font-mono text-primary">${currentStats.totalCost.toFixed(4)}</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">Session Total</p>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <span className="text-muted-foreground">In:</span>
                      <span className="font-mono">{(sessionStats.audioInputTokens + sessionStats.textInputTokens).toLocaleString()}</span>
                      <span className="text-muted-foreground">Out:</span>
                      <span className="font-mono">{(sessionStats.audioOutputTokens + sessionStats.textOutputTokens).toLocaleString()}</span>
                      <span className="text-muted-foreground">Cost:</span>
                      <span className="font-mono text-primary">${sessionStats.totalCost.toFixed(4)}</span>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Token Dashboard */}
          <Collapsible defaultOpen className="group/collapsible">
            <Card className="h-full">
              <CardHeader className="pb-2 px-3 pt-3">
                <CollapsibleTrigger className="flex w-full items-center justify-between hover:opacity-80">
                  <CardTitle className="text-xs font-medium flex items-center gap-2">
                    <TrendingUp className="h-3 w-3 flex-shrink-0" />
                    <span>Token Usage</span>
                  </CardTitle>
                  <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="px-3 pb-3">
                  <div className="h-[120px]">
                    <TokenDashboard
                      dataPoints={tokenDataPoints}
                      sessionStartTime={sessionStartTime}
                      isActive={isActive}
                      totalInputTokens={totalInputTokens}
                      totalOutputTokens={totalOutputTokens}
                    />
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Event Log */}
          <Collapsible defaultOpen className="group/collapsible">
            <Card className="h-full">
              <CardHeader className="pb-2 px-3 pt-3">
                <CollapsibleTrigger className="flex w-full items-center justify-between hover:opacity-80">
                  <CardTitle className="text-xs font-medium flex items-center gap-2">
                    <Activity className="h-3 w-3 flex-shrink-0" />
                    <span>Event Log</span>
                  </CardTitle>
                  <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="px-3 pb-3">
                  <div className="h-[120px] overflow-hidden">
                    <EventLog events={events} />
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  );
}
