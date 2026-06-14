/**
 * Integration test for WhisperCppTranscriber against the real whisper-cli binary
 * and the tiny.en model on whisper.cpp's JFK sample. Validates the actual
 * transcription engine + the adapter's spawn/JSON-parse end to end.
 *
 * Skips unless the binary (pnpm build:whisper) and the cached model exist, so it
 * runs locally / in CI-with-whisper but never blocks the plain unit run.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { WhisperCppTranscriber } from '../../../src/main/adapters/out/integrations/WhisperCppTranscriber';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const BINARY = join(ROOT, 'vendor', 'whisper', 'bin', 'whisper-cli');
const MODEL_DIR = join(ROOT, 'tests', 'e2e', 'fixtures', '.cache');
const MODEL = join(MODEL_DIR, 'ggml-tiny.en.bin');
const JFK_WAV = join(ROOT, 'tests', 'e2e', 'fixtures', 'mic-sample.wav');

const ready = existsSync(BINARY) && existsSync(MODEL) && existsSync(JFK_WAV);

describe.skipIf(!ready)('WhisperCppTranscriber (real binary)', () => {
  it('transcribes the JFK sample into timestamped segments', async () => {
    const transcriber = new WhisperCppTranscriber({
      model: 'tiny.en',
      binary: BINARY,
      modelDir: MODEL_DIR,
    });

    const result = await transcriber.transcribe({ audioPath: JFK_WAV });

    // "...ask not what your country can do for you..."
    expect(result.text.toLowerCase()).toContain('country');
    expect(result.segments.length).toBeGreaterThan(0);
    expect(result.segments[0]).toMatchObject({
      text: expect.any(String),
      startMs: expect.any(Number),
      endMs: expect.any(Number),
    });
    // Per-segment confidence is derived from full-JSON token probabilities.
    expect(result.segments[0].confidence).toBeTypeOf('number');
    expect(result.segments[0].confidence).toBeGreaterThan(0);
    expect(result.segments[0].confidence).toBeLessThanOrEqual(1);
    expect(result.durationMs).toBeGreaterThan(0);
  }, 60_000);
});
