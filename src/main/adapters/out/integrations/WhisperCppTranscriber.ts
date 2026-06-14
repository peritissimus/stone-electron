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
import { collapseRepeatedSegments } from '../../../domain';
import { logger } from '../../../shared/utils';

let app: { isPackaged?: boolean; getPath?: (n: string) => string } | null = null;
try {
  app = require('electron').app;
} catch {
  // Outside Electron (tests/standalone) — paths fall back to cwd/tmp.
}

/**
 * Default model: large-v3-turbo, quantized q5_0 (~574 MB) — near-full quality,
 * fast, and far stronger at multilingual / code-switching than `base`, which
 * mangled mixed Hindi/English speech. Downloaded once to userData on first use.
 */
const WHISPER_MODEL = 'large-v3-turbo-q5_0';
const MODEL_URL = (model: string) =>
  `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${model}.bin`;

/**
 * Silero VAD model. With VAD enabled, whisper transcribes only speech regions
 * and skips silence — which prevents the repetition/hallucination loops the
 * decoder falls into on long quiet stretches (made worse by echo cancellation,
 * which leaves the "You" track mostly silent while the user is listening).
 */
const VAD_MODEL_FILE = 'ggml-silero-v5.1.2.bin';
const VAD_MODEL_URL =
  'https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin';

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
    this.initializing ??= this.ensureModels();
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
      // Use VAD only when the model is present — graceful for offline/tests.
      const vadPath = this.vadModelPath();
      const vadArgs = (await fileExists(vadPath)) ? ['--vad', '-vm', vadPath] : [];
      await execFileAsync(binary, [
        '-m',
        await this.modelPath(),
        '-f',
        request.audioPath,
        '-l',
        'auto', // multilingual auto-detect
        ...vadArgs, // skip silence — prevents decoder repetition loops
        '-oj', // output JSON
        '-of',
        outBase,
        '--no-prints',
      ]);

      const parsed = JSON.parse(await fs.readFile(jsonPath, 'utf8')) as WhisperJson;
      const rawSegments: TranscriptSegment[] = (parsed.transcription ?? []).map((s) => ({
        text: s.text.trim(),
        startMs: s.offsets?.from ?? 0,
        endMs: s.offsets?.to ?? 0,
      }));
      // Collapse consecutive-duplicate runs — whisper's repetition-loop
      // hallucination on long/continuous audio (e.g. a phrase echoed once a
      // second for minutes).
      const segments = collapseRepeatedSegments(rawSegments);
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

  private vadModelPath(): string {
    return path.join(this.modelDir(), VAD_MODEL_FILE);
  }

  /** Ensure both the transcription model and the VAD model are present. */
  private async ensureModels(): Promise<void> {
    await fs.mkdir(this.modelDir(), { recursive: true });
    // VAD model is tiny — download silently and best-effort: if it fails,
    // transcription still runs (without silence-skipping) rather than breaking.
    await this.download(VAD_MODEL_URL, this.vadModelPath(), VAD_MODEL_FILE, false).catch((err) =>
      logger.warn(`[WhisperCpp] VAD model unavailable, continuing without it: ${err}`),
    );
    await this.download(MODEL_URL(this.model), await this.modelPath(), `ggml-${this.model}.bin`, true);
  }

  /** Download `url` to `dest` if missing, optionally broadcasting progress. */
  private async download(
    url: string,
    dest: string,
    file: string,
    withProgress: boolean,
  ): Promise<void> {
    try {
      const stat = await fs.stat(dest);
      if (stat.size > 0) return; // already downloaded
    } catch {
      // missing — download below
    }

    const tmp = `${dest}.download`;
    logger.info(`[WhisperCpp] downloading ${file}`);

    const res = await fetch(url);
    if (!res.ok || !res.body) {
      throw new Error(`Failed to download ${file} (${res.status})`);
    }
    const total = Number(res.headers.get('content-length')) || 0;
    const reader = res.body.getReader();
    const handle = await fs.open(tmp, 'w');
    try {
      let loaded = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        await handle.write(value);
        loaded += value.length;
        if (withProgress) this.deps.onDownloadProgress?.({ file, loaded, total });
      }
    } finally {
      await handle.close();
    }
    await fs.rename(tmp, dest);
    logger.info(`[WhisperCpp] ready: ${dest}`);
  }
}

interface WhisperJson {
  transcription?: Array<{
    text: string;
    offsets?: { from: number; to: number };
  }>;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p);
    return stat.size > 0;
  } catch {
    return false;
  }
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
