/**
 * Electron fixture for the meeting-recording e2e. Pre-seeds the tiny.en Whisper
 * model so the run downloads nothing; the test itself mocks getUserMedia /
 * getDisplayMedia in the renderer with the audio fixtures (see installMediaMock)
 * for deterministic mic + system sources. main enables a no-gesture autoplay
 * policy under E2E_TEST so those AudioContexts actually produce sound.
 */
import { test as base, _electron as electron, type ElectronApplication } from '@playwright/test';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURES = dirname(fileURLToPath(import.meta.url));
export const MIC_WAV = join(FIXTURES, 'mic-sample.wav');
export const SYSTEM_WAV = join(FIXTURES, 'system-sample.wav');
const TINY_MODEL = join(FIXTURES, '.cache', 'ggml-tiny.en.bin');
const VAD_MODEL = join(FIXTURES, '.cache', 'ggml-silero-v5.1.2.bin');

/** Base64 of the fixture WAVs, for injecting into the renderer media mock. */
export const micAudioBase64 = () => readFileSync(MIC_WAV).toString('base64');
export const systemAudioBase64 = () => readFileSync(SYSTEM_WAV).toString('base64');

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
    if (existsSync(VAD_MODEL)) {
      copyFileSync(VAD_MODEL, join(modelDir, 'ggml-silero-v5.1.2.bin'));
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
      },
      timeout: 60_000,
    });
    await use(app);
    await app.close();
  },
});

export const expect = test.expect;
