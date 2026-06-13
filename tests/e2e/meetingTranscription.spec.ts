/**
 * End-to-end: record a meeting from fake audio and transcribe it via whisper.cpp.
 *
 * The fake mic plays jfk.wav ("…ask not what your country can do for you…"), so
 * after record → stop → finalize, the transcript must contain that speech. This
 * exercises the real pipeline: capture → PCM/WAV → WhisperCppTranscriber →
 * transcript, with the bundled whisper-cli binary and the tiny.en model.
 *
 * Requires the binary (pnpm build:whisper) and the cached model; skips otherwise.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from './fixtures/recordingElectron';

const HERE = dirname(fileURLToPath(import.meta.url));
const HAVE_BINARY = existsSync(join(process.cwd(), 'vendor', 'whisper', 'bin', 'whisper-cli'));
const HAVE_MODEL = existsSync(join(HERE, 'fixtures', '.cache', 'ggml-tiny.en.bin'));

// Opt-in: Chromium's fake-audio-capture injection (the fixture's fake mic) does
// not feed audio reliably in the current Electron/Chromium — the recording
// captures silence, so this can't assert a transcript yet. The transcription
// engine itself is covered deterministically by the integration test
// (tests/integration/adapters/whisperCppTranscriber.test.ts). Enable with
// STONE_E2E_RECORDING=1 once fake-audio injection is sorted.
test.skip(
  !process.env.STONE_E2E_RECORDING || !HAVE_BINARY || !HAVE_MODEL,
  'set STONE_E2E_RECORDING=1 (+ pnpm build:whisper + cached model) to run',
);
test.slow(); // record + transcribe takes a while

test('records fake audio and transcribes it', async ({ app }) => {
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  // Go to Meetings.
  await window.evaluate(() => {
    location.hash = '#/meetings';
  });
  await expect(window.getByRole('heading', { name: 'Meetings' })).toBeVisible({ timeout: 20_000 });

  // Start recording — the fake mic streams jfk.wav.
  await window.getByRole('button', { name: /New recording/i }).click();

  // Record several seconds of the fake audio, then stop.
  await window.waitForTimeout(8_000);
  await window.getByRole('button', { name: /Stop/i }).click();

  // whisper.cpp (tiny.en) transcribes; the JFK line contains "country".
  await expect(window.getByText(/country/i).first()).toBeVisible({ timeout: 90_000 });
});
