/**
 * Live transcription use cases — thin orchestration over the resident
 * ILiveTranscriber for the fast raw draft shown while recording. The accurate,
 * echo-cancelled transcript is still produced by FinalizeRecordingUseCase.
 */

import type { ILiveTranscriber, ILiveTranscriptionUseCases } from '../../../domain';

export function createLiveTranscriptionUseCases(
  live?: ILiveTranscriber,
): ILiveTranscriptionUseCases {
  let activeSessionId: string | null = null;
  // No live transcriber wired (tests / unsupported build) → harmless no-op so
  // the facade is always complete and recording still works without a draft.
  return {
    start: async ({ sessionId }) => {
      if (activeSessionId && activeSessionId !== sessionId && live) await live.stop();
      activeSessionId = sessionId;
      if (live) await live.start();
    },
    transcribeChunk: async (request) => {
      if (request.sessionId !== activeSessionId) {
        throw new Error('stale live transcription session');
      }
      return live
        ? live.transcribeChunk(new Uint8Array(request.wav))
        : { text: '', segments: [] };
    },
    stop: async ({ sessionId }) => {
      if (sessionId !== activeSessionId) return;
      activeSessionId = null;
      if (live) await live.stop();
    },
  };
}
