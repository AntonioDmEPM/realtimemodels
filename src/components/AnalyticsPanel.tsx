import { BarChart3, TrendingUp, Activity } from 'lucide-react';
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

interface AnalyticsPanelProps {
  currentStats: SessionStats;
  sessionStats: SessionStats;
  tokenDataPoints: TokenDataPoint[];
  sessionStartTime: number | null;
  isActive: boolean;
  totalInputTokens: number;
  totalOutputTokens: number;
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
  events,
}: AnalyticsPanelProps) {
  return (
    <div className="h-full flex flex-col border-l bg-background">
      <div className="border-b p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
          <h3 className="text-sm sm:text-base font-semibold truncate">Analytics</h3>
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 sm:p-3 lg:p-4 space-y-3 sm:space-y-4">
          {/* Session Stats */}
          <Collapsible defaultOpen className="group/collapsible">
            <Card>
              <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
                <CollapsibleTrigger className="flex w-full items-center justify-between hover:opacity-80">
                  <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
                    <Activity className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                    <span className="truncate">Session Stats</span>
                  </CardTitle>
                  <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 transition-transform group-data-[state=open]/collapsible:rotate-180 flex-shrink-0" />
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6 pb-3 sm:pb-6">
                  <div className="space-y-1.5 sm:space-y-2">
                    <p className="text-[10px] sm:text-xs font-medium text-muted-foreground truncate">Most Recent</p>
                    <StatsDisplay title="" stats={currentStats} />
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <p className="text-[10px] sm:text-xs font-medium text-muted-foreground truncate">Session Total</p>
                    <StatsDisplay title="" stats={sessionStats} />
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground italic">
                    Cost estimates based on published rates
                  </p>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Token Dashboard */}
          <Collapsible defaultOpen={false} className="group/collapsible">
            <Card>
              <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
                <CollapsibleTrigger className="flex w-full items-center justify-between hover:opacity-80">
                  <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                    <span className="truncate">Token Usage</span>
                  </CardTitle>
                  <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 transition-transform group-data-[state=open]/collapsible:rotate-180 flex-shrink-0" />
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
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

          {/* Event Log */}
          <Collapsible defaultOpen={false} className="group/collapsible">
            <Card>
              <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
                <CollapsibleTrigger className="flex w-full items-center justify-between hover:opacity-80">
                  <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
                    <Activity className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                    <span className="truncate">Event Log</span>
                  </CardTitle>
                  <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 transition-transform group-data-[state=open]/collapsible:rotate-180 flex-shrink-0" />
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
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
