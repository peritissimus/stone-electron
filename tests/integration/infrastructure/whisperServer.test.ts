/**
 * Integration test for WhisperServer against the real whisper-server binary and
 * the tiny.en model — validates the resident-server path (spawn, HTTP inference,
 * shutdown) end to end. Skips unless the binary + model exist, so it never
 * blocks the plain unit run.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { WhisperServer } from '../../../src/main/infrastructure/workers/WhisperServer';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const BINARY = join(ROOT, 'vendor', 'whisper', 'bin', 'whisper-server');
const MODEL_DIR = join(ROOT, 'tests', 'e2e', 'fixtures', '.cache');
const MODEL = join(MODEL_DIR, 'ggml-tiny.en.bin');
const JFK_WAV = join(ROOT, 'tests', 'e2e', 'fixtures', 'mic-sample.wav');

const ready = existsSync(BINARY) && existsSync(MODEL) && existsSync(JFK_WAV);

let server: WhisperServer | null = null;

describe.skipIf(!ready)('WhisperServer (real binary)', () => {
  afterAll(async () => {
    await server?.stop();
  });

  it('keeps the model resident and transcribes chunks over HTTP', async () => {
    server = new WhisperServer({ model: 'tiny.en', modelDir: MODEL_DIR, binary: BINARY });
    await server.start();
    expect(server.isReady()).toBe(true);

    const wav = new Uint8Array(readFileSync(JFK_WAV));
    const first = await server.transcribeChunk(wav);
    expect(first.text.toLowerCase()).toContain('country');

    // Second call hits the same resident process (no reload).
    const second = await server.transcribeChunk(wav);
    expect(second.text.toLowerCase()).toContain('country');
  }, 60_000);
});
