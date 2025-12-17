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
    <div className="h-full flex flex-col">
      {/* Session Controls - Compact header */}
      <div className="border-b p-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {mode === 'voice' && (
              <>
                <Button
                  onClick={isConnected ? onStop : onStart}
                  variant={isConnected ? 'destructive' : 'default'}
                  size="sm"
                  disabled={isConnecting}
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
          
          <div className="flex items-center gap-4">
            {mode === 'voice' && (
              <ConversationTimer
                startTime={sessionStartTime}
                isActive={isConnected}
              />
            )}
            {mode === 'chat' && (
              <span className="text-sm text-muted-foreground">
                Chat Mode
              </span>
            )}
          </div>
        </div>
      </div>

      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* LEFT SIDE - Visualizer & Conversation */}
        <ResizablePanel defaultSize={55} minSize={30}>
          <div className="h-full flex flex-col overflow-hidden">
            {/* Voice Visualizer - Central and prominent */}
            {mode === 'voice' && (
              <div className="flex-shrink-0 flex flex-col items-center justify-center py-6 border-b bg-gradient-to-b from-background to-muted/20">
                <VoiceVisualizer
                  inputStream={audioStream}
                  isConnected={isConnected}
                  isSpeaking={speakingState}
                  size={180}
                />
              </div>
            )}
            
            {/* Sentiment Indicator */}
            <div className="border-b p-3">
              <SentimentIndicator sentiment={currentSentiment} />
            </div>
            
            {/* Conversation - Scrollable area */}
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

        {/* RIGHT SIDE - Analytics */}
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
