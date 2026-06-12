import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LocalReranker,
  type RerankerWorkerClient,
} from '../../../../../src/main/adapters/out/integrations/LocalReranker';

function worker(overrides: Partial<RerankerWorkerClient> = {}): RerankerWorkerClient {
  return {
    isRerankerReady: vi.fn().mockReturnValue(true),
    initializeReranker: vi.fn(),
    rerank: vi.fn().mockResolvedValue([0.2, 0.9, 0.4]),
    ...overrides,
  };
}

const documents = [
  { id: 'a', text: 'alpha' },
  { id: 'b', text: 'beta' },
  { id: 'c', text: 'gamma' },
];

describe('LocalReranker', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes lazily and returns sorted topK scores', async () => {
    const client = worker({ isRerankerReady: vi.fn().mockReturnValue(false) });
    const reranker = new LocalReranker({ workerService: client });

    const result = await reranker.rerank({ query: 'best', documents, topK: 2 });

    expect(client.initializeReranker).toHaveBeenCalled();
    expect(client.rerank).toHaveBeenCalledWith('best', ['alpha', 'beta', 'gamma']);
    expect(result).toEqual([
      { id: 'b', score: 0.9 },
      { id: 'c', score: 0.4 },
    ]);
  });

  it('passes through unscored documents for empty queries and worker failures', async () => {
    await expect(new LocalReranker({ workerService: worker() }).rerank({
      query: '   ',
      documents,
    })).resolves.toEqual([
      { id: 'a', score: 0 },
      { id: 'b', score: 0 },
      { id: 'c', score: 0 },
    ]);

    await expect(
      new LocalReranker({
        workerService: worker({ rerank: vi.fn().mockRejectedValue(new Error('worker failed')) }),
      }).rerank({ query: 'best', documents }),
    ).resolves.toEqual([
      { id: 'a', score: 0 },
      { id: 'b', score: 0 },
      { id: 'c', score: 0 },
    ]);
  });
});
