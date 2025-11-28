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
        return 'bg-green-600 text-white rounded-tr-sm';
      case 'negative':
        return 'bg-red-600 text-white rounded-tr-sm';
      case 'mixed':
        return 'bg-yellow-600 text-white rounded-tr-sm';
      case 'neutral':
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
    const knowledgeResultsMap = new Map<string, any[]>(); // call_id -> knowledge results
    const pendingKnowledge: any[] = []; // Store knowledge results until next assistant message
    const sentimentMap = new Map<string, any>(); // timestamp -> sentiment data for matching

    console.log('Extracting messages from events:', events.length);

    // First pass: collect all sentiment events by timestamp
    events.forEach((event) => {
      if (event.data.type === 'sentiment.detected') {
        console.log('Found sentiment detection:', event.data, 'at timestamp:', event.timestamp);
        sentimentMap.set(event.data.timestamp, {
          sentiment: event.data.sentiment,
          confidence: event.data.confidence,
          reason: event.data.reason
        });
      }
    });

    console.log('Collected sentiments:', sentimentMap.size);

    // Second pass: process messages and match sentiments
    events.forEach((event, index) => {
      const eventType = event.data.type;
      
      // Log first few events for debugging
      if (index < 5) {
        console.log('Event type:', eventType, 'Data:', event.data);
      }

      // Capture knowledge base search results
      if (eventType === 'knowledge_base.search_results') {
        console.log('Found knowledge results:', event.data.results?.length || 0);
        pendingKnowledge.push(...(event.data.results || []));
      }

      // Capture user input transcriptions from completed events (try both event types)
      if (eventType === 'conversation.item.input_audio_transcription.completed' || 
          eventType === 'conversation.item.input_audio_transcription.done') {
        console.log('Found user transcription:', event.data.transcript, 'at timestamp:', event.timestamp);
        
        // Find the closest sentiment by timestamp (within 10 seconds in either direction)
        // Sentiment detection happens AFTER the user message, so we need to look both ways
        let closestSentiment = null;
        let closestTimeDiff = Infinity;
        let closestTimestampKey: string | null = null;
        const messageTime = new Date(event.timestamp).getTime();
        
        for (const [sentimentTimestamp, sentimentData] of sentimentMap.entries()) {
          const sentimentTime = new Date(sentimentTimestamp).getTime();
          const timeDiff = Math.abs(messageTime - sentimentTime);
          
          // Sentiment should be within 10 seconds of the message (before or after)
          if (timeDiff <= 10000 && timeDiff < closestTimeDiff) {
            closestSentiment = sentimentData;
            closestTimeDiff = timeDiff;
            closestTimestampKey = sentimentTimestamp;
            console.log('Found potential sentiment match:', sentimentData, 'time diff:', timeDiff, 'ms');
          }
        }
        
        if (closestTimestampKey) {
          console.log('Matched sentiment:', closestSentiment, 'to message at time diff:', closestTimeDiff, 'ms');
          sentimentMap.delete(closestTimestampKey); // Remove to avoid reusing
        }
        
        messages.push({
          id: `msg-${messageIdCounter++}`,
          role: 'user',
          content: event.data.transcript || '[Audio input]',
          timestamp: event.timestamp,
          sentiment: closestSentiment,
        });
      }

      // Accumulate text deltas for text-mode responses
      if (eventType === 'response.text.delta') {
        const responseId = event.data.response_id;
        const delta = event.data.delta;
        const current = textDeltaMap.get(responseId) || '';
        textDeltaMap.set(responseId, current + delta);
      }

      // Finalize text response when done
      if (eventType === 'response.text.done') {
        const responseId = event.data.response_id;
        const text = event.data.text || textDeltaMap.get(responseId) || '';
        if (text && !processedResponseIds.has(responseId)) {
          console.log('Found complete text response:', text);
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
          pendingKnowledge.length = 0; // Clear pending knowledge after use
        }
      }

      // Skip response.audio_transcript.done - we already get transcripts from response.done
      // This prevents duplicate messages from being added
      if (eventType === 'response.audio_transcript.done') {
        // Intentionally skip - response.done already contains the transcript
        return;
      }

      // Capture assistant messages from response.done events (audio mode)
      if (eventType === 'response.done' && event.data.response?.output) {
        const responseId = event.data.response_id;
        // Skip if we already processed this response from other events (only check if responseId exists)
        if (responseId && processedResponseIds.has(responseId)) {
          return;
        }
        
        // Mark as processed immediately to prevent audio_transcript.done from duplicating
        if (responseId) processedResponseIds.add(responseId);
        
        const output = event.data.response.output;
        console.log('Found response.done with output:', output.length);
        const knowledge = pendingKnowledge.length > 0 ? [...pendingKnowledge] : undefined;
        
        // Extract transcript from the output array
        for (const item of output) {
          if (item.role === 'assistant' && item.content) {
            for (const content of item.content) {
              if (content.type === 'audio' && content.transcript) {
                console.log('Found assistant transcript:', content.transcript);
                messages.push({
                  id: `msg-${messageIdCounter++}`,
                  role: 'assistant',
                  content: content.transcript,
                  timestamp: event.timestamp,
                  knowledge,
                });
                pendingKnowledge.length = 0;
              } else if (content.type === 'text' && content.text) {
                // Also handle text type from output
                console.log('Found assistant text:', content.text);
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
      }

      // Also capture user text input from conversation.item.created events
      if (eventType === 'conversation.item.created' && event.data.item?.role === 'user') {
        const item = event.data.item;
        console.log('📨 conversation.item.created for user:', JSON.stringify(item, null, 2));
        
        // For audio items, always wait for the separate transcription event
        // Don't try to extract transcript from here even if present
        const hasAudioContent = item.content?.some((c: any) => c.type === 'input_audio');
        if (hasAudioContent) {
          console.log('⏭️ Audio item detected - waiting for dedicated transcription event');
          return;
        }
        
        if (item.content) {
          for (const content of item.content) {
            if (content.type === 'input_text' && content.text) {
              // Find the closest sentiment by timestamp (within 10 seconds in either direction)
              let closestSentiment = null;
              let closestTimeDiff = Infinity;
              let closestTimestampKey: string | null = null;
              const messageTime = new Date(event.timestamp).getTime();
              
              for (const [sentimentTimestamp, sentimentData] of sentimentMap.entries()) {
                const sentimentTime = new Date(sentimentTimestamp).getTime();
                const timeDiff = Math.abs(messageTime - sentimentTime);
                
                if (timeDiff <= 10000 && timeDiff < closestTimeDiff) {
                  closestSentiment = sentimentData;
                  closestTimeDiff = timeDiff;
                  closestTimestampKey = sentimentTimestamp;
                }
              }
              
              if (closestTimestampKey) {
                sentimentMap.delete(closestTimestampKey);
              }
              
              messages.push({
                id: `msg-${messageIdCounter++}`,
                role: 'user',
                content: content.text,
                timestamp: event.timestamp,
                sentiment: closestSentiment,
              });
            } else if (content.type === 'input_audio' && content.transcript) {
              // Find the closest sentiment by timestamp (within 10 seconds in either direction)
              let closestSentiment = null;
              let closestTimeDiff = Infinity;
              let closestTimestampKey: string | null = null;
              const messageTime = new Date(event.timestamp).getTime();
              
              for (const [sentimentTimestamp, sentimentData] of sentimentMap.entries()) {
                const sentimentTime = new Date(sentimentTimestamp).getTime();
                const timeDiff = Math.abs(messageTime - sentimentTime);
                
                if (timeDiff <= 10000 && timeDiff < closestTimeDiff) {
                  closestSentiment = sentimentData;
                  closestTimeDiff = timeDiff;
                  closestTimestampKey = sentimentTimestamp;
                }
              }
              
              if (closestTimestampKey) {
                sentimentMap.delete(closestTimestampKey);
              }
              
              messages.push({
                id: `msg-${messageIdCounter++}`,
                role: 'user',
                content: content.transcript,
                timestamp: event.timestamp,
                sentiment: closestSentiment,
              });
            }
          }
        }
      }
    });

    console.log('Extracted messages:', messages.length);
    
    // Sort by timestamp (precise to milliseconds) to ensure correct ordering
    return messages.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeA - timeB; // Oldest first
    });
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
