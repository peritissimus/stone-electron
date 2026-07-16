/**
 * Voice Capture Store — state machine for the quick "speak → journal" flow.
 *
 * idle → recording → transcribing → idle (saved) | error
 *
 * The MediaRecorder hardware lives in useVoiceCapture (the dock owns that
 * hook instance); this store holds phase + IPC so any surface can open the
 * dock by flipping `open`.
 */

import { create } from 'zustand';
import { quickCaptureAPI } from '@renderer/api';

export type VoiceCapturePhase = 'idle' | 'recording' | 'transcribing' | 'error';

export interface VoiceCaptureSaved {
  noteId: string;
  text: string;
}

interface VoiceCaptureState {
  /** Dock visibility — opening auto-starts a recording. */
  open: boolean;
  phase: VoiceCapturePhase;
  elapsedMs: number;
  audioLevel: number;
  error: string | null;

  /** Open the dock (the dock starts recording when it sees this). */
  requestOpen: () => void;
  /** Close the dock; only meaningful from idle/error. */
  close: () => void;

  markRecordingStarted: () => void;
  tickElapsed: (ms: number) => void;
  setAudioLevel: (level: number) => void;
  markError: (message: string) => void;
  reset: () => void;

  /**
   * Transcribe the WAV and append the transcript to today's journal.
   * Returns the saved note info, or null when nothing was heard / failed
   * (failure details land in `error`).
   */
  transcribeAndAppend: (wav: ArrayBuffer) => Promise<VoiceCaptureSaved | null>;
}

export const useVoiceCaptureStore = create<VoiceCaptureState>((set) => ({
  open: false,
  phase: 'idle',
  elapsedMs: 0,
  audioLevel: 0,
  error: null,

  requestOpen: () => set({ open: true }),
  close: () => set({ open: false, phase: 'idle', elapsedMs: 0, audioLevel: 0, error: null }),

  markRecordingStarted: () => set({ phase: 'recording', elapsedMs: 0, error: null }),
  tickElapsed: (ms) => set({ elapsedMs: ms }),
  setAudioLevel: (level) => set({ audioLevel: level }),
  markError: (message) => set({ phase: 'error', error: message, audioLevel: 0 }),
  reset: () => set({ phase: 'idle', elapsedMs: 0, audioLevel: 0, error: null }),

  transcribeAndAppend: async (wav) => {
    set({ phase: 'transcribing', audioLevel: 0 });
    try {
      const transcribed = await quickCaptureAPI.transcribeVoice(wav);
      if (!transcribed.success || !transcribed.data) {
        set({
          phase: 'error',
          error: transcribed.error?.message ?? 'Transcription failed',
        });
        return null;
      }

      const text = transcribed.data.text.trim();
      // Whisper hallucinates filler on silent/near-silent audio: a lone "*" or
      // "...", or bracketed markers like "[BLANK_AUDIO]". Drop anything without
      // real alphanumeric content so junk never lands in the journal.
      const stripped = text.replace(/\[[^\]]*\]|\([^)]*\)/g, '');
      const hasSpeech = /[\p{L}\p{N}]/u.test(stripped);
      if (!hasSpeech) {
        set({ phase: 'error', error: "Didn't catch anything — try again closer to the mic." });
        return null;
      }

      const appended = await quickCaptureAPI.appendToJournal(text);
      if (!appended.success || !appended.data) {
        set({
          phase: 'error',
          error: appended.error?.message ?? 'Could not save to journal',
        });
        return null;
      }

      // Success: close the dock entirely — the hook fires the toast.
      set({ open: false, phase: 'idle', elapsedMs: 0, audioLevel: 0, error: null });
      return { noteId: appended.data.noteId, text };
    } catch (err) {
      set({
        phase: 'error',
        error: err instanceof Error ? err.message : 'Voice capture failed',
      });
      return null;
    }
  },
}));
