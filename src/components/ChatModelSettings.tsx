import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ChatModelSettings } from '@/types/modelSettings';

interface ChatModelSettingsProps {
  settings: ChatModelSettings;
  onChange: (settings: ChatModelSettings) => void;
  disabled?: boolean;
}

export function ChatModelSettings({ settings, onChange, disabled }: ChatModelSettingsProps) {
  return (
    <div className="space-y-6">
      {/* Temperature */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Temperature: {settings.temperature}</Label>
        </div>
        <Slider
          value={[settings.temperature]}
          onValueChange={([value]) => onChange({ ...settings, temperature: value })}
          min={0}
          max={1}
          step={0.1}
          disabled={disabled}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">Controls randomness. Lower = focused, higher = creative. Note: GPT-5 models may have restrictions.</p>
      </div>

      {/* Top P */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Top P: {settings.topP}</Label>
        </div>
        <Slider
          value={[settings.topP]}
          onValueChange={([value]) => onChange({ ...settings, topP: value })}
          min={0}
          max={1}
          step={0.05}
          disabled={disabled}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">Nucleus sampling - considers tokens with top probability mass</p>
      </div>

      {/* Max Output Tokens */}
      <div className="space-y-2">
        <Label>Max Output Tokens</Label>
        <Input
          type="number"
          value={settings.maxOutputTokens}
          onChange={(e) => onChange({ ...settings, maxOutputTokens: parseInt(e.target.value) || 0 })}
          disabled={disabled}
          min={1}
          step={256}
        />
        <p className="text-xs text-muted-foreground">Maximum length of the model's response</p>
      </div>

      {/* Frequency Penalty */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Frequency Penalty: {settings.frequencyPenalty}</Label>
        </div>
        <Slider
          value={[settings.frequencyPenalty]}
          onValueChange={([value]) => onChange({ ...settings, frequencyPenalty: value })}
          min={-2}
          max={2}
          step={0.1}
          disabled={disabled}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">Reduces repetition based on token frequency</p>
      </div>

      {/* Presence Penalty */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Presence Penalty: {settings.presencePenalty}</Label>
        </div>
        <Slider
          value={[settings.presencePenalty]}
          onValueChange={([value]) => onChange({ ...settings, presencePenalty: value })}
          min={-2}
          max={2}
          step={0.1}
          disabled={disabled}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">Encourages new topics based on presence</p>
      </div>

      {/* Stop Sequences */}
      <div className="space-y-2">
        <Label>Stop Sequences</Label>
        <Input
          placeholder="Enter comma-separated sequences"
          value={settings.stopSequences.join(', ')}
          onChange={(e) => onChange({
            ...settings,
            stopSequences: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
          })}
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">Sequences where the model will stop generating</p>
      </div>

      {/* Reasoning Effort (GPT-5 Models) */}
      <div className="space-y-2">
        <Label>Reasoning Effort (GPT-5 Models)</Label>
        <Select
          value={settings.reasoningEffort}
          onValueChange={(value: 'low' | 'medium' | 'high') => onChange({ ...settings, reasoningEffort: value })}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select reasoning effort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Controls how much computational effort the model uses for reasoning (GPT-5 only)</p>
      </div>

      {/* Max Reasoning Tokens (GPT-5 Models) */}
      <div className="space-y-2">
        <Label>Max Reasoning Tokens (GPT-5 Models)</Label>
        <Input
          type="number"
          value={settings.maxReasoningTokens}
          onChange={(e) => onChange({ ...settings, maxReasoningTokens: parseInt(e.target.value) || 10000 })}
          disabled={disabled}
          min={1000}
          max={100000}
          step={1000}
        />
        <p className="text-xs text-muted-foreground">Maximum tokens allocated for reasoning process (GPT-5 only)</p>
      </div>
    </div>
  );
}
