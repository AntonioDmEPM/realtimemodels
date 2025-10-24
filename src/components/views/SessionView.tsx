import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import AudioIndicator from '@/components/AudioIndicator';
import ConversationTimer from '@/components/ConversationTimer';
import SentimentIndicator from '@/components/SentimentIndicator';
import ConversationMessages from '@/components/ConversationMessages';
import { AnalyticsPanel } from '@/components/AnalyticsPanel';
import { SessionStats } from '@/utils/webrtcAudio';
import { TokenDataPoint } from '@/components/TokenDashboard';

interface EventEntry {
  timestamp: string;
  data: any;
}

interface SessionViewProps {
  isConnected: boolean;
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
  currentStats: SessionStats;
  sessionStats: SessionStats;
  tokenDataPoints: TokenDataPoint[];
  totalInputTokens: number;
  totalOutputTokens: number;
  events: EventEntry[];
  onStart: () => void;
  onStop: () => void;
  onResetAll: () => void;
  onChatInputChange: (value: string) => void;
  onSendMessage: () => void;
}

export function SessionView({
  isConnected,
  isAudioActive,
  sessionStartTime,
  currentSentiment,
  mode,
  chatInput,
  chatMessages,
  currentStats,
  sessionStats,
  tokenDataPoints,
  totalInputTokens,
  totalOutputTokens,
  events,
  onStart,
  onStop,
  onResetAll,
  onChatInputChange,
  onSendMessage,
}: SessionViewProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Session Controls */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              onClick={isConnected ? onStop : onStart}
              variant={isConnected ? 'destructive' : 'default'}
            >
              {isConnected ? 'Stop Session' : 'Start Session'}
            </Button>
            <Button onClick={onResetAll} variant="outline" disabled={isConnected}>
              Reset All
            </Button>
          </div>
          
          <div className="flex items-center gap-4">
            <AudioIndicator isActive={isAudioActive} />
            <ConversationTimer
              startTime={sessionStartTime}
              isActive={isConnected}
            />
          </div>
        </div>
      </div>

      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* LEFT SIDE - Conversation & Sentiment */}
        <ResizablePanel defaultSize={55} minSize={30}>
          <div className="h-full flex flex-col overflow-hidden">
            {/* Sentiment Indicator - Fixed at top */}
            <div className="border-b p-4">
              <SentimentIndicator sentiment={currentSentiment} />
            </div>
            
            {/* Conversation - Full scrollable area */}
            <ScrollArea className="flex-1">
              <ConversationMessages events={events} />
            </ScrollArea>

            {/* Chat Input (for chat mode) */}
            {mode === 'chat' && (
              <div className="border-t p-4">
                <div className="flex gap-2">
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
                    disabled={!isConnected}
                  />
                  <Button
                    onClick={onSendMessage}
                    disabled={!isConnected || !chatInput.trim()}
                    size="icon"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* RIGHT SIDE - Analytics (Fixed with independent scrolling) */}
        <ResizablePanel defaultSize={45} minSize={25}>
          <div className="h-full flex flex-col overflow-hidden">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                <AnalyticsPanel
                  currentStats={currentStats}
                  sessionStats={sessionStats}
                  tokenDataPoints={tokenDataPoints}
                  sessionStartTime={sessionStartTime}
                  isActive={isConnected}
                  totalInputTokens={totalInputTokens}
                  totalOutputTokens={totalOutputTokens}
                  events={events}
                />
              </div>
            </ScrollArea>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
