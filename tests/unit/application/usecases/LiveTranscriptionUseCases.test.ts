import { describe, expect, it, vi } from 'vitest';
import { createLiveTranscriptionUseCases } from '../../../../src/main/application/usecases/meeting/LiveTranscriptionUseCases';
import type { ILiveTranscriber } from '../../../../src/main/domain';

function createLiveTranscriber(): ILiveTranscriber {
  return {
    isReady: vi.fn(() => true),
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
    transcribeChunk: vi.fn(async () => ({ text: 'hello', segments: [] })),
  };
}

describe('createLiveTranscriptionUseCases', () => {
  it('rejects chunks from a stopped session', async () => {
    const live = createLiveTranscriber();
    const useCases = createLiveTranscriptionUseCases(live);

    await useCases.start({ sessionId: 'session-a' });
    await useCases.stop({ sessionId: 'session-a' });

    await expect(
      useCases.transcribeChunk({ sessionId: 'session-a', wav: new ArrayBuffer(1) }),
    ).rejects.toThrow('stale live transcription session');
    expect(live.transcribeChunk).not.toHaveBeenCalled();
  });

  it('ignores a stale stop without terminating the active session', async () => {
    const live = createLiveTranscriber();
    const useCases = createLiveTranscriptionUseCases(live);

    await useCases.start({ sessionId: 'session-a' });
    await useCases.start({ sessionId: 'session-b' });
    await useCases.stop({ sessionId: 'session-a' });
    await useCases.transcribeChunk({ sessionId: 'session-b', wav: new ArrayBuffer(1) });

    expect(live.stop).toHaveBeenCalledTimes(1);
    expect(live.transcribeChunk).toHaveBeenCalledTimes(1);
  });
});
