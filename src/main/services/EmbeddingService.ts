/**
 * EmbeddingService - Manages Python subprocess for generating text embeddings
 *
 * Uses uv to run the Python embedding server in an isolated environment.
 * Communicates via JSON lines over stdin/stdout.
 */

import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';
import { logger } from '../utils/logger';

/**
 * Get Electron app if available
 */
function getElectronApp(): typeof import('electron').app | null {
  try {
    const electron = require('electron');
    if (electron.app && typeof electron.app.isPackaged === 'boolean') {
      return electron.app;
    }
  } catch {
    // Not in Electron environment
  }
  return null;
}

/**
 * Get the scripts path based on environment
 */
function getScriptsPath(): string {
  const electronApp = getElectronApp();

  if (electronApp) {
    // Electron mode
    if (electronApp.isPackaged) {
      return path.join(process.resourcesPath!, 'app.asar.unpacked', 'scripts');
    }
    return path.join(electronApp.getAppPath(), 'scripts');
  }

  // Standalone mode - scripts are relative to project root
  return path.join(process.cwd(), 'scripts');
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

interface EmbedResponse {
  ok: boolean;
  id?: number;
  embedding?: number[];
  embeddings?: number[][];
  model?: string;
  dims?: number;
  error?: string;
}

const EMBEDDING_DIMS = 384; // BGE-small-en-v1.5 dimensions
const REQUEST_TIMEOUT_MS = 60000; // 60 seconds for model loading/inference
const WARMUP_TIMEOUT_MS = 120000; // 2 minutes for initial model download

export class EmbeddingService {
  private process: ChildProcess | null = null;
  private rl: readline.Interface | null = null;
  private readonly pending: Map<number, PendingRequest> = new Map();
  private requestId = 0;
  private initialized = false;
  private initializing = false;
  private readonly scriptsPath: string;

  constructor() {
    this.scriptsPath = getScriptsPath();
  }

  /**
   * Initialize the embedding service by spawning the Python subprocess
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initializing) {
      // Wait for initialization to complete
      while (this.initializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    this.initializing = true;

    try {
      logger.info('[EmbeddingService] Starting Python embedding server...');
      logger.info(`[EmbeddingService] Scripts path: ${this.scriptsPath}`);

      // Spawn Python using uv for isolated environment
      this.process = spawn('uv', ['run', 'python', 'embedding_server.py'], {
        cwd: this.scriptsPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
        },
      });

      // Handle stderr for debugging
      this.process.stderr?.on('data', (data: Buffer) => {
        const message = data.toString().trim();
        if (message) {
          // Filter out model download progress which is noisy
          if (message.includes('Downloading') || message.includes('%|')) {
            logger.debug(`[EmbeddingService] ${message}`);
          } else {
            logger.info(`[EmbeddingService] ${message}`);
          }
        }
      });

      // Handle process exit
      this.process.on('exit', (code, signal) => {
        logger.warn(`[EmbeddingService] Python process exited (code=${code}, signal=${signal})`);
        this.cleanup();
      });

      this.process.on('error', (error) => {
        logger.error('[EmbeddingService] Failed to spawn Python process:', error);
        this.cleanup();
      });

      // Set up response handler
      if (this.process.stdout) {
        this.rl = readline.createInterface({ input: this.process.stdout });
        this.rl.on('line', (line) => this.handleResponse(line));
      }

      // Warm up the model with a ping (this may trigger model download)
      logger.info('[EmbeddingService] Warming up embedding model...');
      const pingResult = await this.ping(WARMUP_TIMEOUT_MS);
      logger.info(`[EmbeddingService] Model ready: ${pingResult.model} (${pingResult.dims} dims)`);

      this.initialized = true;
    } catch (error) {
      logger.error('[EmbeddingService] Failed to initialize:', error);
      this.cleanup();
      throw error;
    } finally {
      this.initializing = false;
    }
  }

  /**
   * Cleanup subprocess and resources
   */
  private cleanup(): void {
    this.initialized = false;

    // Reject all pending requests
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Embedding service terminated'));
      this.pending.delete(id);
    }

    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }

    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  /**
   * Shutdown the embedding service
   */
  async shutdown(): Promise<void> {
    logger.info('[EmbeddingService] Shutting down...');
    this.cleanup();
  }

  /**
   * Ping the embedding server to check status
   */
  async ping(timeout = REQUEST_TIMEOUT_MS): Promise<{ model: string; dims: number }> {
    const response = await this.send({ cmd: 'ping' }, timeout) as EmbedResponse;
    return {
      model: response.model || 'unknown',
      dims: response.dims || EMBEDDING_DIMS,
    };
  }

  /**
   * Generate embedding for a single text
   */
  async getEmbedding(text: string): Promise<number[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!text || text.trim().length === 0) {
      // Return zero vector for empty text
      return new Array(EMBEDDING_DIMS).fill(0);
    }

    const response = await this.send({ cmd: 'embed', text }) as EmbedResponse;

    if (!response.embedding) {
      throw new Error('No embedding in response');
    }

    return response.embedding;
  }

  /**
   * Generate embeddings for multiple texts (batch processing)
   */
  async batchEmbed(texts: string[]): Promise<number[][]> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (texts.length === 0) {
      return [];
    }

    // Filter out empty texts, keeping track of indices
    const nonEmptyIndices: number[] = [];
    const nonEmptyTexts: string[] = [];

    texts.forEach((text, i) => {
      if (text && text.trim().length > 0) {
        nonEmptyIndices.push(i);
        nonEmptyTexts.push(text);
      }
    });

    if (nonEmptyTexts.length === 0) {
      // All texts were empty, return zero vectors
      return texts.map(() => new Array(EMBEDDING_DIMS).fill(0));
    }

    const response = await this.send({ cmd: 'batch', texts: nonEmptyTexts }) as EmbedResponse;

    if (!response.embeddings) {
      throw new Error('No embeddings in response');
    }

    // Reconstruct full array with zero vectors for empty texts
    const result: number[][] = texts.map(() => new Array(EMBEDDING_DIMS).fill(0));
    nonEmptyIndices.forEach((originalIndex, i) => {
      result[originalIndex] = response.embeddings![i];
    });

    return result;
  }

  /**
   * Check if the service is ready
   */
  isReady(): boolean {
    return this.initialized && this.process !== null;
  }

  /**
   * Get embedding dimensions
   */
  getDimensions(): number {
    return EMBEDDING_DIMS;
  }

  /**
   * Send a request to the Python process
   */
  private send(data: Record<string, unknown>, timeout = REQUEST_TIMEOUT_MS): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.process || !this.process.stdin) {
        reject(new Error('Embedding service not initialized'));
        return;
      }

      const id = ++this.requestId;

      const timeoutHandle = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Embedding request timed out after ${timeout}ms`));
      }, timeout);

      this.pending.set(id, { resolve, reject, timeout: timeoutHandle });

      try {
        this.process.stdin.write(JSON.stringify({ ...data, id }) + '\n');
      } catch (error) {
        clearTimeout(timeoutHandle);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  /**
   * Handle response from Python process
   */
  private handleResponse(line: string): void {
    try {
      const data = JSON.parse(line) as EmbedResponse;
      const responseId = data.id;
      if (responseId === undefined) {
        return;
      }

      const pending = this.pending.get(responseId);

      if (pending) {
        clearTimeout(pending.timeout);
        this.pending.delete(responseId);

        if (data.ok) {
          pending.resolve(data);
        } else {
          pending.reject(new Error(data.error || 'Unknown error'));
        }
      }
    } catch (error) {
      logger.error('[EmbeddingService] Failed to parse response:', error, line);
    }
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
