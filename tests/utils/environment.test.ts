/**
 * Environment Utils Tests
 *
 * Tests run in standalone mode (no Electron) so we test NODE_ENV-based behavior.
 * Electron-specific behavior (app.isPackaged) works in actual Electron environment.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Environment Utils', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('isDev and isProd (standalone mode)', () => {
    it('should have isDev as true when NODE_ENV is not production', async () => {
      delete process.env.NODE_ENV;

      const { isDev, isProd } = await import('../../src/main/utils/environment');

      expect(isDev).toBe(true);
      expect(isProd).toBe(false);
    });

    it('should have isProd as true when NODE_ENV is production', async () => {
      process.env.NODE_ENV = 'production';

      const { isDev, isProd } = await import('../../src/main/utils/environment');

      expect(isDev).toBe(false);
      expect(isProd).toBe(true);
    });

    it('should have isDev as true when NODE_ENV is development', async () => {
      process.env.NODE_ENV = 'development';

      const { isDev, isProd } = await import('../../src/main/utils/environment');

      expect(isDev).toBe(true);
      expect(isProd).toBe(false);
    });
  });

  describe('isElectron', () => {
    it('should be false in test/standalone environment', async () => {
      const { isElectron } = await import('../../src/main/utils/environment');

      // In test environment, Electron is not available
      expect(isElectron).toBe(false);
    });
  });

  describe('getEnv', () => {
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
