/**
 * SimilarityCalculator Domain Service Tests
 *
 * Pure vector math tests - no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import { SimilarityCalculator } from '../../../../src/main/domain/services/SimilarityCalculator';

describe('SimilarityCalculator', () => {
  describe('cosineSimilarity', () => {
    it('returns 1 for identical vectors', () => {
      const a = [1, 2, 3];
      const b = [1, 2, 3];

      const similarity = SimilarityCalculator.cosineSimilarity(a, b);

      expect(similarity).toBeCloseTo(1, 5);
    });

    it('returns -1 for opposite vectors', () => {
      const a = [1, 0, 0];
      const b = [-1, 0, 0];

      const similarity = SimilarityCalculator.cosineSimilarity(a, b);

      expect(similarity).toBeCloseTo(-1, 5);
    });

    it('returns 0 for orthogonal vectors', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];

      const similarity = SimilarityCalculator.cosineSimilarity(a, b);

      expect(similarity).toBeCloseTo(0, 5);
    });

    it('works with Float32Array', () => {
      const a = new Float32Array([1, 2, 3]);
      const b = new Float32Array([1, 2, 3]);

      const similarity = SimilarityCalculator.cosineSimilarity(a, b);

      expect(similarity).toBeCloseTo(1, 5);
    });

    it('throws on mismatched vector lengths', () => {
      const a = [1, 2, 3];
      const b = [1, 2];

      expect(() => SimilarityCalculator.cosineSimilarity(a, b)).toThrow();
    });

    it('handles zero vectors gracefully', () => {
      const a = [0, 0, 0];
      const b = [1, 2, 3];

      const similarity = SimilarityCalculator.cosineSimilarity(a, b);

      expect(similarity).toBe(0);
    });
  });

  describe('euclideanDistance', () => {
    it('returns 0 for identical vectors', () => {
      const a = [1, 2, 3];
      const b = [1, 2, 3];

      const distance = SimilarityCalculator.euclideanDistance(a, b);

      expect(distance).toBe(0);
    });

    it('calculates correct distance', () => {
      const a = [0, 0];
      const b = [3, 4];

      const distance = SimilarityCalculator.euclideanDistance(a, b);

      expect(distance).toBe(5); // 3-4-5 triangle
    });

    it('works with Float32Array', () => {
      const a = new Float32Array([0, 0]);
      const b = new Float32Array([3, 4]);

      const distance = SimilarityCalculator.euclideanDistance(a, b);

      expect(distance).toBeCloseTo(5, 5);
    });

    it('throws on mismatched vector lengths', () => {
      const a = [1, 2, 3];
      const b = [1, 2];

      expect(() => SimilarityCalculator.euclideanDistance(a, b)).toThrow();
    });
  });

  describe('findMostSimilar', () => {
    it('returns top K most similar vectors', () => {
      const query = [1, 0, 0];
      const candidates = [
        [1, 0, 0], // Most similar (index 0)
        [0, 1, 0], // Orthogonal (index 1)
        [0.9, 0.1, 0], // Very similar (index 2)
      ];

      const results = SimilarityCalculator.findMostSimilar(query, candidates, 2);

      expect(results).toHaveLength(2);
      expect(results[0].index).toBe(0); // First candidate is most similar
      expect(results[0].score).toBeCloseTo(1, 5);
    });

    it('filters by minimum score', () => {
      const query = [1, 0, 0];
      const candidates = [
        [1, 0, 0], // Score 1 (index 0)
        [0, 1, 0], // Score 0 (index 1)
      ];

      const results = SimilarityCalculator.findMostSimilar(query, candidates, 10, 0.5);

      expect(results).toHaveLength(1);
      expect(results[0].index).toBe(0);
    });

    it('returns empty array for no candidates', () => {
      const query = [1, 0, 0];
      const results = SimilarityCalculator.findMostSimilar(query, [], 5);

      expect(results).toEqual([]);
    });

    it('sorts by descending similarity', () => {
      const query = [1, 0, 0];
      const candidates = [
        [0.5, 0.5, 0], // low (index 0)
        [0.99, 0.01, 0], // high (index 1)
        [0.7, 0.3, 0], // medium (index 2)
      ];

      const results = SimilarityCalculator.findMostSimilar(query, candidates, 3);

      expect(results[0].index).toBe(1); // high similarity
      expect(results[0].score).toBeGreaterThan(results[1].score);
      expect(results[1].score).toBeGreaterThan(results[2].score);
    });
  });

  describe('calculateCentroid', () => {
    it('calculates average of vectors', () => {
      const vectors = [
        [2, 4, 6],
        [4, 6, 8],
      ];

      const centroid = SimilarityCalculator.calculateCentroid(vectors);

      expect(Array.from(centroid)).toEqual([3, 5, 7]);
    });

    it('returns single vector as centroid', () => {
      const vectors = [[1, 2, 3]];

      const centroid = SimilarityCalculator.calculateCentroid(vectors);

      expect(Array.from(centroid)).toEqual([1, 2, 3]);
    });

    it('throws on empty vector set', () => {
      expect(() => SimilarityCalculator.calculateCentroid([])).toThrow();
    });
  });

  describe('normalize', () => {
    it('normalizes vector to unit length', () => {
      const vector = [3, 4, 0];

      const normalized = SimilarityCalculator.normalize(vector);

      // Length should be 1
      const length = Math.sqrt(
        normalized.reduce((sum, v) => sum + v * v, 0)
      );
      expect(length).toBeCloseTo(1, 5);
    });

    it('returns zero vector for zero input', () => {
      const vector = [0, 0, 0];

      const normalized = SimilarityCalculator.normalize(vector);

      expect(Array.from(normalized)).toEqual([0, 0, 0]);
    });

    it('preserves direction', () => {
      const vector = [3, 4, 0];

      const normalized = SimilarityCalculator.normalize(vector);

      // Should be [0.6, 0.8, 0]
      expect(normalized[0]).toBeCloseTo(0.6, 5);
      expect(normalized[1]).toBeCloseTo(0.8, 5);
      expect(normalized[2]).toBeCloseTo(0, 5);
    });
  });

  describe('toNumberArray', () => {
    it('converts Float32Array to number array', () => {
      const float32 = new Float32Array([1, 2, 3]);

      const result = SimilarityCalculator.toNumberArray(float32);

      expect(result).toEqual([1, 2, 3]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('returns number array as-is', () => {
      const arr = [1, 2, 3];

      const result = SimilarityCalculator.toNumberArray(arr);

      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('toFloat32Array', () => {
    it('converts number array to Float32Array', () => {
      const arr = [1, 2, 3];

      const result = SimilarityCalculator.toFloat32Array(arr);

      expect(result).toBeInstanceOf(Float32Array);
      expect(Array.from(result)).toEqual([1, 2, 3]);
    });

    it('creates new Float32Array from Float32Array', () => {
      const float32 = new Float32Array([1, 2, 3]);

      const result = SimilarityCalculator.toFloat32Array(float32);

      // Implementation always creates new Float32Array
      expect(result).toBeInstanceOf(Float32Array);
      expect(Array.from(result)).toEqual([1, 2, 3]);
    });
  });

  describe('areEqual', () => {
    it('returns true for equal vectors', () => {
      const a = [1, 2, 3];
      const b = [1, 2, 3];

      expect(SimilarityCalculator.areEqual(a, b)).toBe(true);
    });

    it('returns false for different vectors', () => {
      const a = [1, 2, 3];
      const b = [1, 2, 4];

      expect(SimilarityCalculator.areEqual(a, b)).toBe(false);
    });

    it('uses epsilon for floating point comparison', () => {
      const a = [1.0000001, 2, 3];
      const b = [1, 2, 3];

      expect(SimilarityCalculator.areEqual(a, b)).toBe(true);
    });

    it('respects custom epsilon', () => {
      const a = [1.1, 2, 3];
      const b = [1, 2, 3];

      expect(SimilarityCalculator.areEqual(a, b, 0.2)).toBe(true);
      expect(SimilarityCalculator.areEqual(a, b, 0.05)).toBe(false);
    });

    it('returns false for different length vectors', () => {
      const a = [1, 2, 3];
      const b = [1, 2];

      expect(SimilarityCalculator.areEqual(a, b)).toBe(false);
    });
  });

  describe('zeroVector', () => {
    it('creates vector of zeros', () => {
      const vector = SimilarityCalculator.zeroVector(5);

      expect(vector).toHaveLength(5);
      expect(vector.every((v) => v === 0)).toBe(true);
    });

    it('returns number array', () => {
      const vector = SimilarityCalculator.zeroVector(3);

      // Implementation returns number[] not Float32Array
      expect(Array.isArray(vector)).toBe(true);
    });
  });
});
