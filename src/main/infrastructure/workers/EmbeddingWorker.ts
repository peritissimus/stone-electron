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
import { logger } from '../../shared/utils';
import { getMLStatusTracker } from './MLStatusTracker';

const EMBEDDING_DIMS = 384; // BGE-small-en-v1.5 dimensions
const MODEL_NAME = 'Xenova/bge-small-en-v1.5';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

interface WorkerResponse {
  id?: string;
  type?: string;
  success?: boolean;
  data?: unknown;
  error?: string;
}

export class EmbeddingWorker {
  private worker: Worker | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private requestId = 0;
  private initialized = false;
  private initializing: Promise<void> | null = null;
  private workerReady = false;

  /**
   * Get the worker script path (handles both dev and packaged app)
   */
  private getWorkerPath(): string {
    // Main process is bundled to dist/main/index.cjs
    // Worker is at dist/main/workers/embedding.worker.cjs
    // So from __dirname (dist/main/), worker is in ./workers/
    return path.join(__dirname, 'workers', 'embedding.worker.cjs');
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
    const mlStatus = getMLStatusTracker();

    try {
      mlStatus.setServiceStatus('initializing');
      logger.info('[Embedder] Starting worker thread...');

      // Spawn worker
      const workerPath = this.getWorkerPath();
      logger.info(`[Embedder] Worker path: ${workerPath}`);

      this.worker = new Worker(workerPath);

      // Wait for worker to be ready
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Worker initialization timeout'));
        }, 30000);

        this.worker!.on('message', (msg: WorkerResponse) => {
          if (msg.type === 'ready') {
            clearTimeout(timeout);
            this.workerReady = true;
            resolve();
          }
        });

        this.worker!.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      // Set up message handler for responses
      this.worker.on('message', (msg: WorkerResponse) => {
        if (msg.type === 'ready') return; // Already handled

        const { id, success, data, error } = msg;
        if (!id) return;

        const pending = this.pendingRequests.get(id);
        if (pending) {
          this.pendingRequests.delete(id);
          if (success) {
            pending.resolve(data);
          } else {
            pending.reject(new Error(error || 'Unknown worker error'));
          }
        }
      });

      this.worker.on('error', (err) => {
        logger.error('[Embedder] Worker error:', err);
        // Reject all pending requests
        for (const [id, pending] of this.pendingRequests) {
          pending.reject(err);
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
  private sendMessage<T>(type: string, payload: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.worker || !this.workerReady) {
        reject(new Error('Worker not ready'));
        return;
      }

      const id = String(++this.requestId);
      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      this.worker.postMessage({ type, id, ...payload });
    });
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
    this.pendingRequests.clear();

    getMLStatusTracker().setServiceStatus('idle');
  }

  /**
   * Ping the embedding service to check status
   */
  async ping(): Promise<{ model: string; dims: number }> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.sendMessage<{ model: string; dims: number }>('ping', {});
  }

  /**
   * Generate embedding for a single text
   */
  async getEmbedding(text: string): Promise<number[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.sendMessage<number[]>('embed', { text });
  }

  /**
   * Generate embeddings for multiple texts (batch processing)
   */
  async batchEmbed(texts: string[]): Promise<number[][]> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.sendMessage<number[][]>('batchEmbed', { texts });
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
export function createEmbeddingWorker(): EmbeddingWorker {
  return new EmbeddingWorker();
}
