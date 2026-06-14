/**
 * Integration test for OnnxEchoCanceller against the real DTLN-aec models via
 * onnxruntime-node. Validates the full pipeline (WAV I/O, FFT, delay estimation,
 * two-stage streaming inference, overlap-add) on two fronts:
 *   1. pass-through — clean speech with a silent reference is preserved.
 *   2. cancellation — simulated speaker bleed is reduced relative to the mic.
 *
 * Skips unless the bundled models exist, so it never blocks plain unit runs
 * without them present.
 */
import { existsSync, promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { OnnxEchoCanceller } from '../../../src/main/adapters/out/integrations/OnnxEchoCanceller';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const MODEL_DIR = join(ROOT, 'resources', 'aec');
const NEAR_WAV = join(ROOT, 'tests', 'e2e', 'fixtures', 'mic-sample.wav');
const FAR_WAV = join(ROOT, 'tests', 'e2e', 'fixtures', 'system-sample.wav');

const ready =
  existsSync(join(MODEL_DIR, 'dtln_aec_512_1.onnx')) &&
  existsSync(join(MODEL_DIR, 'dtln_aec_512_2.onnx')) &&
  existsSync(NEAR_WAV) &&
  existsSync(FAR_WAV);

function readWav(buf: Buffer): Float32Array {
  let off = 12;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'data') {
      const n = Math.floor(size / 2);
      const f = new Float32Array(n);
      for (let i = 0; i < n; i++) f[i] = buf.readInt16LE(off + 8 + i * 2) / 32768;
      return f;
    }
    off += 8 + size + (size & 1);
  }
  throw new Error('no data chunk');
}

function writeWav(samples: Float32Array): Buffer {
  const n = samples.length;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write('WAVE', 8);
  b.write('fmt ', 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(16000, 24);
  b.writeUInt32LE(32000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE((Math.max(-1, Math.min(1, samples[i])) * 32767) | 0, 44 + i * 2);
  return b;
}

/** Magnitude-spectrogram correlation — robust to room coloring / phase. */
function spectralCorr(a: Float32Array, b: Float32Array): number {
  const N = 320;
  const H = 160;
  const k = Math.min(a.length, b.length);
  const frames = Math.floor((k - N) / H) + 1;
  const sa: number[] = [];
  const sb: number[] = [];
  for (let t = 0; t < frames; t++) {
    for (let f = 0; f <= N / 2; f += 4) {
      let ar = 0;
      let ai = 0;
      let br = 0;
      let bi = 0;
      for (let n = 0; n < N; n++) {
        const ang = (2 * Math.PI * f * n) / N;
        const c = Math.cos(ang);
        const s = Math.sin(ang);
        ar += a[t * H + n] * c;
        ai -= a[t * H + n] * s;
        br += b[t * H + n] * c;
        bi -= b[t * H + n] * s;
      }
      sa.push(Math.log1p(Math.hypot(ar, ai)));
      sb.push(Math.log1p(Math.hypot(br, bi)));
    }
  }
  const ma = sa.reduce((x, y) => x + y, 0) / sa.length;
  const mb = sb.reduce((x, y) => x + y, 0) / sb.length;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < sa.length; i++) {
    num += (sa[i] - ma) * (sb[i] - mb);
    da += (sa[i] - ma) ** 2;
    db += (sb[i] - mb) ** 2;
  }
  return num / (Math.sqrt(da * db) + 1e-9);
}

const tmpFiles: string[] = [];
async function tmp(name: string, samples: Float32Array): Promise<string> {
  const p = join(os.tmpdir(), `stone-aec-test-${name}-${samples.length}.wav`);
  await fs.writeFile(p, writeWav(samples));
  tmpFiles.push(p);
  return p;
}

describe.skipIf(!ready)('OnnxEchoCanceller (real model)', () => {
  afterAll(async () => {
    for (const p of tmpFiles) await fs.rm(p, { force: true }).catch(() => {});
  });

  it('preserves clean speech when the reference is silent', async () => {
    const near = readWav(await fs.readFile(NEAR_WAV));
    const micPath = await tmp('near', near);
    const refPath = await tmp('silence', new Float32Array(near.length));
    const outPath = join(os.tmpdir(), `stone-aec-test-passthrough.wav`);
    tmpFiles.push(outPath);

    const aec = new OnnxEchoCanceller({ modelDir: MODEL_DIR });
    await aec.cancel({ micPath, referencePath: refPath, outputPath: outPath });

    const out = readWav(await fs.readFile(outPath));
    // The cleaned output should still strongly resemble the clean input.
    expect(spectralCorr(out, near)).toBeGreaterThan(0.85);
  }, 60_000);

  it('reduces speaker bleed using the reference track', async () => {
    const near = readWav(await fs.readFile(NEAR_WAV));
    const far = readWav(await fs.readFile(FAR_WAV));
    const n = Math.min(near.length, far.length);
    // Simulate realistic speaker bleed: delayed, attenuated copy of far-end.
    const delay = 120;
    const mic = new Float32Array(n);
    for (let i = 0; i < n; i++) mic[i] = near[i] + (i >= delay ? 0.35 * far[i - delay] : 0);

    const micPath = await tmp('mixed', mic);
    const refPath = await tmp('far', far.subarray(0, n));
    const outPath = join(os.tmpdir(), `stone-aec-test-cancel.wav`);
    tmpFiles.push(outPath);

    const aec = new OnnxEchoCanceller({ modelDir: MODEL_DIR });
    await aec.cancel({ micPath, referencePath: refPath, outputPath: outPath });
    const out = readWav(await fs.readFile(outPath));

    const before = spectralCorr(mic, far.subarray(0, n) as Float32Array);
    const after = spectralCorr(out, far.subarray(0, n) as Float32Array);
    // Cancellation should make the mic less like the far-end (less echo).
    expect(after).toBeLessThan(before);
  }, 60_000);
});
