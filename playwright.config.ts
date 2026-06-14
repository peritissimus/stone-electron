import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  // One retry: the recording specs spawn native models (AEC + whisper-server)
  // that pay a one-time cold-load on the very first run, which can occasionally
  // blow the per-test budget. A retry runs them warm.
  retries: 1,
  reporter: [['list']],
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
});
