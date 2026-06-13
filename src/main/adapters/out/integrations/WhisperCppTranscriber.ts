/**
 * WhisperCppTranscriber — local speech-to-text via the bundled whisper.cpp CLI.
 *
 * Spawns `whisper-cli` on a 16 kHz mono WAV and parses its JSON output. Far
 * faster than the in-process transformers.js path (Metal/Accelerate native),
 * and supports larger + multilingual models. The GGML model is downloaded once
 * to userData on first use; the binary is built by scripts/build-whisper.sh and
 * bundled via electron-builder.
 */

import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {
  ITranscriber,
  TranscribeRequest,
  TranscribeResult,
  TranscriptSegment,
} from '../../../domain';
import { logger } from '../../../shared/utils';

let app: { isPackaged?: boolean; getPath?: (n: string) => string } | null = null;
try {
  app = require('electron').app;
} catch {
  // Outside Electron (tests/standalone) — paths fall back to cwd/tmp.
}

/** Default model: multilingual `base` (~142 MB). Swap to small/medium for
 *  higher accuracy once the model selector lands. */
const WHISPER_MODEL = 'base';
const MODEL_URL = (model: string) =>
  `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${model}.bin`;

export interface WhisperCppTranscriberDeps {
  /** Broadcast model-download progress to the renderer (wired in DI). */
  onDownloadProgress?: (info: { file: string; loaded: number; total: number }) => void;
  /** Model name override (test/config); defaults to WHISPER_MODEL. */
  model?: string;
  /** Directory holding the ggml model files (tests); defaults to userData. */
  modelDir?: string;
  /** Path to the whisper-cli binary (tests); defaults to bundled/dev path. */
  binary?: string;
}

export class WhisperCppTranscriber implements ITranscriber {
  private readonly model: string;
  private ready = false;
  private initializing: Promise<void> | null = null;

  constructor(private readonly deps: WhisperCppTranscriberDeps = {}) {
    // STONE_WHISPER_MODEL lets e2e tests pin a small fast model (tiny.en);
    // production uses the default until the model selector wires AppConfig.
    this.model = deps.model ?? process.env.STONE_WHISPER_MODEL ?? WHISPER_MODEL;
  }

  isReady(): boolean {
    return this.ready;
  }

  async initialize(): Promise<void> {
    if (this.ready) return;
    // Single-flight so concurrent transcribe() calls share one download.
    this.initializing ??= this.ensureModel();
    try {
      await this.initializing;
      this.ready = true;
    } finally {
      this.initializing = null;
    }
  }

  async transcribe(request: TranscribeRequest): Promise<TranscribeResult> {
    if (!this.ready) await this.initialize();

    const binary = this.binaryPath();
    const outBase = path.join(
      os.tmpdir(),
      `stone-whisper-${path.basename(request.audioPath)}`,
    );
    const jsonPath = `${outBase}.json`;

    try {
      await execFileAsync(binary, [
        '-m',
        await this.modelPath(),
        '-f',
        request.audioPath,
        '-l',
        'auto', // multilingual auto-detect
        '-oj', // output JSON
        '-of',
        outBase,
        '--no-prints',
      ]);

      const parsed = JSON.parse(await fs.readFile(jsonPath, 'utf8')) as WhisperJson;
      const segments: TranscriptSegment[] = (parsed.transcription ?? []).map((s) => ({
        text: s.text.trim(),
        startMs: s.offsets?.from ?? 0,
        endMs: s.offsets?.to ?? 0,
      }));
      const text = segments
        .map((s) => s.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      const durationMs = segments.length ? segments[segments.length - 1].endMs : 0;
      return { text, segments, durationMs };
    } finally {
      await fs.rm(jsonPath, { force: true }).catch(() => {});
    }
  }

  // ===========================================================================

  private binaryPath(): string {
    if (this.deps.binary) return this.deps.binary;
    if (app?.isPackaged) {
      return path.join(process.resourcesPath, 'whisper', 'whisper-cli');
    }
    return path.join(process.cwd(), 'vendor', 'whisper', 'bin', 'whisper-cli');
  }

  private modelDir(): string {
    if (this.deps.modelDir) return this.deps.modelDir;
    const base = app?.getPath?.('userData') ?? path.join(os.tmpdir(), 'stone');
    return path.join(base, 'whisper-models');
  }

  private async modelPath(): Promise<string> {
    return path.join(this.modelDir(), `ggml-${this.model}.bin`);
  }

  /** Download the GGML model to userData if it isn't already there. */
  private async ensureModel(): Promise<void> {
    const dir = this.modelDir();
    const dest = await this.modelPath();
    try {
      const stat = await fs.stat(dest);
      if (stat.size > 0) return; // already downloaded
    } catch {
      // missing — download below
    }

    await fs.mkdir(dir, { recursive: true });
    const url = MODEL_URL(this.model);
    const tmp = `${dest}.download`;
    logger.info(`[WhisperCpp] downloading model ggml-${this.model}.bin`);

    const res = await fetch(url);
    if (!res.ok || !res.body) {
      throw new Error(`Failed to download Whisper model (${res.status})`);
    }
    const total = Number(res.headers.get('content-length')) || 0;
    const file = `ggml-${this.model}.bin`;
    const reader = res.body.getReader();
    const handle = await fs.open(tmp, 'w');
    try {
      let loaded = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        await handle.write(value);
        loaded += value.length;
        this.deps.onDownloadProgress?.({ file, loaded, total });
      }
    } finally {
      await handle.close();
    }
    await fs.rename(tmp, dest);
    logger.info(`[WhisperCpp] model ready: ${dest}`);
  }
}

interface WhisperJson {
  transcription?: Array<{
    text: string;
    offsets?: { from: number; to: number };
  }>;
}

function execFileAsync(file: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { maxBuffer: 64 * 1024 * 1024 }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(`whisper-cli failed: ${error.message}${stderr ? ` — ${stderr}` : ''}`));
        return;
      }
      resolve();
    });
  });
}
