import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

export interface PricingConfig {
  audioInputCost: number;
  audioOutputCost: number;
  cachedAudioCost: number;
  textInputCost: number;
  textOutputCost: number;
}

export const MODEL_PRICING = {
  "gpt-4o-realtime-preview-2024-12-17": {
    audioInputCost: 0.00004,
    audioOutputCost: 0.00008,
    cachedAudioCost: 0.0000025,
    textInputCost: 0.000005,
    textOutputCost: 0.00002,
  },
  "gpt-4o-mini-realtime-preview-2024-12-17": {
    audioInputCost: 0.00001,
    audioOutputCost: 0.00002,
    cachedAudioCost: 0.0000003,
    textInputCost: 0.0000006,
    textOutputCost: 0.0000024,
  },
  "gpt-realtime": {
    audioInputCost: 0.000032,
    audioOutputCost: 0.000064,
    cachedAudioCost: 0.0000004,
    textInputCost: 0.000004,
    textOutputCost: 0.000016,
  },
  "gpt-realtime-mini": {
    audioInputCost: 0.00001,
    audioOutputCost: 0.00002,
    cachedAudioCost: 0.0000003,
    textInputCost: 0.0000006,
    textOutputCost: 0.0000024,
  },
};

interface PricingSettingsProps {
  onPricingChange: (pricing: PricingConfig) => void;
  selectedModel: string;
}

export default function PricingSettings({ onPricingChange, selectedModel }: PricingSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pricing, setPricing] = useState<PricingConfig>(
    MODEL_PRICING[selectedModel as keyof typeof MODEL_PRICING] || MODEL_PRICING["gpt-4o-realtime-preview-2024-12-17"]
  );

  useEffect(() => {
    const modelKey = selectedModel as keyof typeof MODEL_PRICING;
    const defaultPricing = MODEL_PRICING[modelKey] || MODEL_PRICING["gpt-4o-realtime-preview-2024-12-17"];
    
    const saved = localStorage.getItem(`pricing_config_${selectedModel}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPricing(parsed);
        onPricingChange(parsed);
      } catch (e) {
        console.error('Failed to parse saved pricing:', e);
        setPricing(defaultPricing);
        onPricingChange(defaultPricing);
      }
    } else {
      setPricing(defaultPricing);
      onPricingChange(defaultPricing);
    }
  }, [selectedModel]);

  const handleChange = (field: keyof PricingConfig, value: string) => {
    const numValue = parseFloat(value) || 0;
    // Convert from per million to per token for storage
    const newPricing = { ...pricing, [field]: numValue / 1000000 };
    setPricing(newPricing);
  };

  const handleSave = () => {
    localStorage.setItem(`pricing_config_${selectedModel}`, JSON.stringify(pricing));
    onPricingChange(pricing);
  };

  const handleReset = () => {
    const modelKey = selectedModel as keyof typeof MODEL_PRICING;
    const defaultPricing = MODEL_PRICING[modelKey] || MODEL_PRICING["gpt-4o-realtime-preview-2024-12-17"];
    setPricing(defaultPricing);
    localStorage.removeItem(`pricing_config_${selectedModel}`);
    onPricingChange(defaultPricing);
  };

  return (
    <Card className="p-6 shadow-card bg-card/50 backdrop-blur-sm border-primary/20">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full">
          <h2 className="text-xl font-semibold">Pricing Configuration</h2>
          <ChevronDown className={`transition-transform text-primary ${isOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="audioInputCost">Audio Input Cost (per 1M tokens)</Label>
              <Input
                id="audioInputCost"
                type="number"
                step="0.01"
                value={pricing.audioInputCost * 1000000}
                onChange={(e) => handleChange('audioInputCost', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="audioOutputCost">Audio Output Cost (per 1M tokens)</Label>
              <Input
                id="audioOutputCost"
                type="number"
                step="0.01"
                value={pricing.audioOutputCost * 1000000}
                onChange={(e) => handleChange('audioOutputCost', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cachedAudioCost">Cached Audio Cost (per 1M tokens)</Label>
              <Input
                id="cachedAudioCost"
                type="number"
                step="0.01"
                value={pricing.cachedAudioCost * 1000000}
                onChange={(e) => handleChange('cachedAudioCost', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="textInputCost">Text Input Cost (per 1M tokens)</Label>
              <Input
                id="textInputCost"
                type="number"
                step="0.01"
                value={pricing.textInputCost * 1000000}
                onChange={(e) => handleChange('textInputCost', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="textOutputCost">Text Output Cost (per 1M tokens)</Label>
              <Input
                id="textOutputCost"
                type="number"
                step="0.01"
                value={pricing.textOutputCost * 1000000}
                onChange={(e) => handleChange('textOutputCost', e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} className="bg-primary hover:bg-primary/90">Save Pricing</Button>
            <Button onClick={handleReset} variant="outline" className="border-primary/30 hover:bg-primary/10">Reset to Defaults</Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Model: <span className="text-primary font-mono">{selectedModel}</span>
          </p>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
