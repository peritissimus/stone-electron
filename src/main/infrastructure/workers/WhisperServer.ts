/**
 * WhisperServer — resident whisper.cpp server for live (per-chunk) transcription.
 *
 * Spawns `whisper-server` once with the model loaded, then transcribes short
 * WAV chunks over its local HTTP endpoint — so each chunk skips the ~547 MB
 * model reload that spawning whisper-cli would incur. Used only for the live
 * draft while recording; the clean per-source transcript is still produced by
 * the batch pipeline at finalize.
 *
 * Best-effort: if the binary or model isn't available, start() throws and the
 * caller simply runs without a live draft.
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import net from 'node:net';
import type { ILiveTranscriber, LiveChunkResult, TranscriptSegment } from '../../domain';
import { collapseRepeatedSegments } from '../../domain';
import { SupervisedProcess, logger } from '../../shared/utils';
import {
  vadModelPath,
  whisperBinaryPath,
  whisperModelPath,
  LIVE_WHISPER_MODEL,
} from '../../shared/whisper/whisperPaths';
import { ensureVadModel, ensureWhisperModel } from '../../shared/whisper/whisperModelDownload';
import type { ManagedWorker, WorkerStatus } from './WorkerManager';

/** Per-chunk transcription timeout. A live chunk is only a few seconds of
 *  audio; if the resident server hasn't responded within this, it's wedged and
 *  should be restarted rather than left to block on undici's 5-minute default. */
const CHUNK_TIMEOUT_MS = 20_000;

/** Bounded thread count for the live server. The live draft runs continuously
 *  during capture, so we cap CPU threads to leave headroom for the rest of the
 *  system (GPU/Metal does the heavy matmuls); finalize is free to use more. */
const LIVE_THREADS = 2;

/** Once a chunk detects a language this confidently, pin it for the rest of the
 *  session. `-l auto` otherwise re-runs a full encoder pass per chunk just to
 *  re-decide a language that doesn't change mid-meeting — pinning it is ~2× less
 *  compute at identical quality. */
const LANGUAGE_PIN_THRESHOLD = 0.6;

export interface WhisperServerDeps {
  /** Live-draft model; defaults to LIVE_WHISPER_MODEL (small/fast). */
  model?: string;
  modelDir?: string;
  binary?: string;
  /** Host to bind; localhost only by design. */
  host?: string;
  /** CPU threads for inference; defaults to LIVE_THREADS. */
  threads?: number;
}

export class WhisperServer implements ILiveTranscriber, ManagedWorker {
  readonly name = 'live-transcription';
  private readonly model: string;
  private readonly host: string;
  private readonly threads: number;
  private port = 0;
  /** Detected language, pinned after the first confident chunk to avoid a
   *  per-chunk re-detection pass. Reset per recording in stop(). */
  private pinnedLanguage: string | null = null;
  /** Owns spawn/health-check/restart/backoff/circuit-breaker for the binary. */
  private readonly supervisor: SupervisedProcess;

  constructor(private readonly deps: WhisperServerDeps = {}) {
    this.model = deps.model ?? process.env.STONE_WHISPER_MODEL ?? LIVE_WHISPER_MODEL;
    this.host = deps.host ?? '127.0.0.1';
    this.threads = deps.threads ?? LIVE_THREADS;
    this.supervisor = new SupervisedProcess({
      name: 'whisper-server',
      spawn: () => this.spawnServer(),
      healthCheck: () => waitForReady(`http://${this.host}:${this.port}/`, 30_000),
    });
  }

  isReady(): boolean {
    return this.supervisor.isReady();
  }

  status(): WorkerStatus {
    return {
      name: this.name,
      state: this.supervisor.isReady() ? 'ready' : 'idle',
      detail: this.pinnedLanguage ? `language=${this.pinnedLanguage}` : undefined,
    };
  }

  async start(): Promise<void> {
    await this.supervisor.ensureReady();
  }

  async stop(): Promise<void> {
    this.supervisor.stop();
    this.port = 0;
    this.pinnedLanguage = null;
  }

  async transcribeChunk(wav: Uint8Array): Promise<LiveChunkResult> {
    await this.supervisor.ensureReady();

    const form = new FormData();
    form.append('file', new Blob([wav as BlobPart], { type: 'audio/wav' }), 'chunk.wav');
    // verbose_json so the response carries language_probabilities, letting us
    // pin the language after the first confident chunk (see maybePinLanguage).
    form.append('response_format', 'verbose_json');
    form.append('language', this.pinnedLanguage ?? 'auto');
    form.append('temperature', '0');

    let res: Response;
    try {
      res = await fetch(`http://${this.host}:${this.port}/inference`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(CHUNK_TIMEOUT_MS),
      });
    } catch (err) {
      // The server hung or died: tell the supervisor so the next chunk respawns
      // a fresh process instead of piling onto a wedged one (each stuck fetch
      // would otherwise block for undici's 5-minute default). The circuit
      // breaker stops us relaunching a persistently-broken binary in a loop.
      // Live draft is best-effort — the clean transcript still comes from batch
      // finalize.
      this.supervisor.markUnhealthy('chunk inference fetch failed');
      throw err;
    }
    if (!res.ok) throw new Error(`whisper-server inference failed (${res.status})`);
    const json = (await res.json()) as ServerResponse;
    this.maybePinLanguage(json);

    const raw: TranscriptSegment[] = (json.segments ?? []).map((s) => ({
      text: (s.text ?? '').trim(),
      startMs: Math.round((s.t0 ?? s.start ?? 0) * 1000),
      endMs: Math.round((s.t1 ?? s.end ?? 0) * 1000),
    }));
    const segments = collapseRepeatedSegments(raw);
    const text =
      segments.length > 0
        ? segments.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim()
        : (json.text ?? '').trim();
    return { text, segments };
  }

  // ===========================================================================

  /** Pin the language after the first chunk whose top language probability
   *  clears the threshold, so later chunks skip the per-chunk detection pass. */
  private maybePinLanguage(json: ServerResponse): void {
    if (this.pinnedLanguage) return;
    const probs = json.language_probabilities;
    if (!probs) return;
    let bestCode: string | null = null;
    let bestProb = 0;
    for (const [code, prob] of Object.entries(probs)) {
      if (typeof prob === 'number' && prob > bestProb) {
        bestProb = prob;
        bestCode = code;
      }
    }
    if (bestCode && bestProb >= LANGUAGE_PIN_THRESHOLD) {
      this.pinnedLanguage = bestCode;
      logger.info(
        `[WhisperServer] pinned language '${bestCode}' (p=${bestProb.toFixed(2)}) — skipping per-chunk detection`,
      );
    }
  }

  /** Spawn the binary and return the handle; the supervisor owns readiness,
   *  restart, and lifecycle. Throws if the binary/model isn't available. */
  private async spawnServer(): Promise<ChildProcess> {
    const binary = whisperBinaryPath('whisper-server', this.deps.binary);
    await fs.access(binary);
    // Fetch the live model on first use if it isn't already present (finalize
    // also uses it, but may not have run yet). No-op once cached.
    await ensureWhisperModel(this.model, this.deps.modelDir);
    // VAD lets whisper skip silence — a big saving across a meeting's pauses.
    // Best-effort (tiny file); the live draft still runs without it.
    await ensureVadModel(this.deps.modelDir);
    const model = whisperModelPath(this.model, this.deps.modelDir);
    const vad = vadModelPath(this.deps.modelDir);
    this.port = await freePort();

    const args = [
      '-m', model,
      '-t', String(this.threads),
      '-l', 'auto',
      '--host', this.host,
      '--port', String(this.port),
    ];
    if (await exists(vad)) args.push('--vad', '-vm', vad);

    return spawn(binary, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  }
}

interface ServerSegment {
  text?: string;
  t0?: number;
  t1?: number;
  start?: number;
  end?: number;
}

interface ServerResponse {
  text?: string;
  segments?: ServerSegment[];
  /** Per-language probabilities (verbose_json), keyed by ISO code (e.g. `en`). */
  language_probabilities?: Record<string, number>;
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Ask the OS for an unused localhost port. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => (port ? resolve(port) : reject(new Error('no free port'))));
    });
  });
}

/** Poll a URL until it responds (any HTTP status) or times out. */
async function waitForReady(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      await fetch(url);
      return;
    } catch {
      if (Date.now() > deadline) throw new Error('whisper-server did not become ready');
      await new Promise((r) => setTimeout(r, 300));
    }
  }
}
