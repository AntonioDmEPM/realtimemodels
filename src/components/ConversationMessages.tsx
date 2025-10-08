import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, Bot } from "lucide-react";

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
}

export default function ConversationMessages({ events }: ConversationMessagesProps) {
  // Extract conversation messages from events
  const extractMessages = (): Message[] => {
    const messages: Message[] = [];
    let messageIdCounter = 0;

    console.log('Extracting messages from events:', events.length);

    events.forEach((event, index) => {
      const eventType = event.data.type;
      
      // Log first few events for debugging
      if (index < 5) {
        console.log('Event type:', eventType, 'Data:', event.data);
      }

      // Capture user input transcriptions from completed events
      if (eventType === 'conversation.item.input_audio_transcription.completed') {
        console.log('Found user transcription:', event.data.transcript);
        messages.push({
          id: `msg-${messageIdCounter++}`,
          role: 'user',
          content: event.data.transcript || '[Audio input]',
          timestamp: event.timestamp,
        });
      }

      // Capture assistant messages from response.done events
      if (eventType === 'response.done' && event.data.response?.output) {
        const output = event.data.response.output;
        console.log('Found response.done with output:', output.length);
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
                });
              }
            }
          }
        }
      }

      // Also capture user text input from conversation.item.created events
      if (eventType === 'conversation.item.created' && event.data.item?.role === 'user') {
        const item = event.data.item;
        console.log('Found conversation.item.created for user:', item);
        if (item.content) {
          for (const content of item.content) {
            if (content.type === 'input_text' && content.text) {
              messages.push({
                id: `msg-${messageIdCounter++}`,
                role: 'user',
                content: content.text,
                timestamp: event.timestamp,
              });
            } else if (content.type === 'input_audio' && content.transcript) {
              messages.push({
                id: `msg-${messageIdCounter++}`,
                role: 'user',
                content: content.transcript,
                timestamp: event.timestamp,
              });
            }
          }
        }
      }
    });

    console.log('Extracted messages:', messages.length);
    // Reverse to show oldest first (events are stored newest first)
    return messages.reverse();
  };

  const messages = extractMessages();

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversation</CardTitle>
      </CardHeader>
      <CardContent>
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No conversation yet. Start a session to see messages here.
          </div>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
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
                    <div
                      className={`rounded-2xl px-4 py-2 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-tr-sm'
                          : 'bg-muted text-foreground rounded-tl-sm'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground px-2">
                      {formatTime(message.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
