import { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface VoiceVisualizerProps {
  inputStream?: MediaStream | null;
  isConnected: boolean;
  isSpeaking?: 'user' | 'assistant' | null;
  size?: number;
  className?: string;
}

export default function VoiceVisualizer({ 
  inputStream, 
  isConnected,
  isSpeaking,
  size = 280,
  className
}: VoiceVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const inputAnalyzerRef = useRef<AnalyserNode | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  
  // Smooth color transition state
  const [colorTransition, setColorTransition] = useState(0); // 0 = blue (user), 1 = purple (assistant)
  const targetColorRef = useRef(0);
  
  // Update target color based on speaking state
  useEffect(() => {
    targetColorRef.current = isSpeaking === 'assistant' ? 1 : 0;
  }, [isSpeaking]);

  // Setup audio analyzer for a stream
  const setupAnalyzer = useCallback((stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 256;
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

  // Setup input stream analyzer
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
    const baseRadius = size * 0.38;
    const numPoints = 80;

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

    // Color interpolation function
    const lerpColor = (t: number) => {
      // Blue (user): hsl(217, 91%, 60%) -> Purple (assistant): hsl(280, 87%, 65%)
      const h = 217 + (280 - 217) * t;
      const s = 91 + (87 - 91) * t;
      const l = 60 + (65 - 60) * t;
      return { h, s, l };
    };

    let phase = 0;
    let currentColor = 0;
    
    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      
      // Smooth color transition
      const colorSpeed = 0.05;
      if (currentColor < targetColorRef.current) {
        currentColor = Math.min(currentColor + colorSpeed, targetColorRef.current);
      } else if (currentColor > targetColorRef.current) {
        currentColor = Math.max(currentColor - colorSpeed, targetColorRef.current);
      }
      setColorTransition(currentColor);
      
      const color = lerpColor(currentColor);
      const primaryHsl = `hsl(${color.h}, ${color.s}%, ${color.l}%)`;
      const primaryHslFaded = `hsla(${color.h}, ${color.s}%, ${color.l}%, 0)`;
      const primaryHslGlow = `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.3)`;
      
      // Get frequency data
      const inputData = getFrequencyData(inputAnalyzerRef.current);
      const currentInputLevel = getAverageLevel(inputData);
      
      // Determine active level based on who's speaking
      const activeLevel = isSpeaking === 'user' ? currentInputLevel : 
                         isSpeaking === 'assistant' ? 0.5 + Math.sin(Date.now() / 150) * 0.3 : 
                         currentInputLevel * 0.2;
      
      // Draw outer glow rings
      const glowIntensity = activeLevel * 40;
      
      // Multiple glow layers for depth
      for (let i = 3; i >= 0; i--) {
        const glowRadius = baseRadius + 15 + glowIntensity + i * 15;
        const alpha = 0.1 - i * 0.02;
        ctx.strokeStyle = `hsla(${color.h}, ${color.s}%, ${color.l}%, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      // Draw main glow
      const gradient = ctx.createRadialGradient(
        centerX, centerY, baseRadius - 20,
        centerX, centerY, baseRadius + glowIntensity + 30
      );
      gradient.addColorStop(0, primaryHslGlow);
      gradient.addColorStop(0.5, `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.15)`);
      gradient.addColorStop(1, primaryHslFaded);
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius + glowIntensity + 30, 0, Math.PI * 2);
      ctx.fill();

      // Draw inner circle (dark background)
      const innerGradient = ctx.createRadialGradient(
        centerX, centerY - 20, 0,
        centerX, centerY, baseRadius
      );
      innerGradient.addColorStop(0, 'hsl(222, 47%, 14%)');
      innerGradient.addColorStop(1, 'hsl(222, 47%, 8%)');
      
      ctx.fillStyle = innerGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius - 8, 0, Math.PI * 2);
      ctx.fill();

      // Draw waveform border
      ctx.beginPath();
      
      for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2 - Math.PI / 2;
        
        // Get frequency amplitude for this point
        const freqIndex = Math.floor((i / numPoints) * inputData.length * 0.6);
        const amplitude = inputData[freqIndex] / 255;
        
        // Calculate wave displacement with multiple frequencies
        const wave1 = Math.sin(angle * 6 + phase) * 3;
        const wave2 = Math.sin(angle * 12 + phase * 1.5) * 2;
        const wave3 = Math.sin(angle * 3 + phase * 0.7) * 4;
        
        const waveAmplitude = isSpeaking ? 
          Math.max(5, amplitude * 30 + (wave1 + wave2 + wave3) * activeLevel) :
          3 + (wave1 + wave3) * 0.3;
        
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
      
      // Animated gradient stroke
      const strokeGradient = ctx.createLinearGradient(
        centerX + Math.cos(phase) * baseRadius,
        centerY + Math.sin(phase) * baseRadius,
        centerX + Math.cos(phase + Math.PI) * baseRadius,
        centerY + Math.sin(phase + Math.PI) * baseRadius
      );
      
      const color2 = lerpColor(Math.min(1, currentColor + 0.2));
      strokeGradient.addColorStop(0, `hsl(${color.h}, ${color.s}%, ${color.l}%)`);
      strokeGradient.addColorStop(0.5, `hsl(${color2.h}, ${color2.s}%, ${Math.min(80, color2.l + 10)}%)`);
      strokeGradient.addColorStop(1, `hsl(${color.h}, ${color.s}%, ${color.l}%)`);
      
      ctx.strokeStyle = strokeGradient;
      ctx.lineWidth = 4;
      ctx.stroke();

      // Draw center content
      ctx.fillStyle = primaryHsl;
      
      if (isSpeaking === 'user') {
        // Microphone icon
        const iconScale = 1.2;
        ctx.beginPath();
        ctx.roundRect(centerX - 8 * iconScale, centerY - 14 * iconScale, 16 * iconScale, 24 * iconScale, 8 * iconScale);
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(centerX, centerY + 16 * iconScale, 14 * iconScale, Math.PI, 0, false);
        ctx.lineWidth = 3;
        ctx.strokeStyle = primaryHsl;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY + 30 * iconScale);
        ctx.lineTo(centerX, centerY + 40 * iconScale);
        ctx.stroke();
      } else if (isSpeaking === 'assistant') {
        // Animated sound waves
        const waveCount = 4;
        for (let j = 0; j < waveCount; j++) {
          const wavePhase = (Date.now() / 200 + j * 0.5) % (Math.PI * 2);
          const barHeight = 10 + Math.sin(wavePhase) * (15 + j * 5);
          ctx.fillRect(centerX - 30 + j * 18, centerY - barHeight / 2, 8, barHeight);
        }
      } else {
        // Idle - breathing circle
        const breathe = Math.sin(Date.now() / 1000) * 3;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 12 + breathe, 0, Math.PI * 2);
        ctx.fill();
      }

      // Status text
      ctx.fillStyle = `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.8)`;
      ctx.font = '600 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        isSpeaking === 'user' ? 'Listening' : 
        isSpeaking === 'assistant' ? 'Speaking' : 
        'Ready',
        centerX,
        centerY + baseRadius + 35
      );

      phase += 0.03;
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
        className={cn("relative flex flex-col items-center justify-center", className)}
        style={{ width: size, height: size + 50 }}
      >
        <div className="relative">
          {/* Outer rings */}
          <div 
            className="absolute rounded-full border border-muted-foreground/10 animate-pulse"
            style={{ 
              width: size * 0.9, 
              height: size * 0.9,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)'
            }}
          />
          <div 
            className="absolute rounded-full border-2 border-muted-foreground/20"
            style={{ 
              width: size * 0.76, 
              height: size * 0.76,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)'
            }}
          />
          {/* Inner circle */}
          <div 
            className="rounded-full bg-gradient-to-b from-muted/50 to-muted flex items-center justify-center"
            style={{ width: size * 0.76, height: size * 0.76 }}
          >
            <div className="w-6 h-6 rounded-full bg-muted-foreground/30 animate-pulse" />
          </div>
        </div>
        <span className="mt-4 text-sm font-medium text-muted-foreground">
          Press Start to begin
        </span>
      </div>
    );
  }

  return (
    <div className={cn("relative flex flex-col items-center", className)}>
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
      />
    </div>
  );
}
