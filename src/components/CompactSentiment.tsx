import { Smile, Meh, Frown, TrendingUp } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface CompactSentimentProps {
  sentiment: {
    sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
    confidence: number;
    reason?: string;
  } | null;
  className?: string;
}

export default function CompactSentiment({ sentiment, className }: CompactSentimentProps) {
  const getSentimentIcon = () => {
    if (!sentiment) return <Meh className="w-5 h-5 text-muted-foreground" />;
    
    switch (sentiment.sentiment) {
      case 'positive':
        return <Smile className="w-5 h-5 text-green-500" />;
      case 'negative':
        return <Frown className="w-5 h-5 text-red-500" />;
      case 'mixed':
        return <TrendingUp className="w-5 h-5 text-yellow-500" />;
      default:
        return <Meh className="w-5 h-5 text-blue-500" />;
    }
  };

  const getLabel = () => {
    if (!sentiment) return 'Analyzing...';
    return `${sentiment.sentiment} (${Math.round(sentiment.confidence * 100)}%)`;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 cursor-default",
            className
          )}>
            {getSentimentIcon()}
            <span className="text-xs font-medium capitalize">
              {sentiment?.sentiment || '—'}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="text-sm">
            <p className="font-medium">{getLabel()}</p>
            {sentiment?.reason && (
              <p className="text-muted-foreground text-xs mt-1">{sentiment.reason}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
