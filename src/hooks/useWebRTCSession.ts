import { useState, useCallback, useRef } from 'react';
import { createRealtimeSession, AudioVisualizer } from '@/utils/webrtcAudio';
import { logger } from '@/utils/logger';

export interface WebRTCSessionState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

interface UseWebRTCSessionProps {
  onMessage?: (message: unknown) => void;
  onConnectionChange?: (connected: boolean) => void;
}

/**
 * Custom hook for managing WebRTC session state and lifecycle
 * Handles connection, disconnection, and session management
 */
export function useWebRTCSession({ onMessage, onConnectionChange }: UseWebRTCSessionProps = {}) {
  const [state, setState] = useState<WebRTCSessionState>({
    isConnected: false,
    isConnecting: false,
    error: null,
  });

  const disconnectFnRef = useRef<(() => void) | null>(null);
  const visualizerRef = useRef<AudioVisualizer | null>(null);

  const connect = useCallback(async (config: unknown): Promise<void> => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const { disconnect, visualizer } = await createRealtimeSession(
        config,
        (msg: unknown) => {
          if (onMessage) {
            onMessage(msg);
          }
        }
      );

      disconnectFnRef.current = disconnect;
      visualizerRef.current = visualizer;

      setState({
        isConnected: true,
        isConnecting: false,
        error: null,
      });

      if (onConnectionChange) {
        onConnectionChange(true);
      }

      logger.log('WebRTC session connected successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to connect WebRTC session:', error);

      setState({
        isConnected: false,
        isConnecting: false,
        error: errorMessage,
      });

      if (onConnectionChange) {
        onConnectionChange(false);
      }
    }
  }, [onMessage, onConnectionChange]);

  const disconnect = useCallback((): void => {
    if (disconnectFnRef.current) {
      disconnectFnRef.current();
      disconnectFnRef.current = null;
      visualizerRef.current = null;

      setState({
        isConnected: false,
        isConnecting: false,
        error: null,
      });

      if (onConnectionChange) {
        onConnectionChange(false);
      }

      logger.log('WebRTC session disconnected');
    }
  }, [onConnectionChange]);

  return {
    ...state,
    connect,
    disconnect,
    visualizer: visualizerRef.current,
  };
}
