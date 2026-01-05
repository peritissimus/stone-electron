/**
 * EmbeddingService Tests
 *
 * Tests the worker-based embedding service by mocking Worker threads.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// Mock Worker class - handlers are attached synchronously, then we emit ready
class MockWorker extends EventEmitter {
  postMessage = vi.fn();
  terminate = vi.fn().mockResolvedValue(undefined);

  constructor() {
    super();
    // Use setImmediate to ensure handlers are attached first
    setImmediate(() => {
      this.emit('message', { type: 'ready' });
    });
  }

  // Helper to simulate responses from worker
  simulateResponse(response: { id: string; success: boolean; data?: unknown; error?: string }) {
    this.emit('message', response);
  }

  simulateError(error: Error) {
    this.emit('error', error);
  }
}

// Store mock worker instance for test access
let mockWorkerInstance: MockWorker | null = null;

vi.mock('worker_threads', () => ({
  Worker: vi.fn().mockImplementation(() => {
    mockWorkerInstance = new MockWorker();
    return mockWorkerInstance;
  }),
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

// Mock MLStatusService to avoid BrowserWindow dependency
vi.mock('../../src/main/services/MLStatusService', () => ({
  getMLStatusService: vi.fn().mockReturnValue({
    setServiceStatus: vi.fn(),
    startOperation: vi.fn().mockReturnValue('test-op-id'),
    updateProgress: vi.fn(),
    completeOperation: vi.fn(),
    failOperation: vi.fn(),
  }),
}));

import { createEmbeddingService, EmbeddingService } from '../../src/main/services/EmbeddingService';

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkerInstance = null;
    service = createEmbeddingService();
  });

  afterEach(async () => {
    // Clean up - don't wait for shutdown if not ready
    if (mockWorkerInstance) {
      mockWorkerInstance.removeAllListeners();
    }
    mockWorkerInstance = null;
  });

  describe('initialization', () => {
    it('should create a worker on initialization', async () => {
      // Start initialization
      const initPromise = service.initialize();

      // Wait a tick for ready message, then respond to init
      await vi.waitFor(() => {
        expect(mockWorkerInstance).not.toBeNull();
      });

      // Wait for the init message to be sent
      await vi.waitFor(() => {
        expect(mockWorkerInstance?.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'init' })
        );
      });

      // Simulate init response
      mockWorkerInstance!.simulateResponse({
        id: '1',
        success: true,
        data: { model: 'Xenova/bge-small-en-v1.5', dims: 384 },
      });

      await initPromise;

      expect(service.isReady()).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      const initPromise = service.initialize();

      await vi.waitFor(() => {
        expect(mockWorkerInstance?.postMessage).toHaveBeenCalled();
      });

      mockWorkerInstance!.simulateResponse({
        id: '1',
        success: true,
        data: { model: 'Xenova/bge-small-en-v1.5', dims: 384 },
      });

      await initPromise;

      // Try to initialize again - should be instant
      await service.initialize();

      // postMessage should only have been called once (for the first init)
      expect(mockWorkerInstance?.postMessage).toHaveBeenCalledTimes(1);
      expect(service.isReady()).toBe(true);
    });

    it('should handle initialization failure', async () => {
      const initPromise = service.initialize();

      await vi.waitFor(() => {
        expect(mockWorkerInstance?.postMessage).toHaveBeenCalled();
      });

      mockWorkerInstance!.simulateResponse({
        id: '1',
        success: false,
        error: 'Model loading failed',
      });

      await expect(initPromise).rejects.toThrow('Model loading failed');
      expect(service.isReady()).toBe(false);
    });
  });

  describe('getEmbedding', () => {
    beforeEach(async () => {
      const initPromise = service.initialize();

      await vi.waitFor(() => {
        expect(mockWorkerInstance?.postMessage).toHaveBeenCalled();
      });

      mockWorkerInstance!.simulateResponse({
        id: '1',
        success: true,
        data: { model: 'Xenova/bge-small-en-v1.5', dims: 384 },
      });

      await initPromise;
    });

    it('should generate embedding for text', async () => {
      const mockEmbedding = new Array(384).fill(0.1);
      const embedPromise = service.getEmbedding('test text');

      await vi.waitFor(() => {
        expect(mockWorkerInstance?.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'embed', text: 'test text' })
        );
      });

      mockWorkerInstance!.simulateResponse({
        id: '2',
        success: true,
        data: mockEmbedding,
      });

      const result = await embedPromise;

      expect(result).toEqual(mockEmbedding);
      expect(result).toHaveLength(384);
    });

    it('should handle embedding errors', async () => {
      const embedPromise = service.getEmbedding('test text');

      await vi.waitFor(() => {
        expect(mockWorkerInstance?.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'embed' })
        );
      });

      mockWorkerInstance!.simulateResponse({
        id: '2',
        success: false,
        error: 'Embedding failed',
      });

      await expect(embedPromise).rejects.toThrow('Embedding failed');
    });
  });

  describe('batchEmbed', () => {
    beforeEach(async () => {
      const initPromise = service.initialize();

      await vi.waitFor(() => {
        expect(mockWorkerInstance?.postMessage).toHaveBeenCalled();
      });

      mockWorkerInstance!.simulateResponse({
        id: '1',
        success: true,
        data: { model: 'Xenova/bge-small-en-v1.5', dims: 384 },
      });

      await initPromise;
    });

    it('should generate embeddings for multiple texts', async () => {
      const mockEmbeddings = [new Array(384).fill(0.1), new Array(384).fill(0.2)];

      const embedPromise = service.batchEmbed(['text 1', 'text 2']);

      await vi.waitFor(() => {
        expect(mockWorkerInstance?.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'batchEmbed' })
        );
      });

      mockWorkerInstance!.simulateResponse({
        id: '2',
        success: true,
        data: mockEmbeddings,
      });

      const result = await embedPromise;

      expect(result).toEqual(mockEmbeddings);
      expect(result).toHaveLength(2);
    });
  });

  describe('ping', () => {
    it('should return model info after initialization', async () => {
      const initPromise = service.initialize();

      await vi.waitFor(() => {
        expect(mockWorkerInstance?.postMessage).toHaveBeenCalled();
      });

      mockWorkerInstance!.simulateResponse({
        id: '1',
        success: true,
        data: { model: 'Xenova/bge-small-en-v1.5', dims: 384 },
      });

      await initPromise;

      const pingPromise = service.ping();

      await vi.waitFor(() => {
        expect(mockWorkerInstance?.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'ping' })
        );
      });

      mockWorkerInstance!.simulateResponse({
        id: '2',
        success: true,
        data: { model: 'Xenova/bge-small-en-v1.5', dims: 384 },
      });

      const result = await pingPromise;

      expect(result).toEqual({ model: 'Xenova/bge-small-en-v1.5', dims: 384 });
    });
  });

  describe('shutdown', () => {
    it('should terminate the worker', async () => {
      const initPromise = service.initialize();

      await vi.waitFor(() => {
        expect(mockWorkerInstance?.postMessage).toHaveBeenCalled();
      });

      mockWorkerInstance!.simulateResponse({
        id: '1',
        success: true,
        data: { model: 'Xenova/bge-small-en-v1.5', dims: 384 },
      });

      await initPromise;

      const shutdownPromise = service.shutdown();

      await vi.waitFor(() => {
        expect(mockWorkerInstance?.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'shutdown' })
        );
      });

      mockWorkerInstance!.simulateResponse({
        id: '2',
        success: true,
      });

      await shutdownPromise;

      expect(mockWorkerInstance?.terminate).toHaveBeenCalled();
    });
  });

  describe('getDimensions', () => {
    it('should return embedding dimensions', () => {
      expect(service.getDimensions()).toBe(384);
    });
  });

  describe('isReady', () => {
    it('should return false before initialization', () => {
      expect(service.isReady()).toBe(false);
    });

    it('should return true after initialization', async () => {
      const initPromise = service.initialize();

      await vi.waitFor(() => {
        expect(mockWorkerInstance?.postMessage).toHaveBeenCalled();
      });

      mockWorkerInstance!.simulateResponse({
        id: '1',
        success: true,
        data: { model: 'Xenova/bge-small-en-v1.5', dims: 384 },
      });

      await initPromise;

      expect(service.isReady()).toBe(true);
    });
  });

  describe('auto-initialization', () => {
    it('should auto-initialize when calling getEmbedding', async () => {
      const mockEmbedding = new Array(384).fill(0.1);
      const embedPromise = service.getEmbedding('test');

      // First, init message
      await vi.waitFor(() => {
        expect(mockWorkerInstance?.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'init' })
        );
      });

      mockWorkerInstance!.simulateResponse({
        id: '1',
        success: true,
        data: { model: 'Xenova/bge-small-en-v1.5', dims: 384 },
      });

      // Then embed message
      await vi.waitFor(() => {
        expect(mockWorkerInstance?.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'embed' })
        );
      });

      mockWorkerInstance!.simulateResponse({
        id: '2',
        success: true,
        data: mockEmbedding,
      });

      const result = await embedPromise;

      expect(result).toEqual(mockEmbedding);
      expect(service.isReady()).toBe(true);
    });
  });

  describe('worker error handling', () => {
    it('should handle worker errors', async () => {
      const initPromise = service.initialize();

      await vi.waitFor(() => {
        expect(mockWorkerInstance?.postMessage).toHaveBeenCalled();
      });

      mockWorkerInstance!.simulateResponse({
        id: '1',
        success: true,
        data: { model: 'Xenova/bge-small-en-v1.5', dims: 384 },
      });

      await initPromise;

      // Start an embed request
      const embedPromise = service.getEmbedding('test');

      await vi.waitFor(() => {
        expect(mockWorkerInstance?.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'embed' })
        );
      });

      // Simulate worker error
      mockWorkerInstance!.simulateError(new Error('Worker crashed'));

      await expect(embedPromise).rejects.toThrow('Worker crashed');
    });
  });
});
