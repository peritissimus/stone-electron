/**
 * Embedding Service Port
 *
 * Defines the contract for ML embedding operations.
 */

export interface EmbeddingResult {
  noteId: string;
  embedding: Float32Array;
  model: string;
  dimensions: number;
}

export interface ClassificationResult {
  topicId: string;
  topicName: string;
  confidence: number;
}

export interface SimilarNote {
  noteId: string;
  title: string;
  similarity: number;
  distance: number;
}

export interface IEmbeddingService {
  /**
   * Initialize the embedding service
   */
  initialize(): Promise<void>;

  /**
   * Check if service is ready
   */
  isReady(): boolean;

  /**
   * Generate embedding for text
   */
  generateEmbedding(text: string): Promise<Float32Array>;

  /**
   * Generate embeddings for multiple texts
   */
  generateEmbeddings(texts: string[]): Promise<Float32Array[]>;

  /**
   * Classify a note into topics
   */
  classifyNote(noteId: string): Promise<ClassificationResult[]>;

  /**
   * Find similar notes
   */
  findSimilarNotes(noteId: string, limit?: number): Promise<SimilarNote[]>;

  /**
   * Semantic search
   */
  semanticSearch(query: string, limit?: number): Promise<SimilarNote[]>;

  /**
   * Store embedding for a note
   */
  storeEmbedding(noteId: string, embedding: Float32Array): Promise<void>;

  /**
   * Get embedding for a note
   */
  getEmbedding(noteId: string): Promise<Float32Array | null>;

  /**
   * Delete embedding for a note
   */
  deleteEmbedding(noteId: string): Promise<void>;

  /**
   * Recompute topic centroids
   */
  recomputeCentroids(): Promise<void>;

  /**
   * Get embedding status
   */
  getStatus(): Promise<{
    ready: boolean;
    totalNotes: number;
    embeddedNotes: number;
    pendingNotes: number;
  }>;
}
