/**
 * Environment Utils Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock electron app
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
  },
}));

describe('Environment Utils', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isDev and isProd', () => {
    it('should have isDev as true when app is not packaged', async () => {
      vi.doMock('electron', () => ({
        app: { isPackaged: false },
      }));

      const { isDev, isProd } = await import('../../src/main/utils/environment');

      expect(isDev).toBe(true);
      expect(isProd).toBe(false);
    });

    it('should have isProd as true when app is packaged', async () => {
      vi.doMock('electron', () => ({
        app: { isPackaged: true },
      }));

      const { isDev, isProd } = await import('../../src/main/utils/environment');

      expect(isDev).toBe(false);
      expect(isProd).toBe(true);
    });
  });

  describe('getEnv', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should return environment variable value', async () => {
      process.env.TEST_VAR = 'test-value';

      const { getEnv } = await import('../../src/main/utils/environment');
      expect(getEnv('TEST_VAR')).toBe('test-value');
    });

    it('should return default value when variable not set', async () => {
      delete process.env.NONEXISTENT_VAR;

      const { getEnv } = await import('../../src/main/utils/environment');
      expect(getEnv('NONEXISTENT_VAR', 'default')).toBe('default');
    });

    it('should return undefined when variable not set and no default', async () => {
      delete process.env.NONEXISTENT_VAR;

      const { getEnv } = await import('../../src/main/utils/environment');
      expect(getEnv('NONEXISTENT_VAR')).toBeUndefined();
    });
  });
});
