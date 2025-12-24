import { useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface CompactVoiceVisualizerProps {
  inputStream?: MediaStream | null;
  isConnected: boolean;
  isSpeaking?: 'user' | 'assistant' | null;
  className?: string;
}

export default function CompactVoiceVisualizer({ 
  inputStream, 
  isConnected,
  isSpeaking,
  className
}: CompactVoiceVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const inputAnalyzerRef = useRef<AnalyserNode | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);

  const setupAnalyzer = useCallback((stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 128;
      analyzer.smoothingTimeConstant = 0.8;
      source.connect(analyzer);
      
      inputContextRef.current = audioContext;
      inputAnalyzerRef.current = analyzer;
      
      return analyzer;
    } catch (err) {
      console.error('Error setting up analyzer:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    if (inputStream && isConnected) {
      setupAnalyzer(inputStream);
    }
    
    return () => {
      if (inputContextRef.current) {
        inputContextRef.current.close();
        inputContextRef.current = null;
      }
      inputAnalyzerRef.current = null;
    };
  }, [inputStream, isConnected, setupAnalyzer]);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 120;
    const height = 36;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const barCount = 12;
    const barWidth = 4;
    const gap = 6;
    const startX = (width - (barCount * (barWidth + gap) - gap)) / 2;

    const getFrequencyData = (analyzer: AnalyserNode | null): Uint8Array => {
      if (!analyzer) return new Uint8Array(64).fill(0);
      const data = new Uint8Array(analyzer.frequencyBinCount);
      analyzer.getByteFrequencyData(data);
      return data;
    };

    let phase = 0;
    
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      
      const inputData = getFrequencyData(inputAnalyzerRef.current);
      
      // Color based on speaking state
      const getColor = () => {
        if (isSpeaking === 'user') return 'hsl(217, 91%, 60%)';
        if (isSpeaking === 'assistant') return 'hsl(280, 87%, 65%)';
        return 'hsl(215, 20%, 50%)';
      };
      
      ctx.fillStyle = getColor();
      
      for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor((i * inputData.length) / barCount);
        let amplitude = inputData[dataIndex] / 255;
        
        // Add wave animation when speaking
        if (isSpeaking === 'assistant') {
          amplitude = 0.3 + Math.sin(phase + i * 0.5) * 0.4 + Math.sin(phase * 1.5 + i * 0.3) * 0.2;
        } else if (!isSpeaking && isConnected) {
          amplitude = 0.15 + Math.sin(phase * 0.5 + i * 0.3) * 0.1;
        } else if (!isConnected) {
          amplitude = 0.1;
        }
        
        const barHeight = Math.max(3, amplitude * (height - 8));
        const x = startX + i * (barWidth + gap);
        const y = (height - barHeight) / 2;
        
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }
      
      phase += 0.1;
      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isConnected, isSpeaking]);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <canvas
        ref={canvasRef}
        style={{ width: 120, height: 36 }}
        className="rounded-md bg-muted/30"
      />
      <span className="text-xs font-medium text-muted-foreground min-w-[60px]">
        {isSpeaking === 'user' ? 'Listening' : 
         isSpeaking === 'assistant' ? 'Speaking' : 
         isConnected ? 'Ready' : 'Idle'}
      </span>
    </div>
  );
}
