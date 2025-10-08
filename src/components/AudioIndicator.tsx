interface AudioIndicatorProps {
  isActive: boolean;
}

export default function AudioIndicator({ isActive }: AudioIndicatorProps) {
  return (
    <div className="inline-flex items-center gap-3">
      <div
        className={`w-5 h-5 rounded-full transition-smooth ${
          isActive
            ? 'bg-accent animate-pulse-audio shadow-lg shadow-accent/50'
            : 'bg-border'
        }`}
      />
      <span className="text-sm font-medium text-muted-foreground">
        {isActive ? 'Audio Active' : 'Audio Inactive'}
      </span>
    </div>
  );
}
