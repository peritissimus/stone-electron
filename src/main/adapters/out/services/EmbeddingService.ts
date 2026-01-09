/**
 * Embedding Service Adapter
 *
 * Stub implementation of IEmbeddingService port.
 * ML/embedding functionality can be added later.
 */

import type {
  IEmbeddingService,
  ClassificationResult,
  SimilarNote,
  INoteRepository,
  IMarkdownProcessor,
} from '../../../domain';

export interface EmbeddingServiceDeps {
  noteRepository: INoteRepository;
  markdownProcessor: IMarkdownProcessor;
}

export class EmbeddingService implements IEmbeddingService {
  private ready = false;

  constructor(private readonly deps: EmbeddingServiceDeps) {}

  async initialize(): Promise<void> {
    // Stub - ML initialization would go here
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  async generateEmbedding(_text: string): Promise<Float32Array> {
    // Stub - returns empty embedding
    return new Float32Array(0);
  }

  async generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
    return texts.map(() => new Float32Array(0));
  }

  async classifyNote(_noteId: string): Promise<ClassificationResult[]> {
    // Stub - no classification
    return [];
  }

  async findSimilarNotes(_noteId: string, _limit = 5): Promise<SimilarNote[]> {
    // Stub - no similar notes
    return [];
  }

  async semanticSearch(_query: string, _limit = 10): Promise<SimilarNote[]> {
    // Stub - no semantic search
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
    // Stub - no centroid computation
  }

  async getStatus(): Promise<{
    ready: boolean;
    totalNotes: number;
    embeddedNotes: number;
    pendingNotes: number;
  }> {
    const totalNotes = await this.deps.noteRepository.count({ isDeleted: false });

    return {
      ready: this.ready,
      totalNotes,
      embeddedNotes: 0,
      pendingNotes: totalNotes,
    };
  }
}
