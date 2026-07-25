/**
 * Live transcription use cases — thin orchestration over the resident
 * ILiveTranscriber for the fast raw draft shown while recording. The accurate,
 * echo-cancelled transcript is still produced by FinalizeRecordingUseCase.
 */

import type { ILiveTranscriber, ILiveTranscriptionUseCases } from '../../../domain';

export function createLiveTranscriptionUseCases(
  live?: ILiveTranscriber,
): ILiveTranscriptionUseCases {
  // No live transcriber wired (tests / unsupported build) → harmless no-op so
  // the facade is always complete and recording still works without a draft.
  return {
    start: async () => {
      if (live) await live.start();
    },
    transcribeChunk: async (request) => {
      return live ? live.transcribeChunk(new Uint8Array(request.wav)) : { text: '', segments: [] };
    },
    stop: async () => {
      if (live) await live.stop();
    },
  };
}
