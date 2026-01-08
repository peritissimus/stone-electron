/**
 * Embedding Service Adapter
 *
 * Implements IEmbeddingService port wrapping the ML embedding service.
 */

import type {
  IEmbeddingService,
  ClassificationResult,
  SimilarNote,
} from '../../../domain/ports/out/IEmbeddingService';
import type { INoteRepository } from '../../../domain/ports/out/INoteRepository';
import type { IMarkdownProcessor } from '../../../domain/ports/out/IMarkdownProcessor';
import { getEmbeddingService } from '@main/services/EmbeddingService';

export interface EmbeddingServiceDeps {
  noteRepository: INoteRepository;
  markdownProcessor: IMarkdownProcessor;
}

export class EmbeddingServiceAdapter implements IEmbeddingService {
  private readonly rawService = getEmbeddingService();
  private ready = false;

  constructor(private readonly deps: EmbeddingServiceDeps) {}

  async initialize(): Promise<void> {
    await this.rawService.initialize();
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready && this.rawService.isReady();
  }

  async generateEmbedding(text: string): Promise<Float32Array> {
    // Use getEmbedding from service (it generates if not cached)
    const result = await this.rawService.getEmbedding(text);
    if (!result) return new Float32Array(0);
    // Convert number[] to Float32Array if needed
    return result instanceof Float32Array ? result : new Float32Array(result);
  }

  async generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
    const results: Float32Array[] = [];
    for (const text of texts) {
      const embedding = await this.generateEmbedding(text);
      results.push(embedding);
    }
    return results;
  }

  async classifyNote(noteId: string): Promise<ClassificationResult[]> {
    // Classification requires topic repository - return empty for now
    return [];
  }

  async findSimilarNotes(noteId: string, limit = 5): Promise<SimilarNote[]> {
    const embedding = await this.deps.noteRepository.getEmbedding(noteId);
    if (!embedding) {
      return [];
    }

    const similar = await this.deps.noteRepository.findBySimilarity(embedding, limit + 1);

    return similar
      .filter((s) => s.noteId !== noteId)
      .slice(0, limit)
      .map((s) => ({
        noteId: s.noteId,
        title: s.title,
        similarity: s.distance,
        distance: 1 - s.distance,
      }));
  }

  async semanticSearch(query: string, limit = 10): Promise<SimilarNote[]> {
    const embedding = await this.generateEmbedding(query);
    if (embedding.length === 0) {
      return [];
    }

    const embeddingArray = Array.from(embedding);
    const similar = await this.deps.noteRepository.findBySimilarity(embeddingArray, limit);

    return similar.map((s) => ({
      noteId: s.noteId,
      title: s.title,
      similarity: s.distance,
      distance: 1 - s.distance,
    }));
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
    // Topic centroid computation - to be implemented with topic repository
  }

  async getStatus(): Promise<{
    ready: boolean;
    totalNotes: number;
    embeddedNotes: number;
    pendingNotes: number;
  }> {
    const totalNotes = await this.deps.noteRepository.count({ isDeleted: false });

    return {
      ready: this.isReady(),
      totalNotes,
      embeddedNotes: 0,
      pendingNotes: totalNotes,
    };
  }
}
