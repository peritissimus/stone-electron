/**
 * EmbeddingService Tests
 *
 * Uses mocked @xenova/transformers to test embedding functionality.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the transformers module
const mockPipeline = vi.fn();

vi.mock('@xenova/transformers', () => ({
  pipeline: mockPipeline,
  env: {
    allowLocalModels: true,
    useBrowserCache: false,
  },
}));

// Mock logger
vi.mock('../../src/main/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

import { createEmbeddingService } from '../../src/main/services/EmbeddingService';

describe('EmbeddingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('initializes and reports readiness', async () => {
      const mockEmbedder = vi.fn().mockResolvedValue({
        data: new Float32Array(384).fill(0.1),
      });
      mockPipeline.mockResolvedValue(mockEmbedder);

      const embeddingService = createEmbeddingService();
      await embeddingService.initialize();

      expect(embeddingService.isReady()).toBe(true);
      expect(embeddingService.getDimensions()).toBe(384);
      expect(mockPipeline).toHaveBeenCalledWith(
        'feature-extraction',
        'Xenova/bge-small-en-v1.5',
        { quantized: true }
      );
    });

    it('only initializes once when called multiple times', async () => {
      const mockEmbedder = vi.fn().mockResolvedValue({
        data: new Float32Array(384),
      });
      mockPipeline.mockResolvedValue(mockEmbedder);

      const embeddingService = createEmbeddingService();

      // Call initialize multiple times concurrently
      await Promise.all([
        embeddingService.initialize(),
        embeddingService.initialize(),
        embeddingService.initialize(),
      ]);

      // Pipeline should only be called once
      expect(mockPipeline).toHaveBeenCalledTimes(1);
    });

    it('handles initialization failure gracefully', async () => {
      mockPipeline.mockRejectedValue(new Error('Model download failed'));

      const embeddingService = createEmbeddingService();

      await expect(embeddingService.initialize()).rejects.toThrow('Model download failed');
      expect(embeddingService.isReady()).toBe(false);
    });

    it('can retry initialization after failure', async () => {
      const mockEmbedder = vi.fn().mockResolvedValue({
        data: new Float32Array(384),
      });

      // First call fails, second succeeds
      mockPipeline
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockEmbedder);

      const embeddingService = createEmbeddingService();

      // First attempt fails
      await expect(embeddingService.initialize()).rejects.toThrow('Network error');
      expect(embeddingService.isReady()).toBe(false);

      // Second attempt succeeds
      await embeddingService.initialize();
      expect(embeddingService.isReady()).toBe(true);
    });
  });

  describe('getEmbedding', () => {
    it('returns zero vector for empty text', async () => {
      const mockEmbedder = vi.fn().mockResolvedValue({
        data: new Float32Array(384).fill(0.5),
      });
      mockPipeline.mockResolvedValue(mockEmbedder);

      const embeddingService = createEmbeddingService();
      await embeddingService.initialize();

      const emb = await embeddingService.getEmbedding('');

      expect(emb).toHaveLength(384);
      expect(emb.every((v: number) => v === 0)).toBe(true);
      expect(mockEmbedder).not.toHaveBeenCalled();
    });

    it('returns zero vector for whitespace-only text', async () => {
      const mockEmbedder = vi.fn().mockResolvedValue({
        data: new Float32Array(384).fill(0.5),
      });
      mockPipeline.mockResolvedValue(mockEmbedder);

      const embeddingService = createEmbeddingService();
      await embeddingService.initialize();

      const emb = await embeddingService.getEmbedding('   \n\t  ');

      expect(emb).toHaveLength(384);
      expect(emb.every((v: number) => v === 0)).toBe(true);
      expect(mockEmbedder).not.toHaveBeenCalled();
    });

    it('generates embedding for text', async () => {
      const mockEmbedding = new Float32Array(384);
      mockEmbedding[0] = 0.5;
      mockEmbedding[1] = 0.3;

      const mockEmbedder = vi.fn().mockResolvedValue({
        data: mockEmbedding,
      });
      mockPipeline.mockResolvedValue(mockEmbedder);

      const embeddingService = createEmbeddingService();
      await embeddingService.initialize();

      const emb = await embeddingService.getEmbedding('Hello world');

      expect(emb).toHaveLength(384);
      expect(emb[0]).toBeCloseTo(0.5, 5);
      expect(emb[1]).toBeCloseTo(0.3, 5);
      expect(mockEmbedder).toHaveBeenCalledWith('Hello world', {
        pooling: 'mean',
        normalize: true,
      });
    });

    it('handles long text input', async () => {
      const mockEmbedder = vi.fn().mockResolvedValue({
        data: new Float32Array(384).fill(0.1),
      });
      mockPipeline.mockResolvedValue(mockEmbedder);

      const embeddingService = createEmbeddingService();
      await embeddingService.initialize();

      const longText = 'Lorem ipsum '.repeat(1000);
      const emb = await embeddingService.getEmbedding(longText);

      expect(emb).toHaveLength(384);
      expect(mockEmbedder).toHaveBeenCalledWith(longText, expect.any(Object));
    });

    it('handles unicode and special characters', async () => {
      const mockEmbedder = vi.fn().mockResolvedValue({
        data: new Float32Array(384).fill(0.2),
      });
      mockPipeline.mockResolvedValue(mockEmbedder);

      const embeddingService = createEmbeddingService();
      await embeddingService.initialize();

      const unicodeText = '你好世界 🌍 Привет мир السلام عليكم';
      const emb = await embeddingService.getEmbedding(unicodeText);

      expect(emb).toHaveLength(384);
      expect(mockEmbedder).toHaveBeenCalledWith(unicodeText, expect.any(Object));
    });

    it('propagates initialization error when not initialized', async () => {
      // Mock pipeline to fail - getEmbedding auto-initializes
      mockPipeline.mockRejectedValue(new Error('Cannot load model'));

      const embeddingService = createEmbeddingService();

      // getEmbedding will try to initialize and fail
      await expect(embeddingService.getEmbedding('test')).rejects.toThrow('Cannot load model');
    });

    it('propagates pipeline errors', async () => {
      const mockEmbedder = vi.fn().mockRejectedValue(new Error('Inference failed'));
      mockPipeline.mockResolvedValue(mockEmbedder);

      const embeddingService = createEmbeddingService();
      await embeddingService.initialize();

      await expect(embeddingService.getEmbedding('test')).rejects.toThrow('Inference failed');
    });
  });

  describe('batchEmbed', () => {
    it('handles batch embeddings and preserves empty positions', async () => {
      const mockEmbedding = new Float32Array(384);
      mockEmbedding[0] = 0.5;
      mockEmbedding[1] = 0.5;

      const mockEmbedder = vi.fn().mockResolvedValue({
        data: mockEmbedding,
      });
      mockPipeline.mockResolvedValue(mockEmbedder);

      const embeddingService = createEmbeddingService();
      await embeddingService.initialize();

      const result = await embeddingService.batchEmbed(['text', '']);

      expect(result).toHaveLength(2);
      expect(result[0][0]).toBeCloseTo(0.5, 5);
      expect(result[0][1]).toBeCloseTo(0.5, 5);
      expect(result[1]).toEqual(new Array(384).fill(0));
      expect(mockEmbedder).toHaveBeenCalledTimes(1);
    });

    it('returns empty array for empty input', async () => {
      const mockEmbedder = vi.fn().mockResolvedValue({
        data: new Float32Array(384),
      });
      mockPipeline.mockResolvedValue(mockEmbedder);

      const embeddingService = createEmbeddingService();
      await embeddingService.initialize();

      const result = await embeddingService.batchEmbed([]);

      expect(result).toEqual([]);
      expect(mockEmbedder).not.toHaveBeenCalled();
    });

    it('handles all empty texts', async () => {
      const mockEmbedder = vi.fn().mockResolvedValue({
        data: new Float32Array(384),
      });
      mockPipeline.mockResolvedValue(mockEmbedder);

      const embeddingService = createEmbeddingService();
      await embeddingService.initialize();

      const result = await embeddingService.batchEmbed(['', '', '  ']);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(new Array(384).fill(0));
      expect(result[1]).toEqual(new Array(384).fill(0));
      expect(result[2]).toEqual(new Array(384).fill(0));
      expect(mockEmbedder).not.toHaveBeenCalled();
    });

    it('handles mixed empty and non-empty texts with correct positions', async () => {
      let callIndex = 0;
      const mockEmbedder = vi.fn().mockImplementation(() => {
        const embedding = new Float32Array(384);
        embedding[0] = callIndex++;
        return Promise.resolve({ data: embedding });
      });
      mockPipeline.mockResolvedValue(mockEmbedder);

      const embeddingService = createEmbeddingService();
      await embeddingService.initialize();

      const result = await embeddingService.batchEmbed(['first', '', 'second', '  ', 'third']);

      expect(result).toHaveLength(5);
      // First non-empty gets index 0
      expect(result[0][0]).toBeCloseTo(0, 5);
      // Second position is empty
      expect(result[1]).toEqual(new Array(384).fill(0));
      // Second non-empty gets index 1
      expect(result[2][0]).toBeCloseTo(1, 5);
      // Fourth position is whitespace (treated as empty)
      expect(result[3]).toEqual(new Array(384).fill(0));
      // Third non-empty gets index 2
      expect(result[4][0]).toBeCloseTo(2, 5);

      expect(mockEmbedder).toHaveBeenCalledTimes(3);
    });

    it('propagates initialization error when not initialized', async () => {
      // Mock pipeline to fail - batchEmbed auto-initializes
      mockPipeline.mockRejectedValue(new Error('Cannot load model'));

      const embeddingService = createEmbeddingService();

      // batchEmbed will try to initialize and fail
      await expect(embeddingService.batchEmbed(['test'])).rejects.toThrow('Cannot load model');
    });
  });

  describe('ping', () => {
    it('returns correct ping response', async () => {
      const mockEmbedder = vi.fn().mockResolvedValue({
        data: new Float32Array(384),
      });
      mockPipeline.mockResolvedValue(mockEmbedder);

      const embeddingService = createEmbeddingService();
      const pingResult = await embeddingService.ping();

      expect(pingResult.model).toBe('Xenova/bge-small-en-v1.5');
      expect(pingResult.dims).toBe(384);
    });

    it('initializes if not already initialized', async () => {
      const mockEmbedder = vi.fn().mockResolvedValue({
        data: new Float32Array(384),
      });
      mockPipeline.mockResolvedValue(mockEmbedder);

      const embeddingService = createEmbeddingService();
      expect(embeddingService.isReady()).toBe(false);

      await embeddingService.ping();

      expect(embeddingService.isReady()).toBe(true);
    });
  });

  describe('shutdown', () => {
    it('can shutdown and restart', async () => {
      const mockEmbedder = vi.fn().mockResolvedValue({
        data: new Float32Array(384),
      });
      mockPipeline.mockResolvedValue(mockEmbedder);

      const embeddingService = createEmbeddingService();
      await embeddingService.initialize();
      expect(embeddingService.isReady()).toBe(true);

      await embeddingService.shutdown();
      expect(embeddingService.isReady()).toBe(false);

      await embeddingService.initialize();
      expect(embeddingService.isReady()).toBe(true);
    });

    it('is safe to call shutdown multiple times', async () => {
      const mockEmbedder = vi.fn().mockResolvedValue({
        data: new Float32Array(384),
      });
      mockPipeline.mockResolvedValue(mockEmbedder);

      const embeddingService = createEmbeddingService();
      await embeddingService.initialize();

      await embeddingService.shutdown();
      await embeddingService.shutdown();
      await embeddingService.shutdown();

      expect(embeddingService.isReady()).toBe(false);
    });

    it('is safe to call shutdown without initialization', async () => {
      const embeddingService = createEmbeddingService();

      // Should not throw
      await embeddingService.shutdown();
      expect(embeddingService.isReady()).toBe(false);
    });
  });

  describe('getDimensions', () => {
    it('returns 384 dimensions', () => {
      const embeddingService = createEmbeddingService();
      expect(embeddingService.getDimensions()).toBe(384);
    });
  });
});
