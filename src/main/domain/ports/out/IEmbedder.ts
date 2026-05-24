/**
 * Embedding Service Port
 *
 * Generates dense vector embeddings for arbitrary text. Persistence of those
 * vectors (storing them, searching against them, computing note-level means)
 * lives in IIndexRepository — this port stays narrow so the embedder is
 * interchangeable (local vs. cloud) without dragging the persistence model
 * along.
 */

export interface EmbeddingResult {
  noteId: string;
  embedding: Float32Array;
  model: string;
  dimensions: number;
}

export interface SimilarNote {
  noteId: string;
  title: string;
  similarity: number;
  distance: number;
}

export interface IEmbedder {
  /** Initialize the embedding service (load the model). */
  initialize(): Promise<void>;

  /** Check if the service is ready. */
  isReady(): boolean;

  /** Generate embedding for a single text. */
  generateEmbedding(text: string): Promise<Float32Array>;

  /** Generate embeddings for multiple texts. */
  generateEmbeddings(texts: string[]): Promise<Float32Array[]>;
}
