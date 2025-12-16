import { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface VoiceVisualizerProps {
  inputStream?: MediaStream | null;
  outputStream?: MediaStream | null;
  isConnected: boolean;
  isSpeaking?: 'user' | 'assistant' | null;
  size?: number;
  className?: string;
}

export default function VoiceVisualizer({ 
  inputStream, 
  outputStream,
  isConnected,
  isSpeaking,
  size = 200,
  className
}: VoiceVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const inputAnalyzerRef = useRef<AnalyserNode | null>(null);
  const outputAnalyzerRef = useRef<AnalyserNode | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);

  // Setup audio analyzer for a stream
  const setupAnalyzer = useCallback((stream: MediaStream, isInput: boolean) => {
    try {
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 256;
      analyzer.smoothingTimeConstant = 0.8;
      source.connect(analyzer);
      
      if (isInput) {
        inputContextRef.current = audioContext;
        inputAnalyzerRef.current = analyzer;
      } else {
        outputContextRef.current = audioContext;
        outputAnalyzerRef.current = analyzer;
      }
      
      return analyzer;
    } catch (err) {
      console.error('Error setting up analyzer:', err);
      return null;
    }
  }, []);

  // Setup input stream analyzer
  useEffect(() => {
    if (inputStream && isConnected) {
      setupAnalyzer(inputStream, true);
    }
    
    return () => {
      if (inputContextRef.current) {
        inputContextRef.current.close();
        inputContextRef.current = null;
      }
      inputAnalyzerRef.current = null;
    };
  }, [inputStream, isConnected, setupAnalyzer]);

  // Animation loop
  useEffect(() => {
    if (!canvasRef.current || !isConnected) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size with device pixel ratio for sharpness
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const centerX = size / 2;
    const centerY = size / 2;
    const baseRadius = size * 0.35;
    const numPoints = 64;

    const getFrequencyData = (analyzer: AnalyserNode | null): Uint8Array => {
      if (!analyzer) return new Uint8Array(128).fill(0);
      const data = new Uint8Array(analyzer.frequencyBinCount);
      analyzer.getByteFrequencyData(data);
      return data;
    };

    const getAverageLevel = (data: Uint8Array): number => {
      const sum = data.reduce((a, b) => a + b, 0);
      return sum / data.length / 255;
    };

    let phase = 0;
    
    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      
      // Get frequency data
      const inputData = getFrequencyData(inputAnalyzerRef.current);
      const currentInputLevel = getAverageLevel(inputData);
      setInputLevel(currentInputLevel);
      
      // Determine active level based on who's speaking
      const activeLevel = isSpeaking === 'user' ? currentInputLevel : 
                         isSpeaking === 'assistant' ? 0.5 + Math.sin(Date.now() / 200) * 0.3 : 
                         currentInputLevel * 0.3;
      
      // Draw outer glow
      const glowIntensity = activeLevel * 30;
      const gradient = ctx.createRadialGradient(
        centerX, centerY, baseRadius - 10,
        centerX, centerY, baseRadius + glowIntensity + 20
      );
      
      const primaryColor = isSpeaking === 'user' ? 'hsl(217, 91%, 60%)' : // Blue for user
                          isSpeaking === 'assistant' ? 'hsl(280, 87%, 65%)' : // Purple for assistant
                          'hsl(217, 91%, 60%)'; // Default blue
      
      const primaryColorFaded = isSpeaking === 'user' ? 'hsla(217, 91%, 60%, 0)' :
                               isSpeaking === 'assistant' ? 'hsla(280, 87%, 65%, 0)' :
                               'hsla(217, 91%, 60%, 0)';
      
      gradient.addColorStop(0, primaryColor);
      gradient.addColorStop(1, primaryColorFaded);
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius + glowIntensity + 20, 0, Math.PI * 2);
      ctx.fill();

      // Draw inner circle (dark background)
      ctx.fillStyle = 'hsl(var(--background))';
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius - 5, 0, Math.PI * 2);
      ctx.fill();

      // Draw waveform border
      ctx.beginPath();
      
      for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2 - Math.PI / 2;
        
        // Get frequency amplitude for this point
        const freqIndex = Math.floor((i / numPoints) * inputData.length * 0.5);
        const amplitude = inputData[freqIndex] / 255;
        
        // Calculate wave displacement
        const waveAmplitude = isSpeaking ? 
          Math.max(8, amplitude * 25 + Math.sin(angle * 8 + phase) * 5 * activeLevel) :
          2 + Math.sin(angle * 4 + phase * 0.5) * 2;
        
        const radius = baseRadius + waveAmplitude;
        
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      ctx.closePath();
      
      // Stroke with gradient
      const strokeGradient = ctx.createLinearGradient(0, 0, size, size);
      if (isSpeaking === 'assistant') {
        strokeGradient.addColorStop(0, 'hsl(280, 87%, 65%)');
        strokeGradient.addColorStop(0.5, 'hsl(320, 87%, 60%)');
        strokeGradient.addColorStop(1, 'hsl(280, 87%, 65%)');
      } else {
        strokeGradient.addColorStop(0, 'hsl(217, 91%, 60%)');
        strokeGradient.addColorStop(0.5, 'hsl(200, 91%, 55%)');
        strokeGradient.addColorStop(1, 'hsl(217, 91%, 60%)');
      }
      
      ctx.strokeStyle = strokeGradient;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Draw center icon/indicator
      ctx.fillStyle = isSpeaking ? primaryColor : 'hsl(var(--muted-foreground))';
      ctx.beginPath();
      
      if (isSpeaking === 'user') {
        // Microphone icon (simplified)
        const iconSize = 20;
        ctx.roundRect(centerX - 6, centerY - iconSize/2, 12, iconSize, 6);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX, centerY + iconSize/2 + 4, 10, Math.PI, 0, false);
        ctx.lineWidth = 2;
        ctx.strokeStyle = primaryColor;
        ctx.stroke();
      } else if (isSpeaking === 'assistant') {
        // Sound wave icon (simplified)
        for (let j = 0; j < 3; j++) {
          const barHeight = 8 + j * 8;
          ctx.fillRect(centerX - 12 + j * 10, centerY - barHeight/2, 4, barHeight);
        }
      } else {
        // Idle circle
        ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
        ctx.fill();
      }

      phase += 0.05;
      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isConnected, isSpeaking, size]);

  // Idle state when not connected
  if (!isConnected) {
    return (
      <div 
        className={cn("relative flex items-center justify-center", className)}
        style={{ width: size, height: size }}
      >
        <div 
          className="absolute rounded-full border-2 border-muted-foreground/30 transition-all duration-300"
          style={{ width: size * 0.7, height: size * 0.7 }}
        />
        <div 
          className="absolute rounded-full border border-muted-foreground/20"
          style={{ width: size * 0.8, height: size * 0.8 }}
        />
        <div className="w-4 h-4 rounded-full bg-muted-foreground/50" />
        <span className="absolute bottom-0 text-xs text-muted-foreground">
          Disconnected
        </span>
      </div>
    );
  }

  return (
    <div className={cn("relative flex flex-col items-center gap-2", className)}>
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="transition-opacity duration-300"
      />
      <span className="text-xs text-muted-foreground">
        {isSpeaking === 'user' ? 'Listening...' : 
         isSpeaking === 'assistant' ? 'Speaking...' : 
         'Ready'}
      </span>
    </div>
  );
}
