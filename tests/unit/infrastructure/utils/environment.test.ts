import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

async function loadEnvironment(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const key of ['NODE_ENV', 'E2E_TEST', 'STONE_TEST_VALUE']) {
    delete process.env[key];
  }
  Object.assign(process.env, env);
  return import('../../../../src/main/infrastructure/utils/environment');
}

describe('environment utilities', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('uses process env outside Electron and lets E2E force production behavior', async () => {
    const standaloneProd = await loadEnvironment({ NODE_ENV: 'production' });
    expect(standaloneProd.isElectron).toBe(false);
    expect(standaloneProd.isDev).toBe(false);
    expect(standaloneProd.isProd).toBe(true);

    const e2e = await loadEnvironment({ E2E_TEST: 'true', STONE_TEST_VALUE: 'x' });
    expect(e2e.isProd).toBe(true);
    expect(e2e.getEnv('STONE_TEST_VALUE')).toBe('x');
    expect(e2e.getEnv('MISSING', 'fallback')).toBe('fallback');
  });

  it('defaults to development outside Electron when NODE_ENV is not production', async () => {
    const dev = await loadEnvironment({ NODE_ENV: 'development' });

    expect(dev.isElectron).toBe(false);
    expect(dev.isDev).toBe(true);
    expect(dev.isProd).toBe(false);
  });
});
