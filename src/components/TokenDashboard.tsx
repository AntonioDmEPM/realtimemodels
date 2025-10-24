import { Card } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, TrendingUp, TrendingDown } from 'lucide-react';

export interface TokenDataPoint {
  timestamp: number;
  elapsedSeconds: number;
  inputTokens: number;
  outputTokens: number;
  cumulativeInput: number;
  cumulativeOutput: number;
}

interface TokenDashboardProps {
  dataPoints: TokenDataPoint[];
  sessionStartTime: number | null;
  isActive: boolean;
  totalInputTokens: number;
  totalOutputTokens: number;
}

export default function TokenDashboard({ 
  dataPoints, 
  sessionStartTime, 
  isActive,
  totalInputTokens,
  totalOutputTokens 
}: TokenDashboardProps) {
  if (!sessionStartTime) {
    return (
      <Card className="p-6 shadow-card bg-card/50 backdrop-blur-sm border-primary/20">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Token Usage Dashboard</h2>
        </div>
        <p className="text-muted-foreground text-center py-8">
          Start a conversation to see token usage analytics
        </p>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border p-4 rounded-lg shadow-lg">
          <p className="font-semibold mb-2">{data.elapsedSeconds.toFixed(1)}s</p>
          <div className="space-y-1">
            <p className="text-sm flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(var(--chart-1))' }}></span>
              Input: {data.inputTokens} tokens
            </p>
            <p className="text-sm flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(var(--chart-2))' }}></span>
              Output: {data.outputTokens} tokens
            </p>
          </div>
          <div className="mt-2 pt-2 border-t border-border space-y-1">
            <p className="text-xs text-muted-foreground">Cumulative:</p>
            <p className="text-xs">Input: {data.cumulativeInput}</p>
            <p className="text-xs">Output: {data.cumulativeOutput}</p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="p-3 sm:p-4 lg:p-6 shadow-card bg-card/50 backdrop-blur-sm border-primary/20">
      <div className="flex items-center justify-between mb-4 sm:mb-6 pb-2 sm:pb-3 border-b">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          <h2 className="text-sm sm:text-base lg:text-xl font-semibold">Token Usage</h2>
        </div>
        {isActive && (
          <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-muted-foreground hidden sm:inline">Live</span>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="p-3 sm:p-4 bg-secondary/50 rounded-lg border border-primary/10">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-muted-foreground mb-1">Total Input Tokens</p>
              <p className="text-lg sm:text-2xl lg:text-3xl font-bold font-mono truncate">{totalInputTokens.toLocaleString()}</p>
            </div>
            <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-chart-1 opacity-50 flex-shrink-0 ml-2" />
          </div>
        </div>
        <div className="p-3 sm:p-4 bg-secondary/50 rounded-lg border border-primary/10">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-muted-foreground mb-1">Total Output Tokens</p>
              <p className="text-lg sm:text-2xl lg:text-3xl font-bold font-mono truncate">{totalOutputTokens.toLocaleString()}</p>
            </div>
            <TrendingDown className="h-6 w-6 sm:h-8 sm:w-8 text-chart-2 opacity-50 flex-shrink-0 ml-2" />
          </div>
        </div>
      </div>

      {/* Charts */}
      {dataPoints.length > 0 ? (
        <div className="space-y-4 sm:space-y-6 lg:space-y-8 mt-3 sm:mt-4">
          {/* Cumulative Chart */}
          <div>
            <h3 className="text-sm sm:text-base lg:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              <span className="truncate">Cumulative Tokens</span>
            </h3>
            <ResponsiveContainer width="100%" height={250} minWidth={200}>
              <LineChart 
                data={dataPoints} 
                margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
                <XAxis 
                  dataKey="elapsedSeconds" 
                  label={{ value: 'Time (seconds)', position: 'insideBottom', offset: -10 }}
                  className="text-xs"
                  tickFormatter={(value) => value.toFixed(0)}
                />
                <YAxis 
                  label={{ value: 'Cumulative Tokens', angle: -90, position: 'insideLeft' }}
                  className="text-xs"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="line"
                />
                <Line 
                  type="monotone" 
                  dataKey="cumulativeInput" 
                  stroke="hsl(var(--chart-1))" 
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  name="Cumulative Input"
                  animationDuration={300}
                  isAnimationActive={isActive}
                />
                <Line 
                  type="monotone" 
                  dataKey="cumulativeOutput" 
                  stroke="hsl(var(--chart-2))" 
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  name="Cumulative Output"
                  animationDuration={300}
                  isAnimationActive={isActive}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Per-Interaction Chart */}
          <div>
            <h3 className="text-sm sm:text-base lg:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              <span className="truncate">Per-Interaction</span>
            </h3>
            <ResponsiveContainer width="100%" height={250} minWidth={200}>
              <LineChart 
                data={dataPoints} 
                margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
                <XAxis 
                  dataKey="elapsedSeconds" 
                  label={{ value: 'Time (seconds)', position: 'insideBottom', offset: -10 }}
                  className="text-xs"
                  tickFormatter={(value) => value.toFixed(0)}
                />
                <YAxis 
                  label={{ value: 'Tokens per Interaction', angle: -90, position: 'insideLeft' }}
                  className="text-xs"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="line"
                />
                <Line 
                  type="monotone" 
                  dataKey="inputTokens" 
                  stroke="hsl(var(--chart-3))" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Input Tokens"
                  animationDuration={300}
                  isAnimationActive={isActive}
                />
                <Line 
                  type="monotone" 
                  dataKey="outputTokens" 
                  stroke="hsl(var(--chart-4))" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Output Tokens"
                  animationDuration={300}
                  isAnimationActive={isActive}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="py-12 text-center text-muted-foreground">
          <Activity className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>Waiting for token data...</p>
        </div>
      )}

      {/* Session End Summary */}
      {!isActive && dataPoints.length > 0 && (
        <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-secondary/30 rounded-lg border border-primary/10">
          <h3 className="text-sm sm:text-base font-semibold mb-2 sm:mb-3 flex items-center gap-2">
            <Activity className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>Summary</span>
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
            <div className="min-w-0">
              <p className="text-muted-foreground truncate">Duration</p>
              <p className="font-mono font-semibold truncate">
                {dataPoints[dataPoints.length - 1]?.elapsedSeconds.toFixed(1)}s
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground truncate">Input</p>
              <p className="font-mono font-semibold truncate">{totalInputTokens.toLocaleString()}</p>
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground truncate">Output</p>
              <p className="font-mono font-semibold truncate">{totalOutputTokens.toLocaleString()}</p>
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground truncate">Total</p>
              <p className="font-mono font-semibold truncate">{(totalInputTokens + totalOutputTokens).toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
