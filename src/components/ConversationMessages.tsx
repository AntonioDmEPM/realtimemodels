import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { User, Bot } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

interface EventEntry {
  timestamp: string;
  data: any;
}

interface ConversationMessagesProps {
  events: EventEntry[];
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  knowledge?: Array<{
    content: string;
    metadata?: any;
  }>;
  sentiment?: {
    sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
    confidence: number;
    reason?: string;
  };
}

export default function ConversationMessages({ events }: ConversationMessagesProps) {
  const getSentimentBubbleClasses = (sentiment?: Message['sentiment']) => {
    if (!sentiment) {
      return 'bg-primary text-primary-foreground rounded-tr-sm';
    }

    switch (sentiment.sentiment) {
      case 'positive':
        return 'bg-chart-2 text-sentiment-foreground rounded-tr-sm';
      case 'negative':
        return 'bg-chart-4 text-sentiment-foreground rounded-tr-sm';
      case 'mixed':
        return 'bg-chart-5 text-sentiment-foreground rounded-tr-sm';
      case 'neutral':
        return 'bg-chart-1 text-sentiment-foreground rounded-tr-sm';
      default:
        return 'bg-primary text-primary-foreground rounded-tr-sm';
    }
  };

  // Extract conversation messages from events
  const extractMessages = (): Message[] => {
    const messages: Message[] = [];
    let messageIdCounter = 0;

    const textDeltaMap = new Map<string, string>(); // response_id -> accumulated text
    const processedResponseIds = new Set<string>(); // Track processed response IDs to avoid duplicates

    const pendingKnowledge: any[] = []; // Store knowledge results until next assistant message

    // Robust sentiment attachment:
    // - sentiment can arrive before/after transcription
    // - timestamps are often unreliable (local receipt time)
    // So we attach sentiment to the most recent user message without sentiment,
    // otherwise we keep it as pending for the next user message.
    let pendingSentiment: Message['sentiment'] | undefined;

    const applySentimentToMostRecentUserMessage = (sentiment: Message['sentiment']) => {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user' && !messages[i].sentiment) {
          messages[i].sentiment = sentiment;
          return true;
        }
      }
      return false;
    };

    const consumePendingSentiment = (): Message['sentiment'] | undefined => {
      const s = pendingSentiment;
      pendingSentiment = undefined;
      return s;
    };

    const eventsChrono = [...events].slice().sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeA - timeB;
    });

    console.log('Extracting messages from events:', eventsChrono.length);

    eventsChrono.forEach((event) => {
      const eventType = event.data.type;

      // Capture sentiment events (for per-message coloring)
      if (eventType === 'sentiment.detected') {
        const sentiment: Message['sentiment'] = {
          sentiment: event.data.sentiment,
          confidence: event.data.confidence,
          reason: event.data.reason,
        };

        // Prefer attaching to last user message; otherwise store for next user message
        if (!applySentimentToMostRecentUserMessage(sentiment)) {
          pendingSentiment = sentiment;
        }
        return;
      }

      // Capture knowledge base search results
      if (eventType === 'knowledge_base.search_results') {
        pendingKnowledge.push(...(event.data.results || []));
        return;
      }

      // Capture user input transcriptions
      if (
        eventType === 'conversation.item.input_audio_transcription.completed' ||
        eventType === 'conversation.item.input_audio_transcription.done'
      ) {
        messages.push({
          id: `msg-${messageIdCounter++}`,
          role: 'user',
          content: event.data.transcript || '[Audio input]',
          timestamp: event.timestamp,
          sentiment: consumePendingSentiment(),
        });
        return;
      }

      // Accumulate text deltas for text-mode responses
      if (eventType === 'response.text.delta') {
        const responseId = event.data.response_id;
        const delta = event.data.delta;
        const current = textDeltaMap.get(responseId) || '';
        textDeltaMap.set(responseId, current + delta);
        return;
      }

      // Finalize text response when done
      if (eventType === 'response.text.done') {
        const responseId = event.data.response_id;
        const text = event.data.text || textDeltaMap.get(responseId) || '';
        if (text && responseId && !processedResponseIds.has(responseId)) {
          const knowledge = pendingKnowledge.length > 0 ? [...pendingKnowledge] : undefined;
          messages.push({
            id: `msg-${messageIdCounter++}`,
            role: 'assistant',
            content: text,
            timestamp: event.timestamp,
            knowledge,
          });
          processedResponseIds.add(responseId);
          textDeltaMap.delete(responseId);
          pendingKnowledge.length = 0;
        }
        return;
      }

      // Skip response.audio_transcript.done - we already get transcripts from response.done
      if (eventType === 'response.audio_transcript.done') {
        return;
      }

      // Capture assistant messages from response.done events (audio + chat mode)
      if (eventType === 'response.done' && event.data.response?.output) {
        const responseId = event.data.response_id;
        if (responseId && processedResponseIds.has(responseId)) return;
        if (responseId) processedResponseIds.add(responseId);

        const knowledge = pendingKnowledge.length > 0 ? [...pendingKnowledge] : undefined;

        for (const item of event.data.response.output) {
          if (item.role === 'assistant' && item.content) {
            for (const content of item.content) {
              if (content.type === 'audio' && content.transcript) {
                messages.push({
                  id: `msg-${messageIdCounter++}`,
                  role: 'assistant',
                  content: content.transcript,
                  timestamp: event.timestamp,
                  knowledge,
                });
                pendingKnowledge.length = 0;
              } else if (content.type === 'text' && content.text) {
                messages.push({
                  id: `msg-${messageIdCounter++}`,
                  role: 'assistant',
                  content: content.text,
                  timestamp: event.timestamp,
                  knowledge,
                });
                pendingKnowledge.length = 0;
              }
            }
          }
        }
        return;
      }

      // Capture user text input (chat mode)
      if (eventType === 'conversation.item.created' && event.data.item?.role === 'user') {
        const item = event.data.item;

        // For audio items, always wait for the separate transcription event
        const hasAudioContent = item.content?.some((c: any) => c.type === 'input_audio');
        if (hasAudioContent) return;

        if (item.content) {
          for (const content of item.content) {
            if (content.type === 'input_text' && content.text) {
              messages.push({
                id: `msg-${messageIdCounter++}`,
                role: 'user',
                content: content.text,
                timestamp: event.timestamp,
                sentiment: consumePendingSentiment(),
              });
            } else if (content.type === 'input_audio' && content.transcript) {
              messages.push({
                id: `msg-${messageIdCounter++}`,
                role: 'user',
                content: content.transcript,
                timestamp: event.timestamp,
                sentiment: consumePendingSentiment(),
              });
            }
          }
        }
      }
    });

    console.log('Extracted messages:', messages.length);
    return messages;
  };

  const messages = extractMessages();

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: true 
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4">
        <h3 className="font-semibold">Conversation</h3>
      </div>
      <div className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No conversation yet. Start a session to see messages here.
          </div>
        ) : (
          <TooltipProvider>
            <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className={message.role === 'user' ? 'bg-primary' : 'bg-secondary'}>
                        {message.role === 'user' ? (
                          <User className="h-4 w-4" />
                        ) : (
                          <Bot className="h-4 w-4" />
                        )}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div
                      className={`flex flex-col gap-1 max-w-[70%] ${
                        message.role === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      {message.sentiment && message.role === 'user' && (
                        <Badge 
                          variant="outline"
                          className="text-xs px-2 py-0.5 opacity-80"
                        >
                          {message.sentiment.sentiment} ({Math.round(message.sentiment.confidence * 100)}%)
                        </Badge>
                      )}
                      {message.knowledge && message.knowledge.length > 0 ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={`rounded-2xl px-4 py-2 cursor-help ${
                                message.role === 'user'
                                  ? getSentimentBubbleClasses(message.sentiment)
                                  : 'bg-muted text-foreground rounded-tl-sm'
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap break-words">
                                {message.content}
                              </p>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-md max-h-96 overflow-y-auto">
                            <div className="space-y-2">
                              <p className="font-semibold text-sm">Retrieved Knowledge:</p>
                              {message.knowledge.map((item, idx) => (
                                <div key={idx} className="border-l-2 border-primary pl-2 py-1">
                                  <p className="text-xs whitespace-pre-wrap">{item.content}</p>
                                </div>
                              ))}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <div
                          className={`rounded-2xl px-4 py-2 ${
                            message.role === 'user'
                              ? getSentimentBubbleClasses(message.sentiment)
                              : 'bg-muted text-foreground rounded-tl-sm'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {message.content}
                          </p>
                        </div>
                      )}
                      <span className="text-xs text-muted-foreground px-2">
                        {formatTime(message.timestamp)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}
