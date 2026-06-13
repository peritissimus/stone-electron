/**
 * Electron fixture for the meeting-recording e2e: feeds tests/e2e/fixtures/jfk.wav
 * in as the fake microphone (Chromium --use-file-for-fake-audio-capture), auto-
 * accepts the media prompts, and pre-seeds the tiny.en Whisper model so the run
 * doesn't download anything. System-audio loopback degrades to mic-only in this
 * headless context — which is fine, the fake mic carries the test audio.
 */
import { test as base, _electron as electron, type ElectronApplication } from '@playwright/test';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURES = dirname(fileURLToPath(import.meta.url));
export const JFK_WAV = join(FIXTURES, 'jfk.wav');
const TINY_MODEL = join(FIXTURES, '.cache', 'ggml-tiny.en.bin');

type Fixtures = { app: ElectronApplication; userDataDir: string };

export const test = base.extend<Fixtures>({
  userDataDir: async ({}, use) => {
    const dir = mkdtempSync(join(tmpdir(), 'stone-rec-e2e-'));
    // Pre-seed the model where WhisperCppTranscriber looks (userData/whisper-models).
    const modelDir = join(dir, 'whisper-models');
    mkdirSync(modelDir, { recursive: true });
    if (existsSync(TINY_MODEL)) {
      copyFileSync(TINY_MODEL, join(modelDir, 'ggml-tiny.en.bin'));
    }
    await use(dir);
    if (!process.env.STONE_E2E_KEEP_USERDATA) rmSync(dir, { recursive: true, force: true });
  },
  app: async ({ userDataDir }, use) => {
    const app = await electron.launch({
      args: ['.', `--user-data-dir=${userDataDir}`],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        E2E_TEST: 'true',
        STONE_WHISPER_MODEL: 'tiny.en',
        // main/index.ts turns these into Chromium media switches before app-ready.
        E2E_FAKE_AUDIO_FILE: JFK_WAV,
      },
      timeout: 60_000,
    });
    await use(app);
    await app.close();
  },
});

export const expect = test.expect;
