import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_APP_CONFIG } from '../../../src/shared/types/settings';
import type { ElectronApplication } from '@playwright/test';

export function initializeTestProfile(directory: string): void {
  writeFileSync(
    join(directory, 'config.json'),
    JSON.stringify({
      ...DEFAULT_APP_CONFIG,
      workspace: { defaultWorkspacePath: join(directory, 'workspace') },
      // Tests exercise the application after setup; new-user onboarding has its own flow.
      onboarding: { ...DEFAULT_APP_CONFIG.onboarding, completed: true },
      quickCapture: { ...DEFAULT_APP_CONFIG.quickCapture, shortcut: '' },
    }),
  );
}

export function testEnvironment(directory: string): Record<string, string> {
  return {
    ...Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    ),
    NODE_ENV: 'production',
    E2E_TEST: 'true',
    DATABASE_URL: join(directory, 'stone-data', 'notes.db'),
    STONE_CONFIG_PATH: join(directory, 'config.json'),
    STONE_DATA_DIR: directory,
    STONE_WORKSPACE_PATH: join(directory, 'workspace'),
    STONE_ML_CACHE_DIR: join(directory, 'ml-cache'),
    STONE_WHISPER_MODEL_DIR: join(directory, 'whisper-models'),
  };
}

export async function prepareTestWorkspace(
  app: ElectronApplication,
  directory: string,
): Promise<void> {
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(
    async (workspacePath) => {
      const response = await window.electron.invoke<{ id: string }>('workspaces:create', {
        name: 'Test workspace',
        path: workspacePath,
      });
      if (!response.success || !response.data)
        throw new Error('Failed to create isolated test workspace');
      const activated = await window.electron.invoke('workspaces:setActive', {
        id: response.data.id,
      });
      if (!activated.success) throw new Error('Failed to activate isolated test workspace');
    },
    join(directory, 'workspace'),
  );
  await page.reload();
}
