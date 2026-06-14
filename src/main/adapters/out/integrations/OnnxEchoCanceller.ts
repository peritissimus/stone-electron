/**
 * OnnxEchoCanceller — acoustic echo cancellation via the ICASSP-2022 AEC
 * Challenge baseline model (a recurrent mask network) run through
 * onnxruntime-node.
 *
 * The model streams one 20 ms frame at a time: it takes the log-power spectra
 * of the mic and the far-end reference (161 bins each → 322 features) plus two
 * GRU states, and emits a 161-bin suppression mask applied to the mic spectrum.
 * Reconstruction is overlap-add. We validated the pipeline end-to-end (clean
 * speech passes through untouched; simulated speaker bleed is removed and the
 * near-end recovered) before wiring it in.
 *
 * FFT is a direct DFT (frame size 320 isn't a power of two); fine for offline
 * post-processing of a recording. Audio is 16 kHz mono PCM WAV, matching the
 * recorder output and what whisper.cpp consumes next.
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

const FRAME = 320; // 20 ms @ 16 kHz
const HOP = 160; // 10 ms
const BINS = FRAME / 2 + 1; // 161
const EPS = 1e-12;

export interface OnnxEchoCancellerDeps {
  /** Path to the .onnx model (tests); defaults to bundled/dev resource path. */
  modelPath?: string;
}

export class OnnxEchoCanceller implements IEchoCanceller {
  private session: InferenceSession | null = null;
  private initializing: Promise<void> | null = null;
  private ort: typeof import('onnxruntime-node') | null = null;
  // Precomputed DFT twiddle tables (cos/sin), built once.
  private readonly win = new Float32Array(FRAME);
  private readonly cosT: Float32Array[] = [];
  private readonly sinT: Float32Array[] = [];

  constructor(private readonly deps: OnnxEchoCancellerDeps = {}) {
    for (let i = 0; i < FRAME; i++) this.win[i] = Math.sqrt(0.5 - 0.5 * Math.cos((2 * Math.PI * i) / FRAME));
    for (let k = 0; k < BINS; k++) {
      const c = new Float32Array(FRAME);
      const s = new Float32Array(FRAME);
      for (let n = 0; n < FRAME; n++) {
        const a = (2 * Math.PI * k * n) / FRAME;
        c[n] = Math.cos(a);
        s[n] = Math.sin(a);
      }
      this.cosT.push(c);
      this.sinT.push(s);
    }
  }

  isReady(): boolean {
    return this.session !== null;
  }

  async initialize(): Promise<void> {
    if (this.session) return;
    this.initializing ??= this.load();
    try {
      await this.initializing;
    } finally {
      this.initializing = null;
    }
  }

  async cancel(request: CancelEchoRequest): Promise<void> {
    if (!this.session || !this.ort) await this.initialize();
    if (!this.session || !this.ort) throw new Error('echo canceller not initialized');
    const ort = this.ort;

    const mic = await readWavMono16(request.micPath);
    const ref = await readWavMono16(request.referencePath);
    const n = Math.min(mic.length, ref.length);
    if (n < FRAME) {
      // Too short to process — just copy the mic through unchanged.
      await fs.copyFile(request.micPath, request.outputPath);
      return;
    }

    const out = new Float32Array(n + FRAME);
    const norm = new Float32Array(n + FRAME);
    const frames = Math.floor((n - FRAME) / HOP) + 1;

    let h01: OrtTensor = new ort.Tensor('float32', new Float32Array(322), [1, 1, 322]);
    let h02: OrtTensor = new ort.Tensor('float32', new Float32Array(322), [1, 1, 322]);
    const feat = new Float32Array(322);
    const mre = new Float32Array(BINS);
    const mim = new Float32Array(BINS);
    const fre = new Float32Array(BINS);
    const fim = new Float32Array(BINS);

    for (let t = 0; t < frames; t++) {
      const base = t * HOP;
      this.rfft(mic, base, mre, mim);
      this.rfft(ref, base, fre, fim);
      for (let k = 0; k < BINS; k++) {
        feat[k] = Math.log(mre[k] * mre[k] + mim[k] * mim[k] + EPS);
        feat[BINS + k] = Math.log(fre[k] * fre[k] + fim[k] * fim[k] + EPS);
      }
      const result = await this.session.run({
        input: new ort.Tensor('float32', feat.slice(), [1, 1, 322]),
        h01,
        h02,
      });
      const mask = result.output.data as Float32Array;
      h01 = result.hn1;
      h02 = result.hn2;
      for (let k = 0; k < BINS; k++) {
        mre[k] *= mask[k];
        mim[k] *= mask[k];
      }
      this.irfftOverlapAdd(mre, mim, out, norm, base);
    }

    const clean = new Float32Array(n);
    for (let i = 0; i < n; i++) clean[i] = out[i] / (norm[i] < 1e-8 ? 1e-8 : norm[i]);
    await writeWavMono16(request.outputPath, clean);
  }

  // ===========================================================================

  /** Windowed real FFT of `signal[base..base+FRAME)` into re/im (length BINS). */
  private rfft(signal: Float32Array, base: number, re: Float32Array, im: Float32Array): void {
    for (let k = 0; k < BINS; k++) {
      const c = this.cosT[k];
      const s = this.sinT[k];
      let r = 0;
      let i = 0;
      for (let n = 0; n < FRAME; n++) {
        const x = signal[base + n] * this.win[n];
        r += x * c[n];
        i -= x * s[n];
      }
      re[k] = r;
      im[k] = i;
    }
  }

  /** Inverse real FFT, windowed, accumulated into out/norm at `base`. */
  private irfftOverlapAdd(
    re: Float32Array,
    im: Float32Array,
    out: Float32Array,
    norm: Float32Array,
    base: number,
  ): void {
    for (let n = 0; n < FRAME; n++) {
      let acc = re[0];
      for (let k = 1; k < BINS - 1; k++) {
        const a = (2 * Math.PI * k * n) / FRAME;
        acc += 2 * (re[k] * Math.cos(a) - im[k] * Math.sin(a));
      }
      const aN = (2 * Math.PI * (BINS - 1) * n) / FRAME;
      acc += re[BINS - 1] * Math.cos(aN) - im[BINS - 1] * Math.sin(aN);
      const sample = (acc / FRAME) * this.win[n];
      out[base + n] += sample;
      norm[base + n] += this.win[n] * this.win[n];
    }
  }

  private async load(): Promise<void> {
    const ort = await import('onnxruntime-node');
    ort.env.logLevel = 'error';
    const modelPath = this.modelPath();
    this.session = await ort.InferenceSession.create(modelPath, {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'all',
    });
    this.ort = ort;
    logger.info(`[OnnxEchoCanceller] model ready: ${modelPath}`);
  }

  private modelPath(): string {
    if (this.deps.modelPath) return this.deps.modelPath;
    const file = 'dec-baseline-icassp2022.onnx';
    if (app?.isPackaged) return path.join(process.resourcesPath, 'aec', file);
    return path.join(process.cwd(), 'resources', 'aec', file);
  }
}

// ===========================================================================
// WAV I/O — 16 kHz mono PCM16, matching the recorder + whisper.cpp.

async function readWavMono16(p: string): Promise<Float32Array> {
  const buf = await fs.readFile(p);
  let off = 12; // skip RIFF/WAVE
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
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(16000, 24);
  buf.writeUInt32LE(32000, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i])) * 32767;
    buf.writeInt16LE(v | 0, 44 + i * 2);
  }
  await fs.writeFile(p, buf);
}
