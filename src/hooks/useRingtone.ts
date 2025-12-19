import { useRef, useCallback } from 'react';

export function useRingtone() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPlayingRef = useRef(false);

  const startRingtone = useCallback(() => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;

    try {
      audioContextRef.current = new AudioContext();
      const ctx = audioContextRef.current;

      // Ring pattern: two short tones, then pause
      let ringPhase = 0;

      const playRingBurst = () => {
        if (!audioContextRef.current || !isPlayingRef.current) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        // Classic phone ring frequencies (alternating)
        osc.frequency.value = ringPhase % 2 === 0 ? 440 : 480;
        osc.type = 'sine';

        // Envelope for smooth ring
        const now = ctx.currentTime;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
        gain.gain.setValueAtTime(0.15, now + 0.15);
        gain.gain.linearRampToValueAtTime(0, now + 0.2);

        osc.start(now);
        osc.stop(now + 0.25);

        ringPhase++;
      };

      // Play immediately
      playRingBurst();

      // Continue ringing pattern: burst every 400ms, with gap every 2 bursts
      let burstCount = 1;
      intervalRef.current = setInterval(() => {
        if (!isPlayingRef.current) return;
        
        // Create ring pattern: ring-ring, pause, ring-ring, pause
        if (burstCount % 3 !== 0) {
          playRingBurst();
        }
        burstCount++;
      }, 400);

      // Auto-stop after 2 seconds
      timeoutRef.current = setTimeout(() => {
        stopRingtone();
      }, 2000);

    } catch (error) {
      console.error('Failed to play ringtone:', error);
    }
  }, []);

  const stopRingtone = useCallback(() => {
    isPlayingRef.current = false;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
      } catch {}
      oscillatorRef.current = null;
    }

    if (gainNodeRef.current) {
      gainNodeRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  return { startRingtone, stopRingtone };
}
