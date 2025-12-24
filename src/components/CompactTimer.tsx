import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CompactTimerProps {
  isActive: boolean;
  startTime: number | null;
  className?: string;
}

export default function CompactTimer({ isActive, startTime, className }: CompactTimerProps) {
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!isActive || !startTime) {
      setDuration(0);
      return;
    }

    const interval = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, startTime]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50",
      className
    )}>
      <Clock className="w-4 h-4 text-primary" />
      <span className="text-sm font-mono font-medium min-w-[52px]">
        {formatTime(duration)}
      </span>
    </div>
  );
}
