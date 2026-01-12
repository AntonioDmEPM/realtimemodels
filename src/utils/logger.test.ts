import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from './logger';

describe('Logger Utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('in development mode', () => {
    beforeEach(() => {
      vi.stubEnv('DEV', true);
    });

    it('should log messages in development', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      logger.log('test message');
      expect(consoleSpy).toHaveBeenCalledWith('test message');
    });

    it('should log errors in development', () => {
      const consoleSpy = vi.spyOn(console, 'error');
      logger.error('test error');
      expect(consoleSpy).toHaveBeenCalledWith('test error');
    });

    it('should log warnings in development', () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      logger.warn('test warning');
      expect(consoleSpy).toHaveBeenCalledWith('test warning');
    });
  });

  describe('criticalError', () => {
    it('should always log critical errors regardless of environment', () => {
      const consoleSpy = vi.spyOn(console, 'error');
      logger.criticalError('critical error');
      expect(consoleSpy).toHaveBeenCalledWith('critical error');
    });
  });
});
