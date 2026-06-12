import { describe, expect, it, vi } from 'vitest';
import { Embedder, type EmbeddingWorkerClient } from '../../../../../src/main/adapters/out/integrations/Embedder';

function worker(overrides: Partial<EmbeddingWorkerClient> = {}): EmbeddingWorkerClient {
  return {
    initialize: vi.fn(),
    isReady: vi.fn().mockReturnValue(true),
    getEmbedding: vi.fn().mockResolvedValue([1, 2, 3]),
    batchEmbed: vi.fn().mockResolvedValue([
      [1, 0],
      [0, 1],
    ]),
    ...overrides,
  };
}

describe('Embedder', () => {
  it('delegates readiness and initialization to the worker service', async () => {
    const client = worker({ isReady: vi.fn().mockReturnValue(false) });
    const embedder = new Embedder({ workerService: client });

    expect(embedder.isReady()).toBe(false);
    await embedder.initialize();

    expect(client.initialize).toHaveBeenCalledWith();
  });

  it('converts worker number arrays into Float32Array results', async () => {
    const client = worker();
    const embedder = new Embedder({ workerService: client });

    const single = await embedder.generateEmbedding('hello');
    const batch = await embedder.generateEmbeddings(['a', 'b']);

    expect(client.getEmbedding).toHaveBeenCalledWith('hello');
    expect(single).toBeInstanceOf(Float32Array);
    expect(Array.from(single)).toEqual([1, 2, 3]);
    expect(batch.map((value) => Array.from(value))).toEqual([
      [1, 0],
      [0, 1],
    ]);
  });
});
