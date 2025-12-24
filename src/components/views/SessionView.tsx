import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Search } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import CompactVoiceVisualizer from '@/components/CompactVoiceVisualizer';
import CompactSentiment from '@/components/CompactSentiment';
import CompactCostIndicator from '@/components/CompactCostIndicator';
import CompactTimer from '@/components/CompactTimer';
import ConversationMessages from '@/components/ConversationMessages';
import { HorizontalAnalyticsPanel } from '@/components/HorizontalAnalyticsPanel';
import { SessionStats } from '@/utils/webrtcAudio';
import { TokenDataPoint } from '@/components/TokenDashboard';

interface EventEntry {
  timestamp: string;
  data: any;
}

interface SessionViewProps {
  isConnected: boolean;
  isConnecting: boolean;
  isAudioActive: boolean;
  sessionStartTime: number | null;
  currentSentiment: {
    sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
    confidence: number;
    reason?: string;
  } | null;
  mode: 'voice' | 'chat';
  chatInput: string;
  chatMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  isSearching?: boolean;
  currentStats: SessionStats;
  sessionStats: SessionStats;
  tokenDataPoints: TokenDataPoint[];
  totalInputTokens: number;
  totalOutputTokens: number;
  events: EventEntry[];
  audioStream?: MediaStream | null;
  speakingState?: 'user' | 'assistant' | null;
  onStart: () => void;
  onStop: () => void;
  onResetAll: () => void;
  onChatInputChange: (value: string) => void;
  onSendMessage: () => void;
}

export function SessionView({
  isConnected,
  isConnecting,
  isAudioActive,
  sessionStartTime,
  currentSentiment,
  mode,
  chatInput,
  chatMessages,
  isSearching = false,
  currentStats,
  sessionStats,
  tokenDataPoints,
  totalInputTokens,
  totalOutputTokens,
  events,
  audioStream,
  speakingState,
  onStart,
  onStop,
  onResetAll,
  onChatInputChange,
  onSendMessage,
}: SessionViewProps) {
  return (
    <div className="flex flex-col">
      {/* TOP BAR - Controls, Visualizer, Sentiment, Cost, Timer */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between gap-4 p-3">
          {/* Left: Controls */}
          <div className="flex items-center gap-3">
            {mode === 'voice' && (
              <>
                <Button
                  onClick={isConnected ? onStop : onStart}
                  variant={isConnected ? 'destructive' : 'default'}
                  size="sm"
                  disabled={isConnecting}
                  className="min-w-[80px]"
                >
                  {isConnecting ? 'Connecting...' : isConnected ? 'Stop' : 'Start'}
                </Button>
                <Button onClick={onResetAll} variant="outline" size="sm" disabled={isConnected}>
                  Reset
                </Button>
              </>
            )}
            {mode === 'chat' && (
              <Button onClick={onResetAll} variant="outline" size="sm">
                Clear Chat
              </Button>
            )}
          </div>

          {/* Center: Voice Visualizer (only in voice mode) */}
          {mode === 'voice' && (
            <CompactVoiceVisualizer
              inputStream={audioStream}
              isConnected={isConnected}
              isSpeaking={speakingState}
            />
          )}

          {/* Right: Sentiment, Cost, Timer */}
          <div className="flex items-center gap-2">
            <CompactSentiment sentiment={currentSentiment} />
            <CompactCostIndicator stats={sessionStats} />
            {mode === 'voice' && (
              <CompactTimer isActive={isConnected} startTime={sessionStartTime} />
            )}
            {isSearching && (
              <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground animate-pulse">
                <Search className="h-3 w-3 animate-spin" />
                <span>Searching...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Conversation (scrollable) */}
      <section className="p-4">
        <div className="h-[60vh] min-h-[360px] max-h-[70vh] rounded-md border bg-background">
          <ScrollArea className="h-full">
            <ConversationMessages events={events} />
          </ScrollArea>
        </div>

        {/* Chat Input (for chat mode) */}
        {mode === 'chat' && (
          <div className="mt-4 bg-background">
            <div className="flex gap-2 max-w-3xl mx-auto">
              <Input
                value={chatInput}
                onChange={(e) => onChatInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onSendMessage();
                  }
                }}
                placeholder="Type your message..."
                className="flex-1"
              />
              <Button onClick={onSendMessage} disabled={!chatInput.trim()} size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Analytics (page-scrollable, not internally scrollable) */}
      <section>
        <HorizontalAnalyticsPanel
          currentStats={currentStats}
          sessionStats={sessionStats}
          tokenDataPoints={tokenDataPoints}
          sessionStartTime={sessionStartTime}
          isActive={isConnected}
          totalInputTokens={totalInputTokens}
          totalOutputTokens={totalOutputTokens}
          events={events}
        />
      </section>
    </div>
  );
}
