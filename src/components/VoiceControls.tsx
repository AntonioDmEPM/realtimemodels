import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';

interface VoiceControlsProps {
  onStart: (voice: string, model: string) => void;
  onStop: () => void;
  isConnected: boolean;
  statusMessage: string;
  statusType: 'idle' | 'success' | 'error' | 'connecting';
  onModelChange?: (model: string) => void;
}

const REALTIME_MODELS = [
  { id: 'gpt-4o-realtime-preview-2024-12-17', name: 'GPT-4o Realtime (2024-12-17)' },
  { id: 'gpt-4o-mini-realtime-preview-2024-12-17', name: 'GPT-4o Mini Realtime (2024-12-17)' },
  { id: 'gpt-realtime', name: 'GPT Realtime' },
  { id: 'gpt-realtime-mini', name: 'GPT Realtime Mini' },
];

const VOICES = [
  { value: 'ash', label: 'Ash' },
  { value: 'ballad', label: 'Ballad' },
  { value: 'coral', label: 'Coral' },
  { value: 'sage', label: 'Sage' },
  { value: 'verse', label: 'Verse' },
];

export default function VoiceControls({
  onStart,
  onStop,
  isConnected,
  statusMessage,
  statusType,
  onModelChange,
}: VoiceControlsProps) {
  const [voice, setVoice] = useState('ash');
  const [model, setModel] = useState('gpt-4o-realtime-preview-2024-12-17');

  useEffect(() => {
    const savedModel = localStorage.getItem('selected_model');
    if (savedModel && REALTIME_MODELS.find(m => m.id === savedModel)) {
      setModel(savedModel);
      onModelChange?.(savedModel);
    }
  }, []);

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    localStorage.setItem('selected_model', newModel);
    onModelChange?.(newModel);
  };

  const handleStart = () => {
    onStart(voice, model);
  };

  const getStatusColor = () => {
    switch (statusType) {
      case 'success':
        return 'text-accent';
      case 'error':
        return 'text-destructive';
      case 'connecting':
        return 'text-primary';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <Card className="p-6 shadow-card bg-card/50 backdrop-blur-sm border-primary/20">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="model">Model</Label>
          <Select value={model} onValueChange={handleModelChange} disabled={isConnected}>
            <SelectTrigger id="model" className="bg-background/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REALTIME_MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="voice">Voice</Label>
          <Select value={voice} onValueChange={setVoice} disabled={isConnected}>
            <SelectTrigger id="voice" className="bg-background/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VOICES.map((v) => (
                <SelectItem key={v.value} value={v.value}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={isConnected ? onStop : handleStart}
          className="w-full bg-primary hover:bg-primary/90"
          variant={isConnected ? 'destructive' : 'default'}
        >
          {isConnected ? 'Stop Session' : 'Start Session'}
        </Button>

        {statusMessage && (
          <p className={`text-sm font-medium transition-smooth ${getStatusColor()}`}>
            {statusMessage}
          </p>
        )}
      </div>
    </Card>
  );
}
