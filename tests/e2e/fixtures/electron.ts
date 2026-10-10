import { test as base, _electron as electron, type ElectronApplication } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initializeTestProfile, prepareTestWorkspace, testEnvironment } from './testProfile';

type ElectronFixtures = {
  app: ElectronApplication;
  userDataDir: string;
  recordTrace: boolean;
};

export const test = base.extend<ElectronFixtures>({
  recordTrace: [true, { option: true }],
  // Playwright requires object destructuring to discover fixture dependencies.
  // eslint-disable-next-line no-empty-pattern
  userDataDir: async ({}, use) => {
    const dir = mkdtempSync(join(tmpdir(), 'stone-e2e-'));
    initializeTestProfile(dir);
    await use(dir);
    if (process.env.STONE_E2E_KEEP_USERDATA) {
      console.log(`[fixture] keeping userDataDir: ${dir}`);
      return;
    }
    rmSync(dir, { recursive: true, force: true });
  },
  app: async ({ userDataDir, recordTrace }, use, testInfo) => {
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
      env: testEnvironment(userDataDir),
      // First boot on CI / cold caches can exceed Playwright's 30s default.
      timeout: 60_000,
    });
    try {
      if (recordTrace) await app.context().tracing.start({ screenshots: true, snapshots: true });
      await prepareTestWorkspace(app, userDataDir);
      await use(app);
    } finally {
      try {
        if (recordTrace) {
          await app
            .context()
            .tracing.stop(
              testInfo.status !== testInfo.expectedStatus
                ? { path: testInfo.outputPath('trace.zip') }
                : {},
            );
        }
      } finally {
        await app.close();
      }
    }
  },
});

export const expect = test.expect;

// Platform-aware primary modifier — Meta on macOS, Control elsewhere.
// Use with Playwright's keyboard API, e.g. `window.keyboard.press(primaryModifier + '+k')`.
export const primaryModifier = process.platform === 'darwin' ? 'Meta' : 'Control';
