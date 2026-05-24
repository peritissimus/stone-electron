/**
 * Embedding Service Adapter
 *
 * Implements IEmbedder using a worker-thread-hosted Transformers.js pipeline.
 * Persistence is no longer a concern of this adapter — chunk vectors live in
 * IIndexRepository, queried directly by the use cases that need them.
 */

import type { IEmbedder } from '../../../domain';
import { logger } from '../../../shared/utils';

export interface EmbeddingWorkerClient {
  initialize(): Promise<void>;
  isReady(): boolean;
  getEmbedding(text: string): Promise<number[]>;
  batchEmbed(texts: string[]): Promise<number[][]>;
}

export interface EmbedderDeps {
  workerService: EmbeddingWorkerClient;
}

export class Embedder implements IEmbedder {
  constructor(private readonly deps: EmbedderDeps) {}

  async initialize(): Promise<void> {
    logger.info('[Embedder] Initializing with worker service...');
    await this.deps.workerService.initialize();
    logger.info('[Embedder] Worker service initialized');
  }

  isReady(): boolean {
    return this.deps.workerService.isReady();
  }

  async generateEmbedding(text: string): Promise<Float32Array> {
    const embedding = await this.deps.workerService.getEmbedding(text);
    return new Float32Array(embedding);
  }

  async generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
    const embeddings = await this.deps.workerService.batchEmbed(texts);
    return embeddings.map((e) => new Float32Array(e));
  }
}
