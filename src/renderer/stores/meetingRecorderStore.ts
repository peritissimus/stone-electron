/**
 * meetingRecorderStore — state machine + IPC for the active recording
 * session. The hook (useMeetingRecorder) owns only MediaRecorder and
 * AudioContext orchestration; all server-bound calls go through here.
 *
 * State graph:
 *   idle → preparing → recording → uploading → finalizing → done
 *                            └────────────────────┴────────→ error
 *
 * The finalize pipeline runs as a durable BACKGROUND job in main. The
 * meetingAPI.finalize() call only enqueues it and returns immediately, so
 * the store stays in 'finalizing' and resolves to 'done'/'error' only when
 * a `meetings:statusChanged` event arrives for the active recording with
 * status 'ready'/'failed' (see the module-level subscription below).
 * `finalizeStage` surfaces the intermediate 'transcribing'/'summarizing'
 * sub-state while phase stays 'finalizing'.
 *
 * `dock` flag controls whether the floating recording dock is visible.
 */

import { create } from 'zustand';
import { meetingAPI } from '@renderer/api';
import { handleIpcResponse } from '@renderer/lib/ipc';
import { logger } from '@renderer/lib/logger';
import type { MeetingRecording, MeetingRecordingStatus } from '@shared/types';

export type RecorderPhase =
  | 'idle'
  | 'preparing'
  | 'recording'
  | 'uploading'
  | 'finalizing'
  | 'done'
  | 'error';

export type CaptureMode = 'mic-only' | 'mic+system';

/** One line of the live (raw) draft shown while recording. */
export interface LiveLine {
  id: number;
  source: 'mic' | 'system';
  text: string;
}

interface MeetingRecorderState {
  dock: boolean;
  phase: RecorderPhase;
  recordingId: string | null;
  audioPath: string | null;
  startedAt: number | null;
  elapsedMs: number;
  /** Smoothed peak level in [0, 1], updated by the hook from an AnalyserNode. */
  audioLevel: number;
  /** Live system-audio peak in [0, 1], pushed from the native tap (macOS). */
  systemAudioLevel: number;
  /** Which sources we're capturing for the current session. */
  captureMode: CaptureMode;
  error: string | null;
  lastRecording: MeetingRecording | null;
  /**
   * Background-pipeline sub-state while `phase === 'finalizing'`. Mirrors the
   * persisted recording status so the dock can show "Transcribing…" vs
   * "Summarising…". Null outside the finalizing window.
   */
  finalizeStage: Extract<MeetingRecordingStatus, 'transcribing' | 'summarizing'> | null;
  /** Live (raw) draft lines, appended as chunks transcribe during recording. */
  liveLines: LiveLine[];

  // Dock visibility
  openDock: () => void;
  closeDock: () => void;

  // Lifecycle (called by the hook in response to MediaRecorder events)
  reserveSlot: () => Promise<{
    recordingId: string;
    audioPath: string;
    systemAudio: boolean;
  } | null>;
  markRecordingStarted: (slot: {
    recordingId: string;
    audioPath: string;
    captureMode: CaptureMode;
  }) => void;
  tickElapsed: (ms: number) => void;
  setAudioLevel: (level: number) => void;
  setSystemAudioLevel: (level: number) => void;
  uploadAndFinalize: (
    micWav: ArrayBuffer,
    systemWav: ArrayBuffer | null,
    durationMs: number,
  ) => Promise<void>;
  cancelActive: () => Promise<void>;
  markError: (message: string) => void;
  /**
   * Handle a background-pipeline status push for the active recording.
   * Resolves the finalizing phase: 'ready' → 'done', 'failed' → 'error',
   * intermediate statuses keep phase 'finalizing' and update finalizeStage.
   * Ignores events for other recordings.
   */
  _onStatusChanged: (recording: MeetingRecording) => void;
  appendLiveLine: (source: 'mic' | 'system', text: string) => void;
  clearLive: () => void;
  /** Warm the resident live model and reset the draft (recording start). */
  startLive: () => void;
  /** Tear down the resident live model (recording stop). */
  stopLive: () => void;
  /** Transcribe one live WAV chunk and append the result to the draft. */
  pushLiveChunk: (source: 'mic' | 'system', wav: ArrayBuffer) => Promise<void>;
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
  systemAudioLevel: 0,
  captureMode: 'mic-only' as CaptureMode,
  error: null,
  lastRecording: null,
  finalizeStage: null as
    | Extract<MeetingRecordingStatus, 'transcribing' | 'summarizing'>
    | null,
  liveLines: [] as LiveLine[],
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
        systemAudio: result.data.systemAudio ?? false,
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
      captureMode: slot.captureMode,
      startedAt: Date.now(),
      elapsedMs: 0,
      error: null,
      lastRecording: null,
    }),

  tickElapsed: (ms) => set({ elapsedMs: ms }),
  setAudioLevel: (level) => set({ audioLevel: level }),
  setSystemAudioLevel: (level) => set({ systemAudioLevel: level }),

  uploadAndFinalize: async (micWav, systemWav, durationMs) => {
    const recordingId = get().recordingId;
    if (!recordingId) {
      set({ phase: 'error', error: 'Recording id is missing' });
      return;
    }

    set({ phase: 'uploading' });
    try {
      const writeRes = await meetingAPI.appendAudio(recordingId, micWav, 'mic');
      if (!writeRes.success) {
        set({ phase: 'error', error: writeRes.error?.message ?? 'Failed to upload audio' });
        return;
      }
      if (systemWav) {
        const sysRes = await meetingAPI.appendAudio(recordingId, systemWav, 'system');
        if (!sysRes.success) {
          set({ phase: 'error', error: sysRes.error?.message ?? 'Failed to upload system audio' });
          return;
        }
      }

      // finalize() now only ENQUEUES the durable background pipeline and
      // returns the current recording immediately (status still e.g.
      // 'recording', NOT 'ready'). We stay in 'finalizing' and let the
      // `meetings:statusChanged` event (handled by _onStatusChanged) resolve
      // the phase to 'done'/'error' once the job completes.
      set({ phase: 'finalizing', finalizeStage: null });
      const finalizeRes = await meetingAPI.finalize(recordingId, durationMs);
      if (!finalizeRes.success || !finalizeRes.data) {
        set({
          phase: 'error',
          finalizeStage: null,
          error: finalizeRes.error?.message ?? 'Failed to finalize recording',
        });
        return;
      }
      // A job that fails synchronously at enqueue time still reports here.
      if (finalizeRes.data.recording.status === 'failed') {
        set({
          phase: 'error',
          finalizeStage: null,
          error: finalizeRes.data.recording.error ?? 'Pipeline failed',
        });
      }
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

  _onStatusChanged: (recording) => {
    const state = get();
    // Only react to the recording we're actively finalizing.
    if (state.recordingId !== recording.id) return;
    if (state.phase !== 'finalizing') return;

    switch (recording.status) {
      case 'ready':
        set({ phase: 'done', finalizeStage: null, lastRecording: recording, error: null });
        break;
      case 'failed':
        set({
          phase: 'error',
          finalizeStage: null,
          error: recording.error ?? 'Pipeline failed',
        });
        break;
      case 'transcribing':
      case 'summarizing':
        // Stay in 'finalizing'; surface the sub-stage for the dock label.
        set({ finalizeStage: recording.status });
        break;
      default:
        // 'recording' or any other interim status — keep waiting.
        break;
    }
  },

  appendLiveLine: (source, text) =>
    set((s) => ({ liveLines: [...s.liveLines, { id: s.liveLines.length, source, text }] })),
  clearLive: () => set({ liveLines: [] }),
  startLive: () => {
    get().clearLive();
    void meetingAPI.liveStart();
  },
  stopLive: () => {
    void meetingAPI.liveStop();
  },
  pushLiveChunk: async (source, wav) => {
    try {
      const res = await meetingAPI.transcribeLiveChunk(wav);
      const text = res.success && res.data ? res.data.text.trim() : '';
      if (text) get().appendLiveLine(source, text);
    } catch {
      // Live draft is best-effort; the clean transcript comes from finalize.
    }
  },
  reset: () => set({ ...initial, dock: false }),
}));

// Mirror phase changes to the menu-bar tray so it can update title /
// menu / icon. Subscribe once at module init; the comparison ensures
// we only push on actual transitions, not every set() (which fires on
// audio level updates ~60Hz).
let lastTrayPhase: RecorderPhase | null = null;
useMeetingRecorderStore.subscribe((state) => {
  if (state.phase !== lastTrayPhase) {
    lastTrayPhase = state.phase;
    void meetingAPI.setTrayState(state.phase);
  }
});

// Resolve the 'finalizing' phase from the durable background pipeline. The
// main process pushes the recording on each transition; the store handler
// ignores events for other recordings and moves to 'done'/'error' on
// 'ready'/'failed'. Subscribed once at module init.
meetingAPI.onStatusChanged((recording) => {
  useMeetingRecorderStore.getState()._onStatusChanged(recording);
});
