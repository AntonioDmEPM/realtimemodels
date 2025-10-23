import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Smile, Meh, Frown, TrendingUp } from 'lucide-react';

interface SentimentIndicatorProps {
  sentiment: {
    sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
    confidence: number;
    reason?: string;
  } | null;
}

const SentimentIndicator: React.FC<SentimentIndicatorProps> = ({ sentiment }) => {
  if (!sentiment) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Meh className="w-5 h-5" />
          <span className="text-sm">Waiting for sentiment analysis...</span>
        </div>
      </Card>
    );
  }

  const getSentimentIcon = () => {
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

  const getSentimentColor = () => {
    switch (sentiment.sentiment) {
      case 'positive':
        return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'negative':
        return 'bg-red-500/10 text-red-700 dark:text-red-400';
      case 'mixed':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
      default:
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {getSentimentIcon()}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium">Conversation Sentiment</span>
              <Badge variant="outline" className={getSentimentColor()}>
                {sentiment.sentiment.toUpperCase()}
              </Badge>
            </div>
            {sentiment.reason && (
              <p className="text-xs text-muted-foreground">{sentiment.reason}</p>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Confidence</div>
          <div className="text-sm font-semibold">{(sentiment.confidence * 100).toFixed(0)}%</div>
        </div>
      </div>
    </Card>
  );
};

export default SentimentIndicator;
