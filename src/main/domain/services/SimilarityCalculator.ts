/**
 * SimilarityCalculator - Pure domain service for vector similarity calculations
 *
 * Used for semantic search and topic classification with embeddings.
 */

/**
 * Embedding vector type
 */
export type EmbeddingVector = number[] | Float32Array;

/**
 * Result of similarity comparison
 */
export interface SimilarityResult {
  score: number; // 0 to 1, higher is more similar
  index: number;
}

/**
 * SimilarityCalculator - Pure functions for vector operations
 */
export const SimilarityCalculator = {
  /**
   * Calculate cosine similarity between two vectors
   * Returns a value between -1 and 1 (1 = identical, 0 = orthogonal, -1 = opposite)
   */
  cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
    if (a.length !== b.length) {
      throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);

    if (magnitude === 0) {
      return 0;
    }

    return dotProduct / magnitude;
  },

  /**
   * Calculate Euclidean distance between two vectors
   */
  euclideanDistance(a: EmbeddingVector, b: EmbeddingVector): number {
    if (a.length !== b.length) {
      throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
    }

    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }

    return Math.sqrt(sum);
  },

  /**
   * Find the most similar vectors from a collection
   * Returns indices sorted by similarity (highest first)
   */
  findMostSimilar(
    query: EmbeddingVector,
    candidates: EmbeddingVector[],
    topK: number = 10,
    minScore: number = 0,
  ): SimilarityResult[] {
    const results: SimilarityResult[] = [];

    for (let i = 0; i < candidates.length; i++) {
      const score = this.cosineSimilarity(query, candidates[i]);
      if (score >= minScore) {
        results.push({ score, index: i });
      }
    }

    // Sort by score descending and take top K
    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  },

  /**
   * Calculate the centroid (average) of multiple vectors
   */
  calculateCentroid(vectors: EmbeddingVector[]): number[] {
    if (vectors.length === 0) {
      throw new Error('Cannot calculate centroid of empty vector set');
    }

    const dimensions = vectors[0].length;
    const centroid = new Array(dimensions).fill(0);

    for (const vector of vectors) {
      for (let i = 0; i < dimensions; i++) {
        centroid[i] += vector[i];
      }
    }

    // Average
    for (let i = 0; i < dimensions; i++) {
      centroid[i] /= vectors.length;
    }

    return centroid;
  },

  /**
   * Normalize a vector to unit length
   */
  normalize(vector: EmbeddingVector): number[] {
    let norm = 0;
    for (let i = 0; i < vector.length; i++) {
      norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm);

    if (norm === 0) {
      return Array.from(vector);
    }

    const result = new Array(vector.length);
    for (let i = 0; i < vector.length; i++) {
      result[i] = vector[i] / norm;
    }

    return result;
  },

  /**
   * Convert Float32Array to number array
   */
  toNumberArray(vector: EmbeddingVector): number[] {
    return Array.from(vector);
  },

  /**
   * Convert number array to Float32Array
   */
  toFloat32Array(vector: EmbeddingVector): Float32Array {
    return new Float32Array(vector);
  },

  /**
   * Check if two vectors are identical (within epsilon)
   */
  areEqual(a: EmbeddingVector, b: EmbeddingVector, epsilon: number = 1e-6): boolean {
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
      if (Math.abs(a[i] - b[i]) > epsilon) {
        return false;
      }
    }

    return true;
  },

  /**
   * Create a zero vector of specified dimensions
   */
  zeroVector(dimensions: number): number[] {
    return new Array(dimensions).fill(0);
  },
};
