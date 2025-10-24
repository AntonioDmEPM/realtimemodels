import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { PricingConfig, MODEL_PRICING } from '@/components/PricingSettings';

const REALTIME_MODELS = [
  { id: 'gpt-4o-realtime-preview-2024-12-17', name: 'GPT-4o Realtime (2024-12-17)' },
  { id: 'gpt-4o-mini-realtime-preview-2024-12-17', name: 'GPT-4o Mini Realtime (2024-12-17)' },
  { id: 'gpt-realtime', name: 'GPT Realtime' },
  { id: 'gpt-realtime-mini', name: 'GPT Realtime Mini' },
];

const CHAT_MODELS = [
  { id: 'openai/gpt-5', name: 'GPT-5' },
  { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini' },
  { id: 'openai/gpt-5-nano', name: 'GPT-5 Nano' },
];

const VOICES = [
  { value: 'ash', label: 'Ash' },
  { value: 'ballad', label: 'Ballad' },
  { value: 'coral', label: 'Coral' },
  { value: 'sage', label: 'Sage' },
  { value: 'verse', label: 'Verse' },
];

interface VoiceModelViewProps {
  selectedModel: string;
  selectedVoice: string;
  mode: 'voice' | 'chat';
  pricingConfig: PricingConfig;
  isConnected: boolean;
  onModelChange: (model: string) => void;
  onVoiceChange: (voice: string) => void;
  onModeChange: (mode: 'voice' | 'chat') => void;
  onPricingChange: (pricing: PricingConfig) => void;
}

export function VoiceModelView({
  selectedModel,
  selectedVoice,
  mode,
  pricingConfig,
  isConnected,
  onModelChange,
  onVoiceChange,
  onModeChange,
  onPricingChange,
}: VoiceModelViewProps) {
  const [localPricing, setLocalPricing] = useState<PricingConfig>(pricingConfig);

  useEffect(() => {
    const modelKey = selectedModel as keyof typeof MODEL_PRICING;
    const defaultPricing = MODEL_PRICING[modelKey] || MODEL_PRICING["gpt-4o-realtime-preview-2024-12-17"];
    
    const saved = localStorage.getItem(`pricing_config_${selectedModel}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setLocalPricing(parsed);
      } catch (e) {
        setLocalPricing(defaultPricing);
      }
    } else {
      setLocalPricing(defaultPricing);
    }
  }, [selectedModel]);

  const handleModelChange = (newModel: string) => {
    onModelChange(newModel);
    localStorage.setItem('selected_model', newModel);
  };

  const handleModeChange = (newMode: 'voice' | 'chat') => {
    onModeChange(newMode);
    localStorage.setItem('interaction_mode', newMode);
    
    const defaultModel = newMode === 'voice' ? 'gpt-4o-realtime-preview-2024-12-17' : 'openai/gpt-5-mini';
    handleModelChange(defaultModel);
  };

  const handlePricingChange = (field: keyof PricingConfig, value: string) => {
    const numValue = parseFloat(value) || 0;
    const newPricing = { ...localPricing, [field]: numValue / 1000000 };
    setLocalPricing(newPricing);
  };

  const handleSavePricing = () => {
    localStorage.setItem(`pricing_config_${selectedModel}`, JSON.stringify(localPricing));
    onPricingChange(localPricing);
  };

  const handleResetPricing = () => {
    const modelKey = selectedModel as keyof typeof MODEL_PRICING;
    const defaultPricing = MODEL_PRICING[modelKey] || MODEL_PRICING["gpt-4o-realtime-preview-2024-12-17"];
    setLocalPricing(defaultPricing);
    localStorage.removeItem(`pricing_config_${selectedModel}`);
    onPricingChange(defaultPricing);
  };

  const currentModels = mode === 'voice' ? REALTIME_MODELS : CHAT_MODELS;

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Voice & Model Settings</h1>
          <p className="text-muted-foreground">Configure your AI model, voice, and pricing</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Model Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mode">Interaction Mode</Label>
              <Select value={mode} onValueChange={handleModeChange} disabled={isConnected}>
                <SelectTrigger id="mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="voice">Voice (Realtime API)</SelectItem>
                  <SelectItem value="chat">Chat (GPT-5 Models)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Select value={selectedModel} onValueChange={handleModelChange} disabled={isConnected}>
                <SelectTrigger id="model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currentModels.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {mode === 'voice' && (
              <div className="space-y-2">
                <Label htmlFor="voice">Voice</Label>
                <Select value={selectedVoice} onValueChange={onVoiceChange} disabled={isConnected}>
                  <SelectTrigger id="voice">
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
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pricing Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="audioInputCost">Audio Input Cost (per 1M tokens)</Label>
                <Input
                  id="audioInputCost"
                  type="number"
                  step="0.01"
                  value={localPricing.audioInputCost * 1000000}
                  onChange={(e) => handlePricingChange('audioInputCost', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="audioOutputCost">Audio Output Cost (per 1M tokens)</Label>
                <Input
                  id="audioOutputCost"
                  type="number"
                  step="0.01"
                  value={localPricing.audioOutputCost * 1000000}
                  onChange={(e) => handlePricingChange('audioOutputCost', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cachedAudioCost">Cached Audio Cost (per 1M tokens)</Label>
                <Input
                  id="cachedAudioCost"
                  type="number"
                  step="0.01"
                  value={localPricing.cachedAudioCost * 1000000}
                  onChange={(e) => handlePricingChange('cachedAudioCost', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="textInputCost">Text Input Cost (per 1M tokens)</Label>
                <Input
                  id="textInputCost"
                  type="number"
                  step="0.01"
                  value={localPricing.textInputCost * 1000000}
                  onChange={(e) => handlePricingChange('textInputCost', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="textOutputCost">Text Output Cost (per 1M tokens)</Label>
                <Input
                  id="textOutputCost"
                  type="number"
                  step="0.01"
                  value={localPricing.textOutputCost * 1000000}
                  onChange={(e) => handlePricingChange('textOutputCost', e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSavePricing}>Save Pricing</Button>
              <Button onClick={handleResetPricing} variant="outline">Reset to Defaults</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Model: <span className="font-mono">{selectedModel}</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
