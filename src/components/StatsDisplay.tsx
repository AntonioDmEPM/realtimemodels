import { Card } from '@/components/ui/card';
import { SessionStats } from '@/utils/webrtcAudio';

interface StatsDisplayProps {
  title: string;
  stats: SessionStats;
}

export default function StatsDisplay({ title, stats }: StatsDisplayProps) {
  return (
    <Card className="p-3 sm:p-4 lg:p-6 shadow-card bg-card/50 backdrop-blur-sm border-primary/20">
      {title && (
        <div className="flex items-center justify-between mb-4 sm:mb-6 pb-2 sm:pb-3 border-b">
          <h2 className="text-base sm:text-lg lg:text-xl font-semibold truncate">{title}</h2>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:gap-6">
        <div className="space-y-2 sm:space-y-3 p-3 sm:p-4 bg-secondary rounded-lg">
          <h3 className="font-medium text-xs sm:text-sm text-muted-foreground uppercase tracking-wide truncate">
            Input Tokens
          </h3>
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex justify-between text-xs sm:text-sm gap-2">
              <span className="truncate">Audio:</span>
              <span className="font-semibold text-primary flex-shrink-0">
                {stats.audioInputTokens.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm gap-2">
              <span className="truncate">Text:</span>
              <span className="font-semibold text-primary flex-shrink-0">
                {stats.textInputTokens.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm gap-2">
              <span className="truncate">Cached:</span>
              <span className="font-semibold text-primary flex-shrink-0">
                {stats.cachedInputTokens.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2 sm:space-y-3 p-3 sm:p-4 bg-secondary rounded-lg">
          <h3 className="font-medium text-xs sm:text-sm text-muted-foreground uppercase tracking-wide truncate">
            Output Tokens
          </h3>
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex justify-between text-xs sm:text-sm gap-2">
              <span className="truncate">Audio:</span>
              <span className="font-semibold text-primary flex-shrink-0">
                {stats.audioOutputTokens.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm gap-2">
              <span className="truncate">Text:</span>
              <span className="font-semibold text-primary flex-shrink-0">
                {stats.textOutputTokens.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2 sm:space-y-3 p-3 sm:p-4 bg-secondary rounded-lg">
          <h3 className="font-medium text-xs sm:text-sm text-muted-foreground uppercase tracking-wide truncate">
            Costs
          </h3>
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex justify-between text-xs sm:text-sm gap-2">
              <span className="truncate">Input:</span>
              <span className="font-semibold text-primary flex-shrink-0">
                ${stats.inputCost.toFixed(4)}
              </span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm gap-2">
              <span className="truncate">Output:</span>
              <span className="font-semibold text-primary flex-shrink-0">
                ${stats.outputCost.toFixed(4)}
              </span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm font-medium pt-1.5 sm:pt-2 border-t gap-2">
              <span className="truncate">Total:</span>
              <span className="text-sm sm:text-base lg:text-lg text-primary flex-shrink-0">
                ${stats.totalCost.toFixed(4)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
