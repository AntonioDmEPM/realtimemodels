import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, VolumeX, Check, AlertCircle } from 'lucide-react';

type TestStatus = 'idle' | 'playing' | 'success' | 'error';

export function AudioOutputTest() {
  const [status, setStatus] = useState<TestStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const playTestTone = async () => {
    setStatus('playing');
    setErrorMsg(null);

    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) {
        throw new Error('Web Audio API not supported');
      }

      const ctx = new AudioContext();

      // Resume context if suspended (autoplay policy)
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // Create a simple tone (440Hz sine wave)
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, ctx.currentTime); // A4 note

      // Fade in/out to avoid clicks
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);

      // Wait for tone to finish
      await new Promise((resolve) => setTimeout(resolve, 600));

      ctx.close();
      setStatus('success');

      // Reset after 2 seconds
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err: any) {
      console.error('Audio test failed:', err);
      setErrorMsg(err.message || 'Audio playback failed');
      setStatus('error');

      // Reset after 3 seconds
      setTimeout(() => {
        setStatus('idle');
        setErrorMsg(null);
      }, 3000);
    }
  };

  const getIcon = () => {
    switch (status) {
      case 'playing':
        return <Volume2 className="h-4 w-4 animate-pulse" />;
      case 'success':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Volume2 className="h-4 w-4" />;
    }
  };

  const getLabel = () => {
    switch (status) {
      case 'playing':
        return 'Playing...';
      case 'success':
        return 'Audio OK!';
      case 'error':
        return errorMsg || 'Failed';
      default:
        return 'Test Audio';
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={playTestTone}
      disabled={status === 'playing'}
      className="gap-2"
    >
      {getIcon()}
      <span className="text-xs">{getLabel()}</span>
    </Button>
  );
}
