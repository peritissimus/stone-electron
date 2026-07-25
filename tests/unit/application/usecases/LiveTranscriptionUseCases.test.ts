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
  it('forwards lifecycle and chunks without owning session identity', async () => {
    const live = createLiveTranscriber();
    const useCases = createLiveTranscriptionUseCases(live);
    const wav = new ArrayBuffer(1);

    await useCases.start();
    await useCases.transcribeChunk({ wav });
    await useCases.stop();

    expect(live.start).toHaveBeenCalledOnce();
    expect(live.transcribeChunk).toHaveBeenCalledWith(new Uint8Array(wav));
    expect(live.stop).toHaveBeenCalledOnce();
  });

  it('stays a harmless facade when live transcription is unavailable', async () => {
    const useCases = createLiveTranscriptionUseCases();

    await expect(useCases.start()).resolves.toBeUndefined();
    await expect(useCases.transcribeChunk({ wav: new ArrayBuffer(1) })).resolves.toEqual({
      text: '',
      segments: [],
    });
    await expect(useCases.stop()).resolves.toBeUndefined();
  });
});
