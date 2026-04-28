import { test as base, _electron as electron, type ElectronApplication } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type ElectronFixtures = {
  app: ElectronApplication;
  userDataDir: string;
};

export const test = base.extend<ElectronFixtures>({
  userDataDir: async ({}, use) => {
    const dir = mkdtempSync(join(tmpdir(), 'stone-e2e-'));
    await use(dir);
    rmSync(dir, { recursive: true, force: true });
  },
  app: async ({ userDataDir }, use) => {
    // Set STONE_E2E_BINARY to a packaged Electron binary (e.g. Stone.app's
    // .../MacOS/Stone) to exercise the real asar/asarUnpack resolution.
    // Default uses `electron .` against the dev-built dist/, which loads
    // node_modules from the project root and hides packaging issues.
    const packagedBinary = process.env.STONE_E2E_BINARY;
    const launchOptions = packagedBinary
      ? {
          executablePath: packagedBinary,
          args: [`--user-data-dir=${userDataDir}`],
        }
      : {
          args: ['.', `--user-data-dir=${userDataDir}`],
        };

    const app = await electron.launch({
      ...launchOptions,
      env: { ...process.env, NODE_ENV: 'production', E2E_TEST: 'true' },
      // First boot on CI / cold caches can exceed Playwright's 30s default.
      timeout: 60_000,
    });
    await use(app);
    await app.close();
  },
});

export const expect = test.expect;

// Platform-aware primary modifier — Meta on macOS, Control elsewhere.
// Use with Playwright's keyboard API, e.g. `window.keyboard.press(primaryModifier + '+k')`.
export const primaryModifier = process.platform === 'darwin' ? 'Meta' : 'Control';
