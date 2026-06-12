import { describe, expect, it, vi } from 'vitest';
import {
  WhisperTranscriber,
  type TranscriberWorkerClient,
} from '../../../../../src/main/adapters/out/integrations/WhisperTranscriber';

function worker(overrides: Partial<TranscriberWorkerClient> = {}): TranscriberWorkerClient {
  return {
    isTranscriberReady: vi.fn().mockReturnValue(true),
    initializeTranscriber: vi.fn(),
    transcribe: vi.fn().mockResolvedValue({
      text: 'hello',
      segments: [{ text: 'hello', startMs: 0, endMs: 250 }],
      durationMs: 250,
    }),
    ...overrides,
  };
}

describe('WhisperTranscriber', () => {
  it('does not initialize when the transcriber is already ready', async () => {
    const client = worker();
    const transcriber = new WhisperTranscriber({ workerService: client });

    await transcriber.initialize();

    expect(transcriber.isReady()).toBe(true);
    expect(client.initializeTranscriber).not.toHaveBeenCalled();
  });

  it('initializes lazily before transcribing', async () => {
    const client = worker({ isTranscriberReady: vi.fn().mockReturnValue(false) });
    const transcriber = new WhisperTranscriber({ workerService: client });

    const result = await transcriber.transcribe({ audioPath: '/tmp/audio.wav' });

    expect(client.initializeTranscriber).toHaveBeenCalledWith();
    expect(client.transcribe).toHaveBeenCalledWith('/tmp/audio.wav');
    expect(result).toMatchObject({ text: 'hello', durationMs: 250 });
  });

  it('surfaces worker initialization failures', async () => {
    const client = worker({
      isTranscriberReady: vi.fn().mockReturnValue(false),
      initializeTranscriber: vi.fn().mockRejectedValue(new Error('model missing')),
    });

    await expect(new WhisperTranscriber({ workerService: client }).transcribe({ audioPath: '/tmp/audio.wav' }))
      .rejects.toThrow('model missing');
  });
});
