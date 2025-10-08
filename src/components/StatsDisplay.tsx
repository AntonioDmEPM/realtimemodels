import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { SessionStats } from '@/utils/webrtcAudio';

interface StatsDisplayProps {
  title: string;
  stats: SessionStats;
  onReset?: () => void;
  resetDisabled?: boolean;
}

export default function StatsDisplay({ title, stats, onReset, resetDisabled }: StatsDisplayProps) {
  return (
    <Card className="p-6 shadow-card bg-card/50 backdrop-blur-sm border-primary/20">
      <div className="flex items-center justify-between mb-6 pb-3 border-b">
        <h2 className="text-xl font-semibold">{title}</h2>
        {onReset && (
          <Button
            onClick={onReset}
            disabled={resetDisabled}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-3 p-4 bg-secondary rounded-lg">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Input Tokens
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Audio:</span>
              <span className="font-semibold text-primary">
                {stats.audioInputTokens.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Text:</span>
              <span className="font-semibold text-primary">
                {stats.textInputTokens.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Cached:</span>
              <span className="font-semibold text-primary">
                {stats.cachedInputTokens.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3 p-4 bg-secondary rounded-lg">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Output Tokens
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Audio:</span>
              <span className="font-semibold text-primary">
                {stats.audioOutputTokens.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Text:</span>
              <span className="font-semibold text-primary">
                {stats.textOutputTokens.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3 p-4 bg-secondary rounded-lg">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Costs
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Input:</span>
              <span className="font-semibold text-primary">
                ${stats.inputCost.toFixed(4)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Output:</span>
              <span className="font-semibold text-primary">
                ${stats.outputCost.toFixed(4)}
              </span>
            </div>
            <div className="flex justify-between text-sm font-medium pt-2 border-t">
              <span>Total:</span>
              <span className="text-lg text-primary">
                ${stats.totalCost.toFixed(4)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
