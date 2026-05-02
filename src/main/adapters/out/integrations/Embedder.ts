/**
 * Embedding Service Adapter
 *
 * Implements IEmbedder port using EmbeddingWorker
 * for real ML embedding generation via Transformers.js.
 */

import type {
  IEmbedder,
  ClassificationResult,
  SimilarNote,
  INoteRepository,
  IMarkdownProcessor,
} from '../../../domain';
import { logger } from '../../../shared/utils';

export interface EmbeddingWorkerClient {
  initialize(): Promise<void>;
  isReady(): boolean;
  getEmbedding(text: string): Promise<number[]>;
  batchEmbed(texts: string[]): Promise<number[][]>;
}

export interface EmbedderDeps {
  noteRepository: INoteRepository;
  markdownProcessor: IMarkdownProcessor;
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

  async classifyNote(_noteId: string): Promise<ClassificationResult[]> {
    // Classification is handled by TopicUseCases, not here
    return [];
  }

  async findSimilarNotes(_noteId: string, _limit = 5): Promise<SimilarNote[]> {
    // Similar notes search is handled by TopicUseCases, not here
    return [];
  }

  async semanticSearch(_query: string, _limit = 10): Promise<SimilarNote[]> {
    // Semantic search is handled by TopicUseCases, not here
    return [];
  }

  async storeEmbedding(noteId: string, embedding: Float32Array): Promise<void> {
    const embeddingArray = Array.from(embedding);
    await this.deps.noteRepository.updateEmbedding(noteId, embeddingArray);
  }

  async getEmbedding(noteId: string): Promise<Float32Array | null> {
    const embedding = await this.deps.noteRepository.getEmbedding(noteId);
    if (!embedding) {
      return null;
    }
    return new Float32Array(embedding);
  }

  async deleteEmbedding(noteId: string): Promise<void> {
    await this.deps.noteRepository.updateEmbedding(noteId, null);
  }

  async recomputeCentroids(): Promise<void> {
    // Centroid computation is handled by TopicUseCases
  }

  async getStatus(): Promise<{
    ready: boolean;
    totalNotes: number;
    embeddedNotes: number;
    pendingNotes: number;
  }> {
    const totalNotes = await this.deps.noteRepository.count({ isDeleted: false });
    const ready = this.deps.workerService.isReady();

    // Count notes with embeddings
    // This is a simplified count - could be optimized with a dedicated query
    let embeddedNotes = 0;
    if (ready) {
      const notes = await this.deps.noteRepository.findAll({ isDeleted: false });
      for (const note of notes) {
        const embedding = await this.deps.noteRepository.getEmbedding(note.id);
        if (embedding) embeddedNotes++;
      }
    }

    return {
      ready,
      totalNotes,
      embeddedNotes,
      pendingNotes: totalNotes - embeddedNotes,
    };
  }
}
