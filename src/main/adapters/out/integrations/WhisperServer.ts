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
import type { ILiveTranscriber, LiveChunkResult, TranscriptSegment } from '../../../domain';
import { collapseRepeatedSegments } from '../../../domain';
import { logger } from '../../../shared/utils';
import {
  vadModelPath,
  whisperBinaryPath,
  whisperModelPath,
  WHISPER_MODEL,
} from './whisperPaths';

/** Per-chunk transcription timeout. A live chunk is only a few seconds of
 *  audio; if the resident server hasn't responded within this, it's wedged and
 *  should be restarted rather than left to block on undici's 5-minute default. */
const CHUNK_TIMEOUT_MS = 20_000;

export interface WhisperServerDeps {
  model?: string;
  modelDir?: string;
  binary?: string;
  /** Host to bind; localhost only by design. */
  host?: string;
}

export class WhisperServer implements ILiveTranscriber {
  private readonly model: string;
  private proc: ChildProcess | null = null;
  private port = 0;
  private starting: Promise<void> | null = null;

  constructor(private readonly deps: WhisperServerDeps = {}) {
    this.model = deps.model ?? process.env.STONE_WHISPER_MODEL ?? WHISPER_MODEL;
  }

  isReady(): boolean {
    return this.proc !== null && this.port !== 0;
  }

  async start(): Promise<void> {
    if (this.isReady()) return;
    this.starting ??= this.spawnServer();
    try {
      await this.starting;
    } finally {
      this.starting = null;
    }
  }

  async stop(): Promise<void> {
    const proc = this.proc;
    this.proc = null;
    this.port = 0;
    if (proc && !proc.killed) {
      proc.kill('SIGTERM');
    }
  }

  async transcribeChunk(wav: Uint8Array): Promise<LiveChunkResult> {
    if (!this.isReady()) await this.start();
    const host = this.deps.host ?? '127.0.0.1';

    const form = new FormData();
    form.append('file', new Blob([wav as BlobPart], { type: 'audio/wav' }), 'chunk.wav');
    form.append('response_format', 'json');
    form.append('language', 'auto');
    form.append('temperature', '0');

    let res: Response;
    try {
      res = await fetch(`http://${host}:${this.port}/inference`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(CHUNK_TIMEOUT_MS),
      });
    } catch (err) {
      // The server hung or died: tear it down so the next chunk respawns a
      // fresh process instead of piling onto a wedged one (each stuck fetch
      // would otherwise block for undici's 5-minute default). Live draft is
      // best-effort — the clean transcript still comes from batch finalize.
      void this.stop();
      throw err;
    }
    if (!res.ok) throw new Error(`whisper-server inference failed (${res.status})`);
    const json = (await res.json()) as { text?: string; segments?: ServerSegment[] };

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

  private async spawnServer(): Promise<void> {
    const binary = whisperBinaryPath('whisper-server', this.deps.binary);
    const model = whisperModelPath(this.model, this.deps.modelDir);
    const vad = vadModelPath(this.deps.modelDir);
    await fs.access(binary);
    await fs.access(model);
    const host = this.deps.host ?? '127.0.0.1';
    const port = await freePort();

    const args = ['-m', model, '-l', 'auto', '--host', host, '--port', String(port)];
    if (await exists(vad)) args.push('--vad', '-vm', vad);

    const proc = spawn(binary, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    proc.on('exit', (code) => {
      if (this.proc === proc) {
        this.proc = null;
        this.port = 0;
      }
      if (code) logger.warn(`[WhisperServer] exited with code ${code}`);
    });
    this.proc = proc;
    this.port = port;

    await waitForReady(`http://${host}:${port}/`, 30_000);
    logger.info(`[WhisperServer] ready on ${host}:${port} (model ${this.model})`);
  }
}

interface ServerSegment {
  text?: string;
  t0?: number;
  t1?: number;
  start?: number;
  end?: number;
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
