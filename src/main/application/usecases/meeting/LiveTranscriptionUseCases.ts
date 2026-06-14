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
    start: () => (live ? live.start() : Promise.resolve()),
    transcribeChunk: (request) =>
      live
        ? live.transcribeChunk(new Uint8Array(request.wav))
        : Promise.resolve({ text: '', segments: [] }),
    stop: () => (live ? live.stop() : Promise.resolve()),
  };
}
