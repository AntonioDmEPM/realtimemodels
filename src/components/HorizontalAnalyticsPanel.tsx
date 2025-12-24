import { BarChart3, Activity, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
      
      <div className="p-4 flex flex-col gap-4">
          {/* Session Stats */}
          <Card className="w-full">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 flex-shrink-0" />
                <span>Session Stats</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Recent</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Input:</span>
                    <span className="font-mono">{(currentStats.audioInputTokens + currentStats.textInputTokens).toLocaleString()}</span>
                    <span className="text-muted-foreground">Output:</span>
                    <span className="font-mono">{(currentStats.audioOutputTokens + currentStats.textOutputTokens).toLocaleString()}</span>
                    <span className="text-muted-foreground">Cost:</span>
                    <span className="font-mono text-primary">${currentStats.totalCost.toFixed(4)}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Session Total</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Input:</span>
                    <span className="font-mono">{(sessionStats.audioInputTokens + sessionStats.textInputTokens).toLocaleString()}</span>
                    <span className="text-muted-foreground">Output:</span>
                    <span className="font-mono">{(sessionStats.audioOutputTokens + sessionStats.textOutputTokens).toLocaleString()}</span>
                    <span className="text-muted-foreground">Cost:</span>
                    <span className="font-mono text-primary">${sessionStats.totalCost.toFixed(4)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Token Dashboard */}
          <Card className="w-full">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 flex-shrink-0" />
                <span>Token Usage</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="h-[180px]">
                <TokenDashboard
                  dataPoints={tokenDataPoints}
                  sessionStartTime={sessionStartTime}
                  isActive={isActive}
                  totalInputTokens={totalInputTokens}
                  totalOutputTokens={totalOutputTokens}
                />
              </div>
            </CardContent>
          </Card>

          {/* Event Log */}
          <Card className="w-full">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 flex-shrink-0" />
                <span>Event Log</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="h-[200px] overflow-hidden">
                <EventLog events={events} />
              </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
