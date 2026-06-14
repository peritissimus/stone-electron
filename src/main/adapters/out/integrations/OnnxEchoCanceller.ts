/**
 * OnnxEchoCanceller — acoustic echo cancellation via DTLN-aec, run through
 * onnxruntime-node.
 *
 * On speakers the meeting audio bleeds into the mic; we capture that audio
 * digitally (the clean far-end reference) and subtract it from the mic before
 * transcription, the same approach Granola/anarlog use. DTLN-aec is a two-stage
 * model: stage 1 predicts a spectral mask on the mic from the mic + far-end
 * magnitudes; stage 2 refines the masked signal in the time domain. Block 512 /
 * hop 128, two GRU states per stage, overlap-add.
 *
 * The critical real-world step is DELAY COMPENSATION: the system loopback is
 * captured a few tens of ms out of sync with the mic's echo, and a canceller
 * can't subtract a reference that isn't time-aligned with the echo it caused.
 * We estimate the lag (energy-envelope cross-correlation) and advance the
 * reference before inference. Validated end-to-end: clean speech passes through
 * untouched, and real speaker bleed is cancelled (~14 dB ERLE) with the
 * near-end recovered when it isn't buried. Python reference in scripts/aec.
 *
 * Runs offline on the recorded tracks; best-effort, the caller falls back to the
 * raw mic on any failure.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { InferenceSession, Tensor as OrtTensor } from 'onnxruntime-node';
import type { CancelEchoRequest, IEchoCanceller } from '../../../domain';
import { logger } from '../../../shared/utils';

let app: { isPackaged?: boolean } | null = null;
try {
  app = require('electron').app;
} catch {
  // Outside Electron (tests/standalone) — model path falls back to cwd.
}

const BLOCK = 512; // DTLN frame
const HOP = 128;
const BINS = BLOCK / 2 + 1; // 257
const SR = 16000;
const MAX_LAG = Math.round(0.2 * SR); // ±200 ms delay search
const ENV_HOP = 160; // 10 ms envelope resolution for delay estimation
const MIN_LAG_CORR = 0.15; // confidence floor for applying a delay

export interface OnnxEchoCancellerDeps {
  /** Directory holding the DTLN onnx models (tests); defaults to bundled/dev. */
  modelDir?: string;
}

export class OnnxEchoCanceller implements IEchoCanceller {
  private m1: InferenceSession | null = null;
  private m2: InferenceSession | null = null;
  private ort: typeof import('onnxruntime-node') | null = null;
  private initializing: Promise<void> | null = null;

  constructor(private readonly deps: OnnxEchoCancellerDeps = {}) {}

  isReady(): boolean {
    return this.m1 !== null && this.m2 !== null;
  }

  async initialize(): Promise<void> {
    if (this.isReady()) return;
    this.initializing ??= this.load();
    try {
      await this.initializing;
    } finally {
      this.initializing = null;
    }
  }

  async cancel(request: CancelEchoRequest): Promise<void> {
    if (!this.isReady()) await this.initialize();
    if (!this.m1 || !this.m2 || !this.ort) throw new Error('echo canceller not initialized');
    const ort = this.ort;

    const mic = await readWavMono16(request.micPath);
    let ref = await readWavMono16(request.referencePath);
    const n = Math.min(mic.length, ref.length);
    if (n < BLOCK) {
      await fs.copyFile(request.micPath, request.outputPath);
      return;
    }

    // Align the reference to the mic's echo (loopback capture is offset).
    const lag = estimateLag(mic, ref, n);
    if (lag > 0) ref = advance(ref, lag);

    const out = new Float32Array(n);
    const inBuf = new Float64Array(BLOCK);
    const refBuf = new Float64Array(BLOCK);
    const outBuf = new Float64Array(BLOCK);
    const fre = new Float64Array(BLOCK);
    const fim = new Float64Array(BLOCK);
    const rre = new Float64Array(BLOCK);
    const rim = new Float64Array(BLOCK);
    const micMag = new Float32Array(BINS);
    const refMag = new Float32Array(BINS);

    let s1: OrtTensor = new ort.Tensor('float32', new Float32Array(2 * 512 * 2), [1, 2, 512, 2]);
    let s2: OrtTensor = new ort.Tensor('float32', new Float32Array(2 * 512 * 2), [1, 2, 512, 2]);
    const frames = Math.floor((n - BLOCK) / HOP) + 1;

    for (let k = 0; k < frames; k++) {
      const base = k * HOP;
      shiftIn(inBuf, mic, base);
      shiftIn(refBuf, ref, base);

      // Stage 1: spectral mask from mic + far-end magnitudes.
      rfft(inBuf, fre, fim);
      rfft(refBuf, rre, rim);
      for (let b = 0; b < BINS; b++) {
        micMag[b] = Math.hypot(fre[b], fim[b]);
        refMag[b] = Math.hypot(rre[b], rim[b]);
      }
      const r1 = await this.m1.run({
        input_3: new ort.Tensor('float32', micMag.slice(), [1, 1, BINS]),
        input_4: new ort.Tensor('float32', refMag.slice(), [1, 1, BINS]),
        input_5: s1,
      });
      const mask = r1.Identity.data as Float32Array;
      s1 = r1.Identity_1;
      for (let b = 0; b < BINS; b++) {
        fre[b] *= mask[b];
        fim[b] *= mask[b];
      }
      const est = new Float32Array(BLOCK);
      irfft(fre, fim, est);

      // Stage 2: time-domain refinement using the far-end block.
      const refBlock = new Float32Array(BLOCK);
      for (let i = 0; i < BLOCK; i++) refBlock[i] = refBuf[i];
      const r2 = await this.m2.run({
        input_6: new ort.Tensor('float32', est, [1, 1, BLOCK]),
        input_7: new ort.Tensor('float32', refBlock, [1, 1, BLOCK]),
        input_8: s2,
      });
      const outBlock = r2.Identity.data as Float32Array;
      s2 = r2.Identity_1;

      // Overlap-add (shift out by HOP, add, emit first HOP samples).
      outBuf.copyWithin(0, HOP);
      outBuf.fill(0, BLOCK - HOP);
      for (let i = 0; i < BLOCK; i++) outBuf[i] += outBlock[i];
      for (let i = 0; i < HOP; i++) out[base + i] = outBuf[i];
    }

    await writeWavMono16(request.outputPath, out);
  }

  // ===========================================================================

  private async load(): Promise<void> {
    const ort = await import('onnxruntime-node');
    ort.env.logLevel = 'error';
    const dir = this.modelDir();
    const opts = { executionProviders: ['cpu'], graphOptimizationLevel: 'all' as const };
    this.m1 = await ort.InferenceSession.create(path.join(dir, 'dtln_aec_512_1.onnx'), opts);
    this.m2 = await ort.InferenceSession.create(path.join(dir, 'dtln_aec_512_2.onnx'), opts);
    this.ort = ort;
    logger.info(`[OnnxEchoCanceller] DTLN-aec models ready: ${dir}`);
  }

  private modelDir(): string {
    if (this.deps.modelDir) return this.deps.modelDir;
    if (app?.isPackaged) return path.join(process.resourcesPath, 'aec');
    return path.join(process.cwd(), 'resources', 'aec');
  }
}

// ===========================================================================
// DSP

/** Slide a new HOP of `src` (ending at base+BLOCK) into the buffer. */
function shiftIn(buf: Float64Array, src: Float32Array, base: number): void {
  buf.copyWithin(0, HOP);
  for (let i = 0; i < HOP; i++) {
    const idx = base + BLOCK - HOP + i;
    buf[BLOCK - HOP + i] = idx < src.length ? src[idx] : 0;
  }
}

/** Advance (shift earlier) a signal by `lag` samples, zero-padding the tail. */
function advance(x: Float32Array, lag: number): Float32Array {
  const out = new Float32Array(x.length);
  out.set(x.subarray(lag));
  return out;
}

/**
 * Estimate how many samples to ADVANCE the reference so its energy aligns with
 * the mic's echo. Energy-envelope cross-correlation (10 ms grid) over a capped
 * window; returns 0 when no confident peak is found.
 */
function estimateLag(mic: Float32Array, ref: Float32Array, n: number): number {
  const cap = Math.min(n, 60 * SR);
  const frames = Math.floor(cap / ENV_HOP);
  if (frames < 8) return 0;
  const em = envelope(mic, frames);
  const er = envelope(ref, frames);
  const maxF = Math.min(Math.floor(MAX_LAG / ENV_HOP), frames - 4);
  let bestAdv = 0;
  let bestCorr = MIN_LAG_CORR;
  for (let adv = -maxF; adv <= maxF; adv++) {
    const c = corrAt(em, er, adv);
    if (c > bestCorr) {
      bestCorr = c;
      bestAdv = adv;
    }
  }
  return Math.max(0, bestAdv) * ENV_HOP;
}

function envelope(x: Float32Array, frames: number): Float32Array {
  const e = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let s = 0;
    const o = f * ENV_HOP;
    for (let i = 0; i < ENV_HOP; i++) s += x[o + i] * x[o + i];
    e[f] = Math.sqrt(s / ENV_HOP + 1e-9);
  }
  // Mean-remove for correlation.
  let mean = 0;
  for (let f = 0; f < frames; f++) mean += e[f];
  mean /= frames;
  for (let f = 0; f < frames; f++) e[f] -= mean;
  return e;
}

/** Normalized correlation of mic-env and ref-env shifted so ref[t+adv] ~ mic[t]. */
function corrAt(em: Float32Array, er: Float32Array, adv: number): number {
  let num = 0;
  let da = 0;
  let db = 0;
  for (let t = 0; t < em.length; t++) {
    const j = t + adv;
    if (j < 0 || j >= er.length) continue;
    num += em[t] * er[j];
    da += em[t] * em[t];
    db += er[j] * er[j];
  }
  return num / (Math.sqrt(da * db) + 1e-9);
}

// --- radix-2 FFT (BLOCK is a power of two) ------------------------------------

const BITREV = buildBitrev(BLOCK);
const COS = new Float64Array(BLOCK / 2);
const SIN = new Float64Array(BLOCK / 2);
for (let i = 0; i < BLOCK / 2; i++) {
  COS[i] = Math.cos((-2 * Math.PI * i) / BLOCK);
  SIN[i] = Math.sin((-2 * Math.PI * i) / BLOCK);
}

function buildBitrev(n: number): Uint16Array {
  const rev = new Uint16Array(n);
  let j = 0;
  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    rev[i] = j;
  }
  return rev;
}

/** In-place complex FFT of length BLOCK. `inverse` scales by 1/N. */
function fft(re: Float64Array, im: Float64Array, inverse: boolean): void {
  const n = BLOCK;
  for (let i = 0; i < n; i++) {
    const j = BITREV[i];
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const step = n / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0, idx = 0; k < half; k++, idx += step) {
        let wr = COS[idx];
        let wi = inverse ? -SIN[idx] : SIN[idx];
        const a = i + k;
        const b = a + half;
        const vr = re[b] * wr - im[b] * wi;
        const vi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - vr;
        im[b] = im[a] - vi;
        re[a] += vr;
        im[a] += vi;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
  }
}

/** Real FFT of a BLOCK-length frame → first BINS bins in re/im. */
function rfft(frame: Float64Array, re: Float64Array, im: Float64Array): void {
  for (let i = 0; i < BLOCK; i++) {
    re[i] = frame[i];
    im[i] = 0;
  }
  fft(re, im, false);
}

/** Inverse real FFT from BINS bins → time-domain `out` (BLOCK samples). */
function irfft(re: Float64Array, im: Float64Array, out: Float32Array): void {
  const fr = new Float64Array(BLOCK);
  const fi = new Float64Array(BLOCK);
  for (let b = 0; b < BINS; b++) {
    fr[b] = re[b];
    fi[b] = im[b];
  }
  for (let b = BINS; b < BLOCK; b++) {
    fr[b] = re[BLOCK - b];
    fi[b] = -im[BLOCK - b];
  }
  fft(fr, fi, true);
  for (let i = 0; i < BLOCK; i++) out[i] = fr[i];
}

// ===========================================================================
// WAV I/O — 16 kHz mono PCM16, matching the recorder + whisper.cpp.

async function readWavMono16(p: string): Promise<Float32Array> {
  const buf = await fs.readFile(p);
  let off = 12;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'data') {
      const count = Math.floor(size / 2);
      const f = new Float32Array(count);
      for (let i = 0; i < count; i++) f[i] = buf.readInt16LE(off + 8 + i * 2) / 32768;
      return f;
    }
    off += 8 + size + (size & 1);
  }
  throw new Error(`no data chunk in WAV: ${p}`);
}

async function writeWavMono16(p: string, samples: Float32Array): Promise<void> {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i])) * 32767;
    buf.writeInt16LE(v | 0, 44 + i * 2);
  }
  await fs.writeFile(p, buf);
}
