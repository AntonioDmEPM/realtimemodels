import { BarChart3, TrendingUp, Clock, Activity } from 'lucide-react';
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
import ConversationTimeline, { TimelineSegment } from '@/components/ConversationTimeline';
import EventLog from '@/components/EventLog';
import { SessionStats } from '@/utils/webrtcAudio';

interface EventEntry {
  timestamp: string;
  data: any;
}

interface AnalyticsPanelProps {
  currentStats: SessionStats;
  sessionStats: SessionStats;
  tokenDataPoints: TokenDataPoint[];
  sessionStartTime: number | null;
  isActive: boolean;
  totalInputTokens: number;
  totalOutputTokens: number;
  timelineSegments: TimelineSegment[];
  events: EventEntry[];
}

export function AnalyticsPanel({
  currentStats,
  sessionStats,
  tokenDataPoints,
  sessionStartTime,
  isActive,
  totalInputTokens,
  totalOutputTokens,
  timelineSegments,
  events,
}: AnalyticsPanelProps) {
  return (
    <div className="h-full flex flex-col border-l bg-background">
      <div className="border-b p-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          <h3 className="font-semibold">Analytics</h3>
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Session Stats */}
          <Collapsible defaultOpen className="group/collapsible">
            <Card>
              <CardHeader className="pb-3">
                <CollapsibleTrigger className="flex w-full items-center justify-between hover:opacity-80">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Session Statistics
                  </CardTitle>
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Most Recent Interaction</p>
                    <StatsDisplay title="" stats={currentStats} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Session Total</p>
                    <StatsDisplay title="" stats={sessionStats} />
                  </div>
                  <p className="text-xs text-muted-foreground italic">
                    Cost calculations are estimates based on published rates
                  </p>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Token Dashboard */}
          <Collapsible defaultOpen={false} className="group/collapsible">
            <Card>
              <CardHeader className="pb-3">
                <CollapsibleTrigger className="flex w-full items-center justify-between hover:opacity-80">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Token Usage
                  </CardTitle>
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent>
                  <TokenDashboard
                    dataPoints={tokenDataPoints}
                    sessionStartTime={sessionStartTime}
                    isActive={isActive}
                    totalInputTokens={totalInputTokens}
                    totalOutputTokens={totalOutputTokens}
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Conversation Timeline */}
          <Collapsible defaultOpen={false} className="group/collapsible">
            <Card>
              <CardHeader className="pb-3">
                <CollapsibleTrigger className="flex w-full items-center justify-between hover:opacity-80">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Timeline
                  </CardTitle>
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent>
                  <ConversationTimeline
                    segments={timelineSegments}
                    sessionStartTime={sessionStartTime}
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Event Log */}
          <Collapsible defaultOpen={false} className="group/collapsible">
            <Card>
              <CardHeader className="pb-3">
                <CollapsibleTrigger className="flex w-full items-center justify-between hover:opacity-80">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Event Log
                  </CardTitle>
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent>
                  <EventLog events={events} />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  );
}
