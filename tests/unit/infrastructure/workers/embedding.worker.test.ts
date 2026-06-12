import { beforeEach, describe, expect, it, vi } from 'vitest';

const parentPortMock = vi.hoisted(() => ({
  handlers: new Map<string, (...args: any[]) => unknown>(),
  postMessage: vi.fn(),
  on: vi.fn((event: string, callback: (...args: any[]) => unknown) => {
    parentPortMock.handlers.set(event, callback);
  }),
}));

const fsMock = vi.hoisted(() => ({
  readFile: vi.fn(),
}));

const transformersMock = vi.hoisted(() => ({
  env: {} as Record<string, unknown>,
  pipeline: vi.fn(),
}));

vi.mock('worker_threads', () => ({
  parentPort: parentPortMock,
  workerData: { cacheDir: '/tmp/stone-model-cache' },
}));

vi.mock('node:fs', () => ({
  promises: {
    readFile: fsMock.readFile,
  },
}));

vi.mock('@xenova/transformers', () => transformersMock);

async function loadWorkerScript() {
  vi.resetModules();
  await import('../../../../src/main/infrastructure/workers/embedding.worker');
  const handler = parentPortMock.handlers.get('message');
  if (!handler) throw new Error('worker message handler not registered');
  return handler;
}

function wavBuffer(samples: number[]) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(16_000, 24);
  buffer.writeUInt32LE(32_000, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);
  samples.forEach((sample, index) => buffer.writeInt16LE(sample, 44 + index * 2));
  return buffer;
}

describe('embedding.worker script', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parentPortMock.handlers.clear();
    transformersMock.env = {};
    transformersMock.pipeline.mockImplementation(async (task: string, _model: string, options?: any) => {
      options?.progress_callback?.({
        status: 'progress',
        file: 'model.onnx',
        loaded: 50,
        total: 100,
        progress: 50,
      });

      if (task === 'feature-extraction') {
        return async (text: string) => ({ data: new Float32Array([text.length, 1]) });
      }
      if (task === 'text-classification') {
        return async () => [{ label: 'LABEL_0', score: 0.42 }];
      }
      return async () => ({
        text: 'transcribed text',
        chunks: [{ text: 'transcribed', timestamp: [0, 0.5] }],
      });
    });
    fsMock.readFile.mockResolvedValue(wavBuffer([0, 16_384, -16_384]));
  });

  it('signals readiness and handles init, embedding, batch, ping, and shutdown messages', async () => {
    const handler = await loadWorkerScript();

    expect(parentPortMock.postMessage).toHaveBeenCalledWith({ type: 'ready' });

    await handler({ type: 'init', id: '1' });
    expect(parentPortMock.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '1',
        success: true,
        data: { model: 'Xenova/bge-small-en-v1.5', dims: 384 },
      }),
    );
    expect(transformersMock.env).toMatchObject({
      allowLocalModels: true,
      useBrowserCache: false,
      cacheDir: '/tmp/stone-model-cache',
    });
    expect(parentPortMock.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'downloadProgress', file: 'model.onnx' }),
    );

    await handler({ type: 'embed', id: '2', text: 'hello' });
    expect(parentPortMock.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: '2', success: true, data: [5, 1] }),
    );

    await handler({ type: 'batchEmbed', id: '3', texts: ['a', '', 'abc'] });
    const batchResponse = parentPortMock.postMessage.mock.calls.at(-1)?.[0];
    expect(batchResponse.id).toBe('3');
    expect(batchResponse.success).toBe(true);
    expect(batchResponse.data[0]).toEqual([1, 1]);
    expect(batchResponse.data[1]).toHaveLength(384);
    expect(batchResponse.data[2]).toEqual([3, 1]);

    await handler({ type: 'ping', id: '4' });
    expect(parentPortMock.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: '4', success: true }),
    );

    await handler({ type: 'shutdown', id: '5' });
    expect(parentPortMock.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: '5', success: true }),
    );
  });

  it('handles reranking and transcribing requests', async () => {
    const handler = await loadWorkerScript();

    await handler({ type: 'initReranker', id: 'r1' });
    expect(parentPortMock.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'r1',
        success: true,
        data: { model: 'Xenova/ms-marco-MiniLM-L-6-v2' },
      }),
    );

    await handler({ type: 'rerank', id: 'r2', query: 'query', texts: ['doc'] });
    expect(parentPortMock.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'r2', success: true, data: [0.42] }),
    );

    await handler({ type: 'initTranscriber', id: 't1' });
    expect(parentPortMock.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 't1',
        success: true,
        data: { model: 'Xenova/whisper-base.en' },
      }),
    );

    await handler({ type: 'transcribe', id: 't2', audioPath: '/tmp/audio.wav' });
    expect(parentPortMock.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 't2',
        success: true,
        data: {
          text: 'transcribed text',
          durationMs: 0,
          segments: [{ text: 'transcribed', startMs: 0, endMs: 500 }],
        },
      }),
    );
  });

  it('responds with errors for unknown messages and invalid WAV files', async () => {
    const handler = await loadWorkerScript();

    await handler({ type: 'missing', id: 'x1' });
    expect(parentPortMock.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'x1',
        success: false,
        error: 'Unknown message type: missing',
      }),
    );

    fsMock.readFile.mockResolvedValueOnce(Buffer.from('not wave'));
    await handler({ type: 'transcribe', id: 'x2', audioPath: '/tmp/bad.wav' });
    expect(parentPortMock.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'x2',
        success: false,
        error: 'audio file is not a RIFF/WAVE container',
      }),
    );
  });
});
