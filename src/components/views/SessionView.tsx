import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import VoiceVisualizer from '@/components/VoiceVisualizer';
import ConversationTimer from '@/components/ConversationTimer';
import SentimentIndicator from '@/components/SentimentIndicator';
import ConversationMessages from '@/components/ConversationMessages';
import { AnalyticsPanel } from '@/components/AnalyticsPanel';
import { SessionStats } from '@/utils/webrtcAudio';
import { TokenDataPoint } from '@/components/TokenDashboard';
import { Skeleton } from '@/components/ui/skeleton';

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
    <div className="h-full flex flex-col">
      {/* Session Controls */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {mode === 'voice' && (
              <>
                <Button
                  onClick={isConnected ? onStop : onStart}
                  variant={isConnected ? 'destructive' : 'default'}
                >
                  {isConnected ? 'Stop Session' : 'Start Session'}
                </Button>
                <Button onClick={onResetAll} variant="outline" disabled={isConnected}>
                  Reset All
                </Button>
              </>
            )}
            {mode === 'chat' && (
              <Button onClick={onResetAll} variant="outline">
                Clear Chat
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {mode === 'voice' && (
              <div className="flex items-center gap-4">
                <VoiceVisualizer
                  inputStream={audioStream}
                  isConnected={isConnected}
                  isSpeaking={speakingState}
                  size={60}
                />
                <ConversationTimer
                  startTime={sessionStartTime}
                  isActive={isConnected}
                />
              </div>
            )}
            {mode === 'chat' && (
              <span className="text-sm text-muted-foreground">
                Chat Mode - No session required
              </span>
            )}
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
                  />
                  <Button
                    onClick={onSendMessage}
                    disabled={!chatInput.trim()}
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
