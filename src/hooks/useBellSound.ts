import { useCallback, useRef } from 'react';

export const useBellSound = () => {
  const audioContextRef = useRef<AudioContext | null>(null);

  const playBell = useCallback(() => {
    try {
      // Create or reuse audio context
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const audioContext = audioContextRef.current;

      // Resume context if suspended (browser autoplay policy)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      const now = audioContext.currentTime;

      // Create oscillator for the bell tone
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      // Bell-like frequency (high pitch, quick decay)
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, now); // A5 note
      oscillator.frequency.exponentialRampToValueAtTime(440, now + 0.15); // Pitch drop for bell effect

      // Quick attack, medium decay envelope
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01); // Quick attack
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4); // Decay

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start(now);
      oscillator.stop(now + 0.4);

      // Add a second harmonic for richer bell sound
      const oscillator2 = audioContext.createOscillator();
      const gainNode2 = audioContext.createGain();

      oscillator2.type = 'sine';
      oscillator2.frequency.setValueAtTime(1760, now); // A6 - one octave higher
      oscillator2.frequency.exponentialRampToValueAtTime(880, now + 0.1);

      gainNode2.gain.setValueAtTime(0, now);
      gainNode2.gain.linearRampToValueAtTime(0.15, now + 0.01);
      gainNode2.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

      oscillator2.connect(gainNode2);
      gainNode2.connect(audioContext.destination);

      oscillator2.start(now);
      oscillator2.stop(now + 0.25);

    } catch (error) {
      console.error('Failed to play bell sound:', error);
    }
  }, []);

  return { playBell };
};
