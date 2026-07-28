import Fastify from 'fastify';
import { Effect } from 'effect';
import { describe, expect, it, vi } from 'vitest';
import { SettingsHTTP } from '../../../../../src/main/adapters/in/http/SettingsHTTP';
import type { ISettingsUseCases } from '../../../../../src/main/domain';

function createApp() {
  const setTheme = vi.fn(() => Effect.void);
  const service = {
    getAppearance: {
      execute: () =>
        Effect.succeed({
          theme: 'dark' as const,
          accentColor: 'blue' as const,
          fontSettings: {
            uiFontFamily: 'Inter',
            editorFontFamily: 'Fira Code',
            uiFontSize: 14,
            editorFontSize: 15,
          },
        }),
    },
    setTheme: { execute: setTheme },
    getAIProviderKeys: {
      execute: () =>
        Effect.succeed([
          {
            provider: 'openai' as const,
            label: 'OpenAI',
            envVar: 'OPENAI_API_KEY',
            hasEnvKey: false,
            hasStoredKey: true,
            available: true,
            activeSource: 'stored' as const,
          },
        ]),
    },
  } as unknown as ISettingsUseCases;
  const app = Fastify({ logger: false });
  new SettingsHTTP({
    runSettingsEffect: (use) => Effect.runPromise(use(service)),
  }).register(app);
  return { app, setTheme };
}

describe('SettingsHTTP', () => {
  it('loads persistent appearance settings', async () => {
    const { app } = createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/settings/appearance',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ theme: 'dark' });
    await app.close();
  });

  it('updates settings through the inbound use-case port', async () => {
    const { app, setTheme } = createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/settings/actions/set-theme',
      payload: { theme: 'light' },
    });

    expect(response.statusCode).toBe(204);
    expect(setTheme).toHaveBeenCalledWith({ theme: 'light' });
    await app.close();
  });

  it('returns AI key status without exposing credentials', async () => {
    const { app } = createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/settings/ai-provider-keys',
    });

    expect(response.json()).toEqual([
      expect.objectContaining({
        provider: 'openai',
        hasStoredKey: true,
        available: true,
      }),
    ]);
    expect(response.body).not.toContain('apiKey');
    await app.close();
  });
});
