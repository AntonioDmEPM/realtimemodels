import { describe, it, expect } from 'vitest';
import { calculateCosts, PricingConfig, SessionStats } from './webrtcAudio';

describe('calculateCosts', () => {
  const defaultPricing: PricingConfig = {
    audioInputCost: 0.00006,
    audioOutputCost: 0.00024,
    textInputCost: 0.0000025,
    textOutputCost: 0.00001,
    cachedAudioCost: 0.00003,
  };

  it('should calculate costs correctly with all token types', () => {
    const stats: Omit<SessionStats, 'inputCost' | 'outputCost' | 'totalCost'> = {
      audioInputTokens: 1000,
      textInputTokens: 500,
      cachedInputTokens: 200,
      audioOutputTokens: 800,
      textOutputTokens: 300,
    };

    const result = calculateCosts(stats, defaultPricing);

    expect(result.inputCost).toBe(
      1000 * 0.00006 + 500 * 0.0000025 + 200 * 0.00003
    );
    expect(result.outputCost).toBe(
      800 * 0.00024 + 300 * 0.00001
    );
    expect(result.totalCost).toBe(result.inputCost + result.outputCost);
  });

  it('should handle zero tokens', () => {
    const stats: Omit<SessionStats, 'inputCost' | 'outputCost' | 'totalCost'> = {
      audioInputTokens: 0,
      textInputTokens: 0,
      cachedInputTokens: 0,
      audioOutputTokens: 0,
      textOutputTokens: 0,
    };

    const result = calculateCosts(stats, defaultPricing);

    expect(result.inputCost).toBe(0);
    expect(result.outputCost).toBe(0);
    expect(result.totalCost).toBe(0);
  });

  it('should handle only audio tokens', () => {
    const stats: Omit<SessionStats, 'inputCost' | 'outputCost' | 'totalCost'> = {
      audioInputTokens: 1000,
      textInputTokens: 0,
      cachedInputTokens: 0,
      audioOutputTokens: 500,
      textOutputTokens: 0,
    };

    const result = calculateCosts(stats, defaultPricing);

    expect(result.inputCost).toBe(1000 * 0.00006);
    expect(result.outputCost).toBe(500 * 0.00024);
    expect(result.totalCost).toBe(0.06 + 0.12);
  });

  it('should handle only text tokens', () => {
    const stats: Omit<SessionStats, 'inputCost' | 'outputCost' | 'totalCost'> = {
      audioInputTokens: 0,
      textInputTokens: 10000,
      cachedInputTokens: 0,
      audioOutputTokens: 0,
      textOutputTokens: 5000,
    };

    const result = calculateCosts(stats, defaultPricing);

    expect(result.inputCost).toBe(10000 * 0.0000025);
    expect(result.outputCost).toBe(5000 * 0.00001);
    expect(result.totalCost).toBe(0.025 + 0.05);
  });

  it('should handle cached tokens correctly', () => {
    const stats: Omit<SessionStats, 'inputCost' | 'outputCost' | 'totalCost'> = {
      audioInputTokens: 0,
      textInputTokens: 0,
      cachedInputTokens: 1000,
      audioOutputTokens: 0,
      textOutputTokens: 0,
    };

    const result = calculateCosts(stats, defaultPricing);

    expect(result.inputCost).toBe(1000 * 0.00003);
    expect(result.outputCost).toBe(0);
    expect(result.totalCost).toBe(0.03);
  });

  it('should use custom pricing configuration', () => {
    const customPricing: PricingConfig = {
      audioInputCost: 0.0001,
      audioOutputCost: 0.0003,
      textInputCost: 0.000005,
      textOutputCost: 0.00002,
      cachedAudioCost: 0.00005,
    };

    const stats: Omit<SessionStats, 'inputCost' | 'outputCost' | 'totalCost'> = {
      audioInputTokens: 1000,
      textInputTokens: 1000,
      cachedInputTokens: 1000,
      audioOutputTokens: 1000,
      textOutputTokens: 1000,
    };

    const result = calculateCosts(stats, customPricing);

    expect(result.inputCost).toBe(
      1000 * 0.0001 + 1000 * 0.000005 + 1000 * 0.00005
    );
    expect(result.outputCost).toBe(
      1000 * 0.0003 + 1000 * 0.00002
    );
  });
});
