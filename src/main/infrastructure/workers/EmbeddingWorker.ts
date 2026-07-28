/**
 * EmbeddingWorker - Generates text embeddings using Transformers.js in a worker thread
 *
 * Uses a worker thread to run @xenova/transformers, which:
 * 1. Avoids the 'self is not defined' issue (workers have `self`)
 * 2. Keeps the main Electron process responsive during inference
 * 3. Isolates heavy ML operations from the UI thread
 *
 * Note: This is the infrastructure-level ML implementation.
 * The adapter in adapters/out/integrations/Embedder.ts implements the IEmbedder port.
 * This worker service can be injected into that adapter when ML functionality is enabled.
 */

import { Worker } from 'worker_threads';
import path from 'node:path';
import { Context, Effect, Layer } from 'effect';
import { logger } from '../../shared/utils';
import type { MLModelDownloadProgressPayload, MLServiceStatus } from '@shared/types/mlStatus';

/**
 * Where run-state is reported. On the desktop this is the tracker that pushes
 * to renderer windows; headless there is nobody to tell, so it is dropped.
 */
export interface MLStatusSink {
  setServiceStatus: (
    status: MLServiceStatus,
    options?: { error?: string; model?: { name: string; dims: number } },
  ) => void;
  broadcastModelDownloadProgress: (payload: MLModelDownloadProgressPayload) => void;
}

export interface EmbeddingWorkerOptions {
  /** Model cache directory. Required outside Electron, which has no userData. */
  cacheDir?: string;
  /** Absolute path to the built `embedding.worker.cjs`. */
  workerPath?: string;
  statusSink?: MLStatusSink;
}

const NOOP_STATUS_SINK: MLStatusSink = {
  setServiceStatus: () => {},
  broadcastModelDownloadProgress: () => {},
};

/**
 * Electron supplies the userData path and the renderer status tracker. Both are
 * absent in the headless server, so they are resolved lazily and fall back
 * rather than failing at import time.
 */
async function desktopDefaults(): Promise<{ cacheDir: string | null; statusSink: MLStatusSink }> {
  try {
    const { app } = await import('electron');
    // Outside Electron the `electron` package resolves to a binary path string,
    // so probe for the real API rather than trusting the import to fail.
    if (typeof app?.getPath !== 'function') {
      return { cacheDir: null, statusSink: NOOP_STATUS_SINK };
    }
    const { getMLStatusTracker } = await import('./MLStatusTracker');
    return {
      cacheDir: path.join(app.getPath('userData'), 'ml-cache'),
      statusSink: getMLStatusTracker(),
    };
  } catch {
    return { cacheDir: null, statusSink: NOOP_STATUS_SINK };
  }
}

const EMBEDDING_DIMS = 384; // BGE-small-en-v1.5 dimensions

interface PendingRequest {
  resume: (effect: Effect.Effect<unknown, Error>) => void;
}

// Per-request timeouts for the FAST inference paths. If the worker stops
// responding to one of these, the caller must not hang forever (an orphaned
// pending request). Deliberately NOT applied to init/transcriber/transcribe —
// those can legitimately take minutes (model download / long audio).
const PING_TIMEOUT_MS = 10_000;
const EMBED_TIMEOUT_MS = 60_000;
const RERANK_TIMEOUT_MS = 60_000;

interface WorkerResponse {
  id?: string;
  type?: string;
  success?: boolean;
  data?: unknown;
  error?: string;
}

export class EmbeddingWorker {
  constructor(private readonly options: EmbeddingWorkerOptions = {}) {}

  static readonly Service = Context.GenericTag<EmbeddingWorker>('stone/EmbeddingWorker');

  static layer(worker: EmbeddingWorker): Layer.Layer<EmbeddingWorker> {
    return Layer.scoped(
      EmbeddingWorker.Service,
      Effect.acquireRelease(Effect.succeed(worker), () =>
        Effect.tryPromise({
          try: () => worker.shutdown(),
          catch: (error) => (error instanceof Error ? error : new Error(String(error))),
        }).pipe(
          Effect.catchAll((error) =>
            Effect.sync(() => logger.error('[Embedder] finalizer failed:', error)),
          ),
        ),
      ),
    );
  }

  private worker: Worker | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private requestId = 0;
  private initialized = false;
  private initializing: Promise<void> | null = null;
  private workerReady = false;
  // Reranker is lazy — load on first rerank() call so users who never trigger
  // the AI surface don't pay the model memory cost.
  private rerankerReady = false;
  private rerankerInitializing: Promise<void> | null = null;
  // Transcriber (Whisper) is lazy for the same reason — first transcribe()
  // call triggers the ~80MB model download/load.
  private transcriberReady = false;
  private transcriberInitializing: Promise<void> | null = null;

  /**
   * Get the worker script path (handles both dev and packaged app)
   */
  private getWorkerPath(): string {
    if (this.options.workerPath) return this.options.workerPath;
    // worker_threads.Worker() cannot load entry files from inside app.asar.
    // electron-builder unpacks the worker bundle (asarUnpack rule), but
    // __dirname still points into the asar — translate to the unpacked
    // sibling so Node can read the file off real disk.
    const sep = path.sep;
    return path
      .join(__dirname, 'workers', 'embedding.worker.cjs')
      .replace(`${sep}app.asar${sep}`, `${sep}app.asar.unpacked${sep}`);
  }

  /**
   * Initialize the embedding service by spawning the worker
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.initializing) {
      await this.initializing;
      return;
    }

    this.initializing = this.doInitialize();
    await this.initializing;
  }

  private async doInitialize(): Promise<void> {
    const defaults = await desktopDefaults();
    const mlStatus = this.options.statusSink ?? defaults.statusSink;

    try {
      mlStatus.setServiceStatus('initializing');
      logger.info('[Embedder] Starting worker thread...');

      // Spawn worker
      const workerPath = this.getWorkerPath();
      logger.info(`[Embedder] Worker path: ${workerPath}`);

      // Pass a user-writable cache dir. Default ${install}/.cache lives inside
      // app.asar in packaged builds and fails to mkdir, forcing a model
      // re-download on every cold start.
      const cacheDir = this.options.cacheDir ?? defaults.cacheDir;
      if (!cacheDir) {
        throw new Error('EmbeddingWorker requires a cacheDir outside Electron.');
      }

      this.worker = new Worker(workerPath, { workerData: { cacheDir } });

      // Wait for worker to be ready
      await Effect.runPromise(
        Effect.async<void, Error>((resume) => {
          this.worker!.on('message', (msg: WorkerResponse) => {
            if (msg.type === 'ready') {
              this.workerReady = true;
              resume(Effect.void);
            }
          });

          this.worker!.on('error', (error) => resume(Effect.fail(error)));
        }).pipe(
          Effect.timeoutFail({
            duration: 30_000,
            onTimeout: () => new Error('Worker initialization timeout'),
          }),
        ),
      );

      // Set up message handler for responses
      this.worker.on('message', (msg: WorkerResponse) => {
        if (msg.type === 'ready') return; // Already handled

        // Unsolicited model-download progress (no request id) — broadcast to
        // renderers so onboarding/status UIs can show a real progress bar.
        if (msg.type === 'downloadProgress') {
          mlStatus.broadcastModelDownloadProgress(msg as unknown as MLModelDownloadProgressPayload);
          return;
        }

        const { id, success, data, error } = msg;
        if (!id) return;

        const pending = this.pendingRequests.get(id);
        if (pending) {
          this.pendingRequests.delete(id);
          if (success) {
            pending.resume(Effect.succeed(data));
          } else {
            pending.resume(Effect.fail(new Error(error || 'Unknown worker error')));
          }
        }
      });

      this.worker.on('error', (err) => {
        logger.error('[Embedder] Worker error:', err);
        // Reject all pending requests
        for (const [id, pending] of this.pendingRequests) {
          pending.resume(Effect.fail(err));
          this.pendingRequests.delete(id);
        }
      });

      this.worker.on('exit', (code) => {
        if (code !== 0) {
          logger.error(`[Embedder] Worker exited with code ${code}`);
        }
        this.worker = null;
        this.initialized = false;
        this.workerReady = false;
      });

      // Initialize the model in the worker
      logger.info('[Embedder] Initializing model in worker...');
      const result = await this.sendMessage<{ model: string; dims: number }>('init', {});
      logger.info(`[Embedder] Model ready: ${result.model} (${result.dims} dims)`);

      mlStatus.setServiceStatus('ready', {
        model: { name: result.model, dims: result.dims },
      });

      this.initialized = true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      mlStatus.setServiceStatus('error', { error: errorMessage });
      logger.error('[Embedder] Failed to initialize:', error);
      this.initialized = false;
      throw error;
    } finally {
      this.initializing = null;
    }
  }

  /**
   * Send a message to the worker and wait for response
   */
  private sendMessage<T>(
    type: string,
    payload: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<T> {
    return Effect.runPromise(this.sendMessageEffect<T>(type, payload, timeoutMs));
  }

  private sendMessageEffect<T>(
    type: string,
    payload: Record<string, unknown>,
    timeoutMs?: number,
  ): Effect.Effect<T, Error> {
    const request = Effect.async<T, Error>((resume) => {
      if (!this.worker || !this.workerReady) {
        resume(Effect.fail(new Error('Worker not ready')));
        return Effect.void;
      }

      const id = String(++this.requestId);
      const pending: PendingRequest = { resume: resume as PendingRequest['resume'] };
      this.pendingRequests.set(id, pending);

      this.worker.postMessage({ type, id, ...payload });
      return Effect.sync(() => {
        if (this.pendingRequests.get(id) === pending) this.pendingRequests.delete(id);
      });
    });
    return timeoutMs && timeoutMs > 0
      ? request.pipe(
          Effect.timeoutFail({
            duration: timeoutMs,
            onTimeout: () =>
              new Error(`Worker request '${type}' timed out after ${timeoutMs}ms`),
          }),
        )
      : request;
  }

  /**
   * Shutdown the embedding service
   */
  async shutdown(): Promise<void> {
    logger.info('[Embedder] Shutting down...');

    if (this.worker && this.workerReady) {
      try {
        await this.sendMessage('shutdown', {});
      } catch {
        // Ignore errors during shutdown
      }
      await this.worker.terminate();
    }

    this.worker = null;
    this.initialized = false;
    this.workerReady = false;
    this.rerankerReady = false;
    this.transcriberReady = false;
    this.pendingRequests.clear();

    const statusSink = this.options.statusSink ?? (await desktopDefaults()).statusSink;
    statusSink.setServiceStatus('idle');
  }

  /**
   * Ping the embedding service to check status
   */
  async ping(): Promise<{ model: string; dims: number }> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.sendMessage<{ model: string; dims: number }>('ping', {}, PING_TIMEOUT_MS);
  }

  /**
   * Generate embedding for a single text
   */
  async getEmbedding(text: string): Promise<number[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.sendMessage<number[]>('embed', { text }, EMBED_TIMEOUT_MS);
  }

  /**
   * Generate embeddings for multiple texts (batch processing)
   */
  async batchEmbed(texts: string[]): Promise<number[][]> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.sendMessage<number[][]>('batchEmbed', { texts }, EMBED_TIMEOUT_MS);
  }

  /**
   * Lazy-load the reranker model. Called automatically by rerank() the
   * first time; can be called explicitly to warm the model.
   */
  async initializeReranker(): Promise<void> {
    if (this.rerankerReady) return;
    if (this.rerankerInitializing) {
      await this.rerankerInitializing;
      return;
    }

    this.rerankerInitializing = (async () => {
      if (!this.initialized) {
        await this.initialize();
      }
      logger.info('[Embedder] Loading reranker model…');
      const result = await this.sendMessage<{ model: string }>('initReranker', {});
      logger.info(`[Embedder] Reranker ready: ${result.model}`);
      this.rerankerReady = true;
    })();

    try {
      await this.rerankerInitializing;
    } finally {
      this.rerankerInitializing = null;
    }
  }

  /**
   * Score (query, text) pairs with the cross-encoder. Returns raw scores in
   * the order of `texts`; caller sorts/truncates. Lazy-initializes the
   * reranker model on first call.
   */
  async rerank(query: string, texts: string[]): Promise<number[]> {
    if (!this.rerankerReady) {
      await this.initializeReranker();
    }
    return this.sendMessage<number[]>('rerank', { query, texts }, RERANK_TIMEOUT_MS);
  }

  /** Whether the reranker model has been loaded. */
  isRerankerReady(): boolean {
    return this.rerankerReady && this.worker !== null;
  }

  /**
   * Lazy-load the Whisper transcriber. Same pattern as initializeReranker.
   */
  async initializeTranscriber(): Promise<void> {
    if (this.transcriberReady) return;
    if (this.transcriberInitializing) {
      await this.transcriberInitializing;
      return;
    }

    this.transcriberInitializing = (async () => {
      if (!this.initialized) {
        await this.initialize();
      }
      logger.info('[Embedder] Loading transcriber model…');
      const result = await this.sendMessage<{ model: string }>('initTranscriber', {});
      logger.info(`[Embedder] Transcriber ready: ${result.model}`);
      this.transcriberReady = true;
    })();

    try {
      await this.transcriberInitializing;
    } finally {
      this.transcriberInitializing = null;
    }
  }

  /**
   * Transcribe a 16kHz mono 16-bit WAV file via Whisper. Lazy-initializes
   * the transcriber model on first call. Caller owns the file lifecycle.
   */
  async transcribe(audioPath: string): Promise<{
    text: string;
    segments: Array<{ text: string; startMs: number; endMs: number }>;
    durationMs: number;
  }> {
    if (!this.transcriberReady) {
      await this.initializeTranscriber();
    }
    return this.sendMessage('transcribe', { audioPath });
  }

  /** Whether the transcriber model has been loaded. */
  isTranscriberReady(): boolean {
    return this.transcriberReady && this.worker !== null;
  }

  /**
   * Check if the service is ready
   */
  isReady(): boolean {
    return this.initialized && this.workerReady && this.worker !== null;
  }

  /**
   * Get embedding dimensions
   */
  getDimensions(): number {
    return EMBEDDING_DIMS;
  }
}

// ==========================================================================
// Singleton for backward compatibility (IPC handlers)
// ==========================================================================

let instance: EmbeddingWorker | null = null;

/**
 * Get or create embedding worker service instance
 */
export function getEmbeddingWorker(): EmbeddingWorker {
  instance ??= new EmbeddingWorker();
  return instance;
}

/**
 * Create EmbeddingWorker instance (for DI container)
 */
export function createEmbeddingWorker(options: EmbeddingWorkerOptions = {}): EmbeddingWorker {
  return new EmbeddingWorker(options);
}
