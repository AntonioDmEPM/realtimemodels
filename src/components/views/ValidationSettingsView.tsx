import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Clock, FileText } from 'lucide-react';

interface ValidationSettingsViewProps {
  validationEnabled: boolean;
  validationRules: string;
  validationDelayMs: number;
  onValidationEnabledChange: (enabled: boolean) => void;
  onValidationRulesChange: (rules: string) => void;
  onValidationDelayChange: (delayMs: number) => void;
}

export function ValidationSettingsView({
  validationEnabled,
  validationRules,
  validationDelayMs,
  onValidationEnabledChange,
  onValidationRulesChange,
  onValidationDelayChange,
}: ValidationSettingsViewProps) {
  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Response Validation</h1>
          <p className="text-muted-foreground">
            Validate AI responses before audio playback using custom rules
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Enable Validation
            </CardTitle>
            <CardDescription>
              When enabled, AI responses are validated against your rules before the audio plays.
              If validation fails, an apology message is played instead.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="validation-enabled">Response Validation</Label>
                <p className="text-sm text-muted-foreground">
                  {validationEnabled ? (
                    <Badge variant="default" className="bg-green-600">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Disabled</Badge>
                  )}
                </p>
              </div>
              <Switch
                id="validation-enabled"
                checked={validationEnabled}
                onCheckedChange={onValidationEnabledChange}
              />
            </div>
          </CardContent>
        </Card>

        <Card className={!validationEnabled ? 'opacity-50' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Audio Buffer Delay
            </CardTitle>
            <CardDescription>
              How long to buffer audio before playing, giving time for validation.
              Higher values give more time but increase latency.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Delay: {validationDelayMs}ms</Label>
                <span className="text-sm text-muted-foreground">
                  {validationDelayMs < 300 ? 'Fast' : validationDelayMs < 600 ? 'Balanced' : 'Safe'}
                </span>
              </div>
              <Slider
                value={[validationDelayMs]}
                onValueChange={([value]) => onValidationDelayChange(value)}
                min={100}
                max={3000}
                step={100}
                disabled={!validationEnabled}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>100ms</span>
                <span>1.5s</span>
                <span>3s</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={!validationEnabled ? 'opacity-50' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Validation Rules
            </CardTitle>
            <CardDescription>
              Define the rules that AI responses must comply with. Be specific about what's allowed and what's not.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Example rules:
- Do not discuss competitors or their products
- Never make promises about delivery times
- Avoid using profanity or inappropriate language
- Do not share internal pricing or discount information
- Always refer users to support for billing questions"
              value={validationRules}
              onChange={(e) => onValidationRulesChange(e.target.value)}
              rows={8}
              disabled={!validationEnabled}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              The AI will check each response against these rules. If any rule is violated, 
              the audio will be muted and an apology will be played.
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <div className="shrink-0 text-amber-500">⚠️</div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Important Notes</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Validation adds latency equal to the buffer delay</li>
                  <li>• The validation LLM call may occasionally fail - responses will pass by default</li>
                  <li>• Complex rules may take longer to evaluate</li>
                  <li>• Test your rules thoroughly before going live</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
