/**
 * meetingRecorderStore — state machine + IPC for the active recording
 * session. The hook (useMeetingRecorder) owns only MediaRecorder and
 * AudioContext orchestration; all server-bound calls go through here.
 *
 * State graph:
 *   idle → preparing → recording → uploading → finalizing → done
 *                            └────────────────────┴────────→ error
 *
 * `dock` flag controls whether the floating recording dock is visible.
 */

import { create } from 'zustand';
import { meetingAPI } from '@renderer/api';
import { handleIpcResponse } from '@renderer/lib/ipc';
import { logger } from '@renderer/lib/logger';
import type { MeetingRecording } from '@shared/types';

export type RecorderPhase =
  | 'idle'
  | 'preparing'
  | 'recording'
  | 'uploading'
  | 'finalizing'
  | 'done'
  | 'error';

interface MeetingRecorderState {
  dock: boolean;
  phase: RecorderPhase;
  recordingId: string | null;
  audioPath: string | null;
  startedAt: number | null;
  elapsedMs: number;
  /** Smoothed peak level in [0, 1], updated by the hook from an AnalyserNode. */
  audioLevel: number;
  error: string | null;
  lastRecording: MeetingRecording | null;

  // Dock visibility
  openDock: () => void;
  closeDock: () => void;

  // Lifecycle (called by the hook in response to MediaRecorder events)
  reserveSlot: () => Promise<{ recordingId: string; audioPath: string } | null>;
  markRecordingStarted: (slot: { recordingId: string; audioPath: string }) => void;
  tickElapsed: (ms: number) => void;
  setAudioLevel: (level: number) => void;
  uploadAndFinalize: (wav: ArrayBuffer, durationMs: number) => Promise<void>;
  cancelActive: () => Promise<void>;
  markError: (message: string) => void;
  reset: () => void;
}

const initial = {
  dock: false,
  phase: 'idle' as RecorderPhase,
  recordingId: null,
  audioPath: null,
  startedAt: null,
  elapsedMs: 0,
  audioLevel: 0,
  error: null,
  lastRecording: null,
};

export const useMeetingRecorderStore = create<MeetingRecorderState>((set, get) => ({
  ...initial,
  openDock: () => set({ dock: true }),
  closeDock: () => set({ dock: false }),

  reserveSlot: async () => {
    set({ phase: 'preparing', error: null });
    try {
      const result = handleIpcResponse(
        await meetingAPI.reserveSlot(),
        'Failed to reserve recording slot',
      );
      if (!result.success) {
        set({ phase: 'error', error: result.error });
        return null;
      }
      return {
        recordingId: result.data.recordingId,
        audioPath: result.data.audioAbsolutePath,
      };
    } catch (err) {
      logger.error('[meetingRecorderStore] reserveSlot failed', err);
      set({ phase: 'error', error: err instanceof Error ? err.message : 'Failed to start' });
      return null;
    }
  },

  markRecordingStarted: (slot) =>
    set({
      phase: 'recording',
      recordingId: slot.recordingId,
      audioPath: slot.audioPath,
      startedAt: Date.now(),
      elapsedMs: 0,
      error: null,
      lastRecording: null,
    }),

  tickElapsed: (ms) => set({ elapsedMs: ms }),
  setAudioLevel: (level) => set({ audioLevel: level }),

  uploadAndFinalize: async (wav, durationMs) => {
    const recordingId = get().recordingId;
    if (!recordingId) {
      set({ phase: 'error', error: 'Recording id is missing' });
      return;
    }

    set({ phase: 'uploading' });
    try {
      const writeRes = await meetingAPI.appendAudio(recordingId, wav);
      if (!writeRes.success) {
        set({ phase: 'error', error: writeRes.error?.message ?? 'Failed to upload audio' });
        return;
      }

      set({ phase: 'finalizing' });
      const finalizeRes = await meetingAPI.finalize(recordingId, durationMs);
      if (!finalizeRes.success || !finalizeRes.data) {
        set({
          phase: 'error',
          error: finalizeRes.error?.message ?? 'Failed to finalize recording',
        });
        return;
      }
      const recording = finalizeRes.data.recording;
      if (recording.status === 'failed') {
        set({ phase: 'error', error: recording.error ?? 'Pipeline failed' });
        return;
      }
      set({ phase: 'done', lastRecording: recording });
    } catch (err) {
      logger.error('[meetingRecorderStore] uploadAndFinalize failed', err);
      set({
        phase: 'error',
        error: err instanceof Error ? err.message : 'Recording failed',
      });
    }
  },

  cancelActive: async () => {
    const recordingId = get().recordingId;
    if (recordingId) {
      try {
        await meetingAPI.delete(recordingId);
      } catch (err) {
        logger.warn('[meetingRecorderStore] cancel delete failed', err);
      }
    }
    set({ ...initial, dock: false });
  },

  markError: (message) => set({ phase: 'error', error: message }),
  reset: () => set({ ...initial, dock: false }),
}));
