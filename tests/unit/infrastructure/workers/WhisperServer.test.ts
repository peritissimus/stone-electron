import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  WhisperServer,
  type WhisperSupervisor,
} from '../../../../src/main/infrastructure/workers/WhisperServer';

function supervisor(): WhisperSupervisor {
  return {
    isReady: vi.fn(() => true),
    ensureReady: vi.fn(async () => {}),
    markUnhealthy: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
  };
}

function response(text: string): Response {
  return {
    ok: true,
    json: vi.fn(async () => ({ text, segments: [] })),
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('WhisperServer session ownership', () => {
  it('serializes concurrent chunk requests inside the server', async () => {
    const pending: Array<(value: Response) => void> = [];
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => pending.push(resolve)));
    vi.stubGlobal('fetch', fetchMock);
    const server = new WhisperServer({ supervisor: supervisor() });
    await server.start();

    const first = server.transcribeChunk(new Uint8Array([1]));
    const second = server.transcribeChunk(new Uint8Array([2]));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    pending.shift()?.(response('first'));
    await expect(first).resolves.toMatchObject({ text: 'first' });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    pending.shift()?.(response('second'));
    await expect(second).resolves.toMatchObject({ text: 'second' });
  });

  it('aborts active work on session stop without clearing process health', async () => {
    const processSupervisor = supervisor();
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, options: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          options.signal?.addEventListener('abort', () => reject(options.signal?.reason), {
            once: true,
          });
        });
      }),
    );
    const server = new WhisperServer({ supervisor: processSupervisor });
    await server.start();
    const chunk = server.transcribeChunk(new Uint8Array([1]));

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    await server.stop();

    await expect(chunk).rejects.toThrow('session stopped');
    expect(processSupervisor.stop).not.toHaveBeenCalled();
    await server.shutdown();
    expect(processSupervisor.stop).toHaveBeenCalledOnce();
  });
});
