import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import type { RealtimeModelSettings } from '@/types/modelSettings';

interface RealtimeModelSettingsProps {
  settings: RealtimeModelSettings;
  onChange: (settings: RealtimeModelSettings) => void;
  disabled?: boolean;
}

export function RealtimeModelSettings({ settings, onChange, disabled }: RealtimeModelSettingsProps) {
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
        <p className="text-xs text-muted-foreground">Controls randomness. Lower = focused, higher = creative</p>
      </div>

      {/* Max Output Tokens */}
      <div className="space-y-2">
        <Label>Max Output Tokens</Label>
        <Select
          value={settings.maxOutputTokens.toString()}
          onValueChange={(value) => onChange({ ...settings, maxOutputTokens: value === 'inf' ? 'inf' : parseInt(value) })}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="inf">Infinite</SelectItem>
            <SelectItem value="1024">1,024</SelectItem>
            <SelectItem value="2048">2,048</SelectItem>
            <SelectItem value="4096">4,096</SelectItem>
            <SelectItem value="8192">8,192</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Maximum length of the model's response</p>
      </div>

      {/* Modalities */}
      <div className="space-y-2">
        <Label>Modalities</Label>
        <div className="flex gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="audio-modality"
              checked={settings.modalities.includes('audio')}
              onCheckedChange={(checked) => {
                const modalities = checked
                  ? [...settings.modalities, 'audio']
                  : settings.modalities.filter(m => m !== 'audio');
                onChange({ ...settings, modalities: modalities as ('text' | 'audio')[] });
              }}
              disabled={disabled}
            />
            <label htmlFor="audio-modality" className="text-sm cursor-pointer">Audio</label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="text-modality"
              checked={settings.modalities.includes('text')}
              onCheckedChange={(checked) => {
                const modalities = checked
                  ? [...settings.modalities, 'text']
                  : settings.modalities.filter(m => m !== 'text');
                onChange({ ...settings, modalities: modalities as ('text' | 'audio')[] });
              }}
              disabled={disabled}
            />
            <label htmlFor="text-modality" className="text-sm cursor-pointer">Text</label>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Input/output modes for the conversation</p>
      </div>

      {/* Turn Detection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Voice Activity Detection (VAD)</Label>
          <Switch
            checked={settings.turnDetection !== null}
            onCheckedChange={(checked) => {
              onChange({
                ...settings,
                turnDetection: checked ? {
                  type: 'server_vad',
                  threshold: 0.5,
                  prefixPaddingMs: 300,
                  silenceDurationMs: 1000
                } : null
              });
            }}
            disabled={disabled}
          />
        </div>
        <p className="text-xs text-muted-foreground">Automatic turn detection based on voice activity</p>

        {settings.turnDetection && (
          <div className="space-y-4 pl-4 border-l-2 border-primary/20">
            <div className="space-y-2">
              <Label>Threshold: {settings.turnDetection.threshold}</Label>
              <Slider
                value={[settings.turnDetection.threshold]}
                onValueChange={([value]) => onChange({
                  ...settings,
                  turnDetection: { ...settings.turnDetection!, threshold: value }
                })}
                min={0}
                max={1}
                step={0.1}
                disabled={disabled}
              />
              <p className="text-xs text-muted-foreground">Sensitivity of voice detection</p>
            </div>

            <div className="space-y-2">
              <Label>Prefix Padding (ms)</Label>
              <Input
                type="number"
                value={settings.turnDetection.prefixPaddingMs}
                onChange={(e) => onChange({
                  ...settings,
                  turnDetection: { ...settings.turnDetection!, prefixPaddingMs: parseInt(e.target.value) || 0 }
                })}
                disabled={disabled}
                min={0}
                step={100}
              />
              <p className="text-xs text-muted-foreground">Audio to include before speech starts</p>
            </div>

            <div className="space-y-2">
              <Label>Silence Duration (ms)</Label>
              <Input
                type="number"
                value={settings.turnDetection.silenceDurationMs}
                onChange={(e) => onChange({
                  ...settings,
                  turnDetection: { ...settings.turnDetection!, silenceDurationMs: parseInt(e.target.value) || 0 }
                })}
                disabled={disabled}
                min={0}
                step={100}
              />
              <p className="text-xs text-muted-foreground">Silence duration before turn ends</p>
            </div>
          </div>
        )}
      </div>

      {/* Input Audio Transcription */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Input Audio Transcription</Label>
          <p className="text-xs text-muted-foreground">Transcribe user audio with Whisper</p>
        </div>
        <Switch
          checked={settings.inputAudioTranscription}
          onCheckedChange={(checked) => onChange({ ...settings, inputAudioTranscription: checked })}
          disabled={disabled}
        />
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
    </div>
  );
}
