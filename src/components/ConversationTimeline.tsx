import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LineChart, Line, ComposedChart, AreaChart, Area } from 'recharts';
import { Activity, Heart } from 'lucide-react';
export interface TimelineSegment {
  start: number;
  end: number;
  speaker: 'user' | 'assistant';
  duration: number;
  inputTokens?: number;
  outputTokens?: number;
  sentiment?: {
    sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
    confidence: number;
  };
}
interface ConversationTimelineProps {
  segments: TimelineSegment[];
  sessionStartTime: number | null;
}
export default function ConversationTimeline({
  segments,
  sessionStartTime
}: ConversationTimelineProps) {
  if (!sessionStartTime || segments.length === 0) {
    return;
  }
  const chartData = segments.map((segment, index) => ({
    name: `${index + 1}`,
    start: (segment.start - sessionStartTime) / 1000,
    duration: segment.duration / 1000,
    speaker: segment.speaker,
    inputTokens: segment.inputTokens || 0,
    outputTokens: segment.outputTokens || 0,
    totalTokens: (segment.inputTokens || 0) + (segment.outputTokens || 0),
    sentiment: segment.sentiment?.sentiment || 'neutral',
    sentimentScore: segment.sentiment ? 
      (segment.sentiment.sentiment === 'positive' ? 1 : 
       segment.sentiment.sentiment === 'negative' ? -1 : 
       segment.sentiment.sentiment === 'mixed' ? 0 : 0) * segment.sentiment.confidence : 0
  }));
  const hasTokenData = segments.some(s => s.inputTokens !== undefined || s.outputTokens !== undefined);
  const hasSentimentData = segments.some(s => s.sentiment !== undefined);
  const CustomTooltip = ({
    active,
    payload
  }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return <div className="bg-background border border-border p-3 rounded-lg shadow-lg">
          <p className="font-semibold">
            {data.speaker === 'user' ? 'User' : 'Assistant'}
          </p>
          <p className="text-sm text-muted-foreground">
            Start: {data.start.toFixed(1)}s
          </p>
          <p className="text-sm text-muted-foreground">
            Duration: {data.duration.toFixed(1)}s
          </p>
          {hasSentimentData && data.sentiment !== 'neutral' && (
            <div className="border-t border-border mt-2 pt-2">
              <p className="text-sm capitalize">
                Sentiment: <span className={
                  data.sentiment === 'positive' ? 'text-green-500' :
                  data.sentiment === 'negative' ? 'text-red-500' :
                  data.sentiment === 'mixed' ? 'text-yellow-500' :
                  'text-muted-foreground'
                }>{data.sentiment}</span>
              </p>
            </div>
          )}
          {hasTokenData && <>
              <div className="border-t border-border mt-2 pt-2">
                <p className="text-sm">
                  <span className="text-chart-3">Input:</span> {data.inputTokens} tokens
                </p>
                <p className="text-sm">
                  <span className="text-chart-4">Output:</span> {data.outputTokens} tokens
                </p>
                <p className="text-sm font-semibold">
                  Total: {data.totalTokens} tokens
                </p>
              </div>
            </>}
        </div>;
    }
    return null;
  };
  return <Card className="p-6 shadow-card bg-card/50 backdrop-blur-sm border-primary/20">
      <h2 className="text-xl font-semibold mb-6 pb-3 border-b">Conversation Timeline</h2>
      
      {/* Speaker Duration Chart */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Speech Duration Over Time</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData} margin={{
          top: 20,
          right: 30,
          left: 20,
          bottom: 5
        }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
            <XAxis dataKey="start" label={{
            value: 'Time (seconds)',
            position: 'insideBottom',
            offset: -5
          }} className="text-xs" />
            <YAxis dataKey="duration" label={{
            value: 'Duration (seconds)',
            angle: -90,
            position: 'insideLeft'
          }} className="text-xs" />
            <Tooltip content={<CustomTooltip />} />
            <Legend formatter={value => value === 'user' ? 'User' : 'Assistant'} wrapperStyle={{
            paddingTop: '20px'
          }} />
            <Bar dataKey="duration" radius={[8, 8, 0, 0]}>
              {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.speaker === 'user' ? 'hsl(var(--primary))' : 'hsl(var(--secondary))'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Sentiment Over Time Chart */}
      {hasSentimentData && <div className="mb-8">
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground flex items-center gap-2">
            <Heart className="h-4 w-4" />
            Sentiment Evolution
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{
          top: 20,
          right: 30,
          left: 20,
          bottom: 5
        }}>
              <defs>
                <linearGradient id="colorSentiment" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
              <XAxis dataKey="start" label={{
            value: 'Time (seconds)',
            position: 'insideBottom',
            offset: -5
          }} className="text-xs" />
              <YAxis domain={[-1, 1]} ticks={[-1, -0.5, 0, 0.5, 1]} 
                label={{
                  value: 'Sentiment',
                  angle: -90,
                  position: 'insideLeft'
                }} 
                className="text-xs"
                tickFormatter={(value) => 
                  value === 1 ? 'Positive' :
                  value === -1 ? 'Negative' :
                  value === 0 ? 'Neutral' :
                  ''
                }
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="sentimentScore" 
                stroke="hsl(var(--chart-1))" 
                fillOpacity={1} 
                fill="url(#colorSentiment)"
                name="Sentiment"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>}

      {/* Token Usage Chart */}
      {hasTokenData && <div>
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Token Usage Per Interaction
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={chartData} margin={{
          top: 20,
          right: 30,
          left: 20,
          bottom: 5
        }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
              <XAxis dataKey="start" label={{
            value: 'Time (seconds)',
            position: 'insideBottom',
            offset: -5
          }} className="text-xs" />
              <YAxis label={{
            value: 'Tokens',
            angle: -90,
            position: 'insideLeft'
          }} className="text-xs" />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{
            paddingTop: '20px'
          }} />
              <Bar dataKey="inputTokens" fill="hsl(var(--chart-3))" name="Input Tokens" />
              <Bar dataKey="outputTokens" fill="hsl(var(--chart-4))" name="Output Tokens" />
              <Line type="monotone" dataKey="totalTokens" stroke="hsl(var(--chart-5))" strokeWidth={2} name="Total Tokens" dot={{
            r: 4
          }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>}

      <div className="mt-4 flex gap-4 justify-center text-sm flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{
          backgroundColor: 'hsl(var(--primary))'
        }}></div>
          <span>User</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{
          backgroundColor: 'hsl(var(--secondary))'
        }}></div>
          <span>Assistant</span>
        </div>
        {hasTokenData && <>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{
            backgroundColor: 'hsl(var(--chart-3))'
          }}></div>
              <span>Input Tokens</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{
            backgroundColor: 'hsl(var(--chart-4))'
          }}></div>
              <span>Output Tokens</span>
            </div>
          </>}
      </div>
    </Card>;
}