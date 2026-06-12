import { beforeEach, describe, expect, it, vi } from 'vitest';

const workerMock = vi.hoisted(() => {
  class MiniEmitter {
    handlers = new Map<string, Array<(...args: any[]) => void>>();
    on(event: string, callback: (...args: any[]) => void) {
      const current = this.handlers.get(event) ?? [];
      current.push(callback);
      this.handlers.set(event, current);
      return this;
    }
    emit(event: string, ...args: any[]) {
      for (const callback of this.handlers.get(event) ?? []) {
        callback(...args);
      }
    }
  }

  class MockWorker extends MiniEmitter {
    postMessage = vi.fn();
    terminate = vi.fn().mockResolvedValue(0);
  }

  return {
    instances: [] as MockWorker[],
    Worker: vi.fn((_path: string, _options: unknown) => {
      const worker = new MockWorker();
      workerMock.instances.push(worker);
      return worker;
    }),
  };
});

const trackerMock = vi.hoisted(() => ({
  tracker: {
    setServiceStatus: vi.fn(),
    broadcastModelDownloadProgress: vi.fn(),
  },
}));

vi.mock('worker_threads', () => ({
  Worker: workerMock.Worker,
}));

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/stone-user-data'),
  },
}));

vi.mock('../../../../src/main/infrastructure/workers/MLStatusTracker', () => ({
  getMLStatusTracker: () => trackerMock.tracker,
}));

async function loadWorkerModule() {
  vi.resetModules();
  return import('../../../../src/main/infrastructure/workers/EmbeddingWorker');
}

async function initializeService(service: { initialize(): Promise<void> }) {
  const initializing = service.initialize();
  const worker = workerMock.instances[0];
  worker.emit('message', { type: 'ready' });
  await Promise.resolve();
  const initMessage = worker.postMessage.mock.calls.at(-1)?.[0];
  worker.emit('message', {
    id: initMessage.id,
    success: true,
    data: { model: 'mock-embedder', dims: 384 },
  });
  await initializing;
  return worker;
}

async function waitForPostedMessage(worker: { postMessage: any }, type: string) {
  for (let i = 0; i < 10; i += 1) {
    const message = worker.postMessage.mock.calls.map((call: unknown[]) => call[0]).find((item: any) => item.type === type);
    if (message) return message;
    await Promise.resolve();
  }
  throw new Error(`missing worker message: ${type}`);
}

describe('EmbeddingWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workerMock.instances.length = 0;
  });

  it('initializes a worker, routes requests, and broadcasts model download progress', async () => {
    const { EmbeddingWorker } = await loadWorkerModule();
    const service = new EmbeddingWorker();
    const worker = await initializeService(service);

    expect(workerMock.Worker).toHaveBeenCalledWith(
      expect.stringContaining('embedding.worker.cjs'),
      { workerData: { cacheDir: '/tmp/stone-user-data/ml-cache' } },
    );
    expect(service.isReady()).toBe(true);
    expect(service.getDimensions()).toBe(384);
    expect(trackerMock.tracker.setServiceStatus).toHaveBeenCalledWith('ready', {
      model: { name: 'mock-embedder', dims: 384 },
    });

    worker.emit('message', {
      type: 'downloadProgress',
      model: 'embedding',
      file: 'model.onnx',
      loaded: 10,
      total: 100,
    });
    expect(trackerMock.tracker.broadcastModelDownloadProgress).toHaveBeenCalledWith(
      expect.objectContaining({ file: 'model.onnx' }),
    );

    const embedding = service.getEmbedding('hello');
    const embedMessage = worker.postMessage.mock.calls.at(-1)?.[0];
    expect(embedMessage).toMatchObject({ type: 'embed', text: 'hello' });
    worker.emit('message', { id: embedMessage.id, success: true, data: [1, 2, 3] });
    await expect(embedding).resolves.toEqual([1, 2, 3]);

    const batch = service.batchEmbed(['a', 'b']);
    const batchMessage = worker.postMessage.mock.calls.at(-1)?.[0];
    worker.emit('message', {
      id: batchMessage.id,
      success: true,
      data: [
        [1, 0],
        [0, 1],
      ],
    });
    await expect(batch).resolves.toEqual([
      [1, 0],
      [0, 1],
    ]);
  });

  it('lazy-loads reranker and transcriber models before using them', async () => {
    const { EmbeddingWorker } = await loadWorkerModule();
    const service = new EmbeddingWorker();
    const worker = await initializeService(service);

    const rerank = service.rerank('query', ['a', 'b']);
    const initReranker = worker.postMessage.mock.calls.at(-1)?.[0];
    expect(initReranker).toMatchObject({ type: 'initReranker' });
    worker.emit('message', { id: initReranker.id, success: true, data: { model: 'reranker' } });
    const rerankMessage = await waitForPostedMessage(worker, 'rerank');
    worker.emit('message', { id: rerankMessage.id, success: true, data: [0.1, 0.9] });
    await expect(rerank).resolves.toEqual([0.1, 0.9]);
    expect(service.isRerankerReady()).toBe(true);

    const transcript = service.transcribe('/tmp/audio.wav');
    const initTranscriber = worker.postMessage.mock.calls.at(-1)?.[0];
    expect(initTranscriber).toMatchObject({ type: 'initTranscriber' });
    worker.emit('message', { id: initTranscriber.id, success: true, data: { model: 'whisper' } });
    const transcribeMessage = await waitForPostedMessage(worker, 'transcribe');
    worker.emit('message', {
      id: transcribeMessage.id,
      success: true,
      data: { text: 'hello', segments: [], durationMs: 10 },
    });
    await expect(transcript).resolves.toMatchObject({ text: 'hello' });
    expect(service.isTranscriberReady()).toBe(true);
  });

  it('rejects pending requests on worker errors and resets state on shutdown', async () => {
    const { EmbeddingWorker } = await loadWorkerModule();
    const service = new EmbeddingWorker();
    const worker = await initializeService(service);

    const request = service.ping();
    worker.emit('error', new Error('worker failed'));
    await expect(request).rejects.toThrow('worker failed');

    const shutdown = service.shutdown();
    const shutdownMessage = worker.postMessage.mock.calls.at(-1)?.[0];
    worker.emit('message', { id: shutdownMessage.id, success: true });
    await shutdown;

    expect(worker.terminate).toHaveBeenCalledWith();
    expect(service.isReady()).toBe(false);
    expect(trackerMock.tracker.setServiceStatus).toHaveBeenCalledWith('idle');
  });

  it('exposes singleton and factory helpers', async () => {
    const { createEmbeddingWorker, getEmbeddingWorker, EmbeddingWorker } = await loadWorkerModule();

    expect(getEmbeddingWorker()).toBe(getEmbeddingWorker());
    expect(createEmbeddingWorker()).toBeInstanceOf(EmbeddingWorker);
  });
});
