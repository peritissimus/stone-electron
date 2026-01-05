/**
 * EmbeddingService - Generates text embeddings using Transformers.js in a worker thread
 *
 * Uses a worker thread to run @xenova/transformers, which:
 * 1. Avoids the 'self is not defined' issue (workers have `self`)
 * 2. Keeps the main Electron process responsive during inference
 * 3. Isolates heavy ML operations from the UI thread
 */

import { Worker } from 'worker_threads';
import path from 'node:path';
import { logger } from '../utils/logger';
import { getMLStatusService } from './MLStatusService';

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

export class EmbeddingService {
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
    // In development, use the TypeScript source
    // In production, use the compiled JavaScript
    const isDev = process.env.NODE_ENV !== 'production';

    if (isDev) {
      // During development, we need to compile the worker on-the-fly
      // or use ts-node. For simplicity, we'll use the built version.
      return path.join(__dirname, 'workers', 'embedding.worker.cjs');
    }

    // In packaged app, use the bundled worker
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
    const mlStatus = getMLStatusService();

    try {
      mlStatus.setServiceStatus('initializing');
      logger.info('[EmbeddingService] Starting worker thread...');

      // Spawn worker
      const workerPath = this.getWorkerPath();
      logger.info(`[EmbeddingService] Worker path: ${workerPath}`);

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
        logger.error('[EmbeddingService] Worker error:', err);
        // Reject all pending requests
        for (const [id, pending] of this.pendingRequests) {
          pending.reject(err);
          this.pendingRequests.delete(id);
        }
      });

      this.worker.on('exit', (code) => {
        if (code !== 0) {
          logger.error(`[EmbeddingService] Worker exited with code ${code}`);
        }
        this.worker = null;
        this.initialized = false;
        this.workerReady = false;
      });

      // Initialize the model in the worker
      logger.info('[EmbeddingService] Initializing model in worker...');
      const result = await this.sendMessage<{ model: string; dims: number }>('init', {});
      logger.info(`[EmbeddingService] Model ready: ${result.model} (${result.dims} dims)`);

      mlStatus.setServiceStatus('ready', {
        model: { name: result.model, dims: result.dims },
      });

      this.initialized = true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      mlStatus.setServiceStatus('error', { error: errorMessage });
      logger.error('[EmbeddingService] Failed to initialize:', error);
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
    logger.info('[EmbeddingService] Shutting down...');

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

    getMLStatusService().setServiceStatus('idle');
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

let instance: EmbeddingService | null = null;

/**
 * Get or create embedding service instance
 */
export function getEmbeddingService(): EmbeddingService {
  instance ??= new EmbeddingService();
  return instance;
}

/**
 * Create EmbeddingService instance (for DI container)
 */
export function createEmbeddingService(): EmbeddingService {
  return new EmbeddingService();
}
