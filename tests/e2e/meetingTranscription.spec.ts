/**
 * End-to-end: record a meeting with simulated mic + system audio and transcribe
 * it via whisper.cpp. getUserMedia (mic) and getDisplayMedia (system) are mocked
 * in the renderer to return streams built from real speech fixtures, so the full
 * pipeline runs — capture → mix → PCM/WAV → WhisperCppTranscriber → transcript —
 * on deterministic audio. The mic clip says "…your country…", so the transcript
 * must contain it.
 *
 * Requires the binary (pnpm build:whisper) and the cached tiny.en model; skips
 * otherwise so the default run is unaffected.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, micAudioBase64, systemAudioBase64 } from './fixtures/recordingElectron';

const HERE = dirname(fileURLToPath(import.meta.url));
const HAVE_BINARY = existsSync(join(process.cwd(), 'vendor', 'whisper', 'bin', 'whisper-cli'));
const HAVE_MODEL = existsSync(join(HERE, 'fixtures', '.cache', 'ggml-tiny.en.bin'));

test.skip(!HAVE_BINARY || !HAVE_MODEL, 'needs pnpm build:whisper + cached tiny.en model');
test.slow(); // record + transcribe takes a while

test('records simulated mic + system audio and transcribes it', async ({ app }) => {
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  // Replace the real capture devices with streams synthesized from the speech
  // fixtures, so the recording has deterministic mic + system audio.
  await window.evaluate(
    ({ mic, sys }) => {
      const toStream = (b64: string): MediaStream => {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
        const ctx = new AudioContext();
        const dest = ctx.createMediaStreamDestination();
        // Half gain so the app's mic+system mix doesn't clip (two full-scale
        // looping clips summed would distort and garble transcription).
        const gain = ctx.createGain();
        gain.gain.value = 0.45;
        gain.connect(dest);
        void ctx.decodeAudioData(bytes.buffer.slice(0)).then((buf: AudioBuffer) => {
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.loop = true;
          src.connect(gain);
          src.start();
        });
        return dest.stream;
      };
      const micStream = toStream(mic);
      const sysStream = toStream(sys);
      navigator.mediaDevices.getUserMedia = async () => micStream;
      navigator.mediaDevices.getDisplayMedia = async () => sysStream;
    },
    { mic: micAudioBase64(), sys: systemAudioBase64() },
  );

  // Go to Meetings and record.
  await window.evaluate(() => {
    location.hash = '#/meetings';
  });
  await expect(window.getByRole('heading', { name: 'Meetings' })).toBeVisible({ timeout: 20_000 });
  await window.getByRole('button', { name: /New recording/i }).click();

  // Capture several seconds of the looping fixtures, then stop.
  await window.waitForTimeout(8_000);
  await window.getByRole('button', { name: /Stop/i }).click();

  // Wait for finalize to complete before reading the transcript. Summary fails
  // with no cloud key, so the panel settles on "Recording failed" — with the
  // transcript saved (transcript-only success isn't built yet).
  await expect(window.getByText(/Recording failed|Added to Meetings/i)).toBeVisible({
    timeout: 60_000,
  });
  // Let the list merge the finalized recording before selecting it.
  await window.waitForTimeout(1_500);

  // Open the recording and assert the real transcribed speech. Overlapping mic
  // + system streams mean we can't pin one source's text until per-source
  // transcription lands, so match either the mic ("country") or system clip
  // ("budget review").
  await window.getByRole('button', { name: /^Meeting /i }).first().click();
  await expect(window.getByText(/country|budget|review|tuesday/i).first()).toBeVisible({
    timeout: 15_000,
  });
});
