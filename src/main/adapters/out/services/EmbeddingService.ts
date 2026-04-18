/**
 * Embedding Service Adapter
 *
 * Implements IEmbeddingService port using EmbeddingWorkerService
 * for real ML embedding generation via Transformers.js.
 */

import type {
  IEmbeddingService,
  ClassificationResult,
  SimilarNote,
  INoteRepository,
  IMarkdownProcessor,
} from '../../../domain';
import { EmbeddingWorkerService, createEmbeddingWorkerService } from './EmbeddingWorkerService';
import { logger } from '../../../shared/utils';

export interface EmbeddingServiceDeps {
  noteRepository: INoteRepository;
  markdownProcessor: IMarkdownProcessor;
}

export class EmbeddingService implements IEmbeddingService {
  private workerService: EmbeddingWorkerService;

  constructor(private readonly deps: EmbeddingServiceDeps) {
    this.workerService = createEmbeddingWorkerService();
  }

  async initialize(): Promise<void> {
    logger.info('[EmbeddingService] Initializing with worker service...');
    await this.workerService.initialize();
    logger.info('[EmbeddingService] Worker service initialized');
  }

  isReady(): boolean {
    return this.workerService.isReady();
  }

  async generateEmbedding(text: string): Promise<Float32Array> {
    const embedding = await this.workerService.getEmbedding(text);
    return new Float32Array(embedding);
  }

  async generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
    const embeddings = await this.workerService.batchEmbed(texts);
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
    const ready = this.workerService.isReady();

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
