import { DollarSign } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SessionStats } from '@/utils/webrtcAudio';
import { cn } from '@/lib/utils';

interface CompactCostIndicatorProps {
  stats: SessionStats;
  className?: string;
}

export default function CompactCostIndicator({ stats, className }: CompactCostIndicatorProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted/50 cursor-default",
            className
          )}>
            <DollarSign className="w-4 h-4 text-primary" />
            <span className="text-sm font-mono font-medium">
              ${stats.totalCost.toFixed(4)}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="text-sm space-y-1">
            <p className="font-medium">API Cost Breakdown</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
              <span className="text-muted-foreground">Input:</span>
              <span className="font-mono">${stats.inputCost.toFixed(4)}</span>
              <span className="text-muted-foreground">Output:</span>
              <span className="font-mono">${stats.outputCost.toFixed(4)}</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
