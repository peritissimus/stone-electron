/**
 * EmbeddingService - Generates text embeddings using Transformers.js
 *
 * Uses @xenova/transformers (ONNX Runtime) for pure JavaScript embeddings.
 * No Python dependency required - works in Electron and standalone mode.
 */

import { logger } from '../utils/logger';

// Dynamic import for transformers.js to avoid issues with module loading
type Pipeline = Awaited<ReturnType<typeof import('@xenova/transformers')['pipeline']>>;

const EMBEDDING_DIMS = 384; // BGE-small-en-v1.5 dimensions
const MODEL_NAME = 'Xenova/bge-small-en-v1.5';

export class EmbeddingService {
  private pipeline: Pipeline | null = null;
  private initialized = false;
  private initializing: Promise<void> | null = null;

  /**
   * Initialize the embedding service by loading the model
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // If already initializing, wait for it
    if (this.initializing) {
      await this.initializing;
      return;
    }

    this.initializing = this.doInitialize();
    await this.initializing;
  }

  private async doInitialize(): Promise<void> {
    try {
      logger.info('[EmbeddingService] Loading embedding model...');
      logger.info(`[EmbeddingService] Model: ${MODEL_NAME}`);

      // Dynamic import to handle module loading
      const { pipeline, env } = await import('@xenova/transformers');

      // Configure transformers.js for Node.js environment
      // Disable browser-specific features
      env.allowLocalModels = true;
      env.useBrowserCache = false;

      // Create feature extraction pipeline
      // The model will be downloaded on first use (~25MB for quantized ONNX)
      this.pipeline = await pipeline('feature-extraction', MODEL_NAME, {
        quantized: true, // Use quantized model for smaller size and faster inference
      });

      this.initialized = true;
      logger.info(`[EmbeddingService] Model ready: ${MODEL_NAME} (${EMBEDDING_DIMS} dims)`);
    } catch (error) {
      logger.error('[EmbeddingService] Failed to initialize:', error);
      this.initialized = false;
      throw error;
    } finally {
      this.initializing = null;
    }
  }

  /**
   * Shutdown the embedding service
   */
  async shutdown(): Promise<void> {
    logger.info('[EmbeddingService] Shutting down...');
    this.pipeline = null;
    this.initialized = false;
  }

  /**
   * Ping the embedding service to check status
   */
  async ping(): Promise<{ model: string; dims: number }> {
    if (!this.initialized) {
      await this.initialize();
    }
    return {
      model: MODEL_NAME,
      dims: EMBEDDING_DIMS,
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

    if (!this.pipeline) {
      throw new Error('Embedding pipeline not initialized');
    }

    try {
      // Generate embedding with mean pooling and normalization
      const output = await this.pipeline(text, {
        pooling: 'mean',
        normalize: true,
      } as any);

      // Extract the embedding array from the tensor
      // The output is a Tensor with a data property containing Float32Array
      const tensor = output as { data: Float32Array };
      const embedding = Array.from(tensor.data);

      return embedding;
    } catch (error) {
      logger.error('[EmbeddingService] Failed to generate embedding:', error);
      throw error;
    }
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

    if (!this.pipeline) {
      throw new Error('Embedding pipeline not initialized');
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

    try {
      // Process texts in batch
      const outputs = await Promise.all(
        nonEmptyTexts.map((text) =>
          this.pipeline!(text, {
            pooling: 'mean',
            normalize: true,
          } as any)
        )
      );

      // Reconstruct full array with zero vectors for empty texts
      const result: number[][] = texts.map(() => new Array(EMBEDDING_DIMS).fill(0));

      outputs.forEach((output, i) => {
        const originalIndex = nonEmptyIndices[i];
        // The output is a Tensor with a data property containing Float32Array
        const tensor = output as { data: Float32Array };
        result[originalIndex] = Array.from(tensor.data);
      });

      return result;
    } catch (error) {
      logger.error('[EmbeddingService] Failed to batch embed:', error);
      throw error;
    }
  }

  /**
   * Check if the service is ready
   */
  isReady(): boolean {
    return this.initialized && this.pipeline !== null;
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
