import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface EventEntry {
  timestamp: string;
  data: any;
}

interface EventLogProps {
  events: EventEntry[];
}

export default function EventLog({ events }: EventLogProps) {
  const [showRawEvents, setShowRawEvents] = useState(true);

  const filteredEvents = showRawEvents 
    ? events 
    : events.filter(e => e.data.type === 'response.done' || e.data.type === 'error');

  return (
    <Card className="p-6 shadow-card bg-card/50 backdrop-blur-sm border-primary/20">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Session Events</h2>
        <div className="flex items-center space-x-2">
          <Switch
            id="show-raw"
            checked={showRawEvents}
            onCheckedChange={setShowRawEvents}
          />
          <Label htmlFor="show-raw">Show all events</Label>
        </div>
      </div>
      <ScrollArea className="h-[400px] w-full rounded-lg border">
        <div className="p-4 space-y-3">
          {filteredEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No events yet. Start a session to see events.
            </p>
          ) : (
            filteredEvents.map((event, index) => (
              <div
                key={index}
                className="font-mono text-xs p-4 bg-secondary rounded-lg border-l-4 border-primary"
              >
                <div className="text-muted-foreground mb-2">{event.timestamp}</div>
                <pre className="whitespace-pre-wrap break-all">
                  {JSON.stringify(event.data, null, 2)}
                </pre>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}
