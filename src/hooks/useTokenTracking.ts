import { useState, useCallback } from 'react';
import { SessionStats, PricingConfig, calculateCosts, UsageEvent } from '@/utils/webrtcAudio';
import { TokenDataPoint } from '@/components/TokenDashboard';

/**
 * Custom hook for tracking token usage and costs
 * Manages session statistics, cost calculations, and token history
 */
export function useTokenTracking(initialPricing: PricingConfig) {
  const [stats, setStats] = useState<SessionStats>({
    audioInputTokens: 0,
    textInputTokens: 0,
    cachedInputTokens: 0,
    audioOutputTokens: 0,
    textOutputTokens: 0,
    inputCost: 0,
    outputCost: 0,
    totalCost: 0,
  });

  const [tokenHistory, setTokenHistory] = useState<TokenDataPoint[]>([]);
  const [pricing, setPricing] = useState<PricingConfig>(initialPricing);

  const updateTokenStats = useCallback((event: UsageEvent) => {
    setStats(prevStats => {
      const newStats = {
        audioInputTokens: prevStats.audioInputTokens + (event.audioInputTokens || 0),
        textInputTokens: prevStats.textInputTokens + (event.textInputTokens || 0),
        cachedInputTokens: prevStats.cachedInputTokens + (event.cachedInputTokens || 0),
        audioOutputTokens: prevStats.audioOutputTokens + (event.audioOutputTokens || 0),
        textOutputTokens: prevStats.textOutputTokens + (event.textOutputTokens || 0),
        inputCost: 0,
        outputCost: 0,
        totalCost: 0,
      };

      const costs = calculateCosts(newStats, pricing);
      return { ...newStats, ...costs };
    });

    // Add to token history
    setTokenHistory(prev => {
      const now = new Date().toISOString();
      const newPoint: TokenDataPoint = {
        timestamp: now,
        audioInput: event.audioInputTokens || 0,
        audioOutput: event.audioOutputTokens || 0,
        textInput: event.textInputTokens || 0,
        textOutput: event.textOutputTokens || 0,
        cached: event.cachedInputTokens || 0,
      };
      return [...prev, newPoint];
    });
  }, [pricing]);

  const resetStats = useCallback(() => {
    setStats({
      audioInputTokens: 0,
      textInputTokens: 0,
      cachedInputTokens: 0,
      audioOutputTokens: 0,
      textOutputTokens: 0,
      inputCost: 0,
      outputCost: 0,
      totalCost: 0,
    });
    setTokenHistory([]);
  }, []);

  const updatePricing = useCallback((newPricing: PricingConfig) => {
    setPricing(newPricing);
    // Recalculate costs with new pricing
    setStats(prevStats => {
      const costs = calculateCosts(prevStats, newPricing);
      return { ...prevStats, ...costs };
    });
  }, []);

  return {
    stats,
    tokenHistory,
    pricing,
    updateTokenStats,
    resetStats,
    updatePricing,
  };
}
