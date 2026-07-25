/**
 * Meeting API — IPC wrappers for the meeting recorder pipeline.
 *
 * Audio bytes go over the wire as ArrayBuffer (structured-clone handles
 * Transferables transparently). For v1 we send one chunk per recording;
 * future streaming variants call APPEND_AUDIO multiple times.
 */

import {
  FinalizeMeetingResponseSchema,
  GetMeetingResponseSchema,
  ListMeetingsResponseSchema,
  MeetingRecordingResponseSchema,
  RecordingSlotSchema,
  SendMeetingToJournalResponseSchema,
} from '@shared/schemas';
import { invokeIpc } from '@renderer/lib/ipc';
import { EVENTS, MEETING_CHANNELS } from '@shared/constants/ipcChannels';

/** Unsubscribe handle returned by event subscriptions. */
type Unsubscribe = () => void;
import type {
  IpcResponse,
  MeetingRecording,
  MeetingTranscriptSegment,
  RecordingSlot,
} from '@shared/types';
import { validateResponse } from './validation';

export const meetingAPI = {
  reserveSlot: async (input?: {
    workspaceId?: string;
    title?: string;
  }): Promise<IpcResponse<RecordingSlot>> => {
    const response = await invokeIpc(MEETING_CHANNELS.RESERVE_SLOT, input ?? {});
    return validateResponse(response, RecordingSlotSchema);
  },

  appendAudio: async (
    recordingId: string,
    chunk: ArrayBuffer,
    channel: 'mic' | 'system' = 'mic',
  ): Promise<IpcResponse<void>> => {
    return invokeIpc(MEETING_CHANNELS.APPEND_AUDIO, { recordingId, chunk, channel });
  },

  finalize: async (
    recordingId: string,
    durationMs: number,
  ): Promise<IpcResponse<{ jobId: string }>> => {
    const response = await invokeIpc(MEETING_CHANNELS.FINALIZE, { recordingId, durationMs });
    return validateResponse(response, FinalizeMeetingResponseSchema);
  },

  /** Live draft: start/stop the resident model, transcribe raw WAV chunks
   *  during recording. Not zod-validated — small trusted payloads. */
  liveStart: async (): Promise<IpcResponse<void>> => {
    return invokeIpc(MEETING_CHANNELS.LIVE_START);
  },
  transcribeLiveChunk: async (
    wav: ArrayBuffer,
  ): Promise<IpcResponse<{ text: string; segments: MeetingTranscriptSegment[] }>> => {
    return invokeIpc(MEETING_CHANNELS.LIVE_CHUNK, { wav });
  },
  liveStop: async (): Promise<IpcResponse<void>> => {
    return invokeIpc(MEETING_CHANNELS.LIVE_STOP);
  },

  /** Raw WAV bytes for playback (mic + optional system track). Not zod-validated
   *  — binary payload from our own main process. */
  getAudio: async (
    recordingId: string,
  ): Promise<IpcResponse<{ mic: Uint8Array | null; system: Uint8Array | null }>> => {
    return invokeIpc(MEETING_CHANNELS.GET_AUDIO, { recordingId });
  },

  list: async (input?: {
    workspaceId?: string;
    limit?: number;
    cursor?: number;
  }): Promise<IpcResponse<{ recordings: MeetingRecording[]; nextCursor: number | null }>> => {
    const response = await invokeIpc(MEETING_CHANNELS.LIST, input ?? {});
    return validateResponse(response, ListMeetingsResponseSchema);
  },

  get: async (
    recordingId: string,
  ): Promise<IpcResponse<{ recording: MeetingRecording | null }>> => {
    const response = await invokeIpc(MEETING_CHANNELS.GET, { recordingId });
    return validateResponse(response, GetMeetingResponseSchema);
  },

  delete: async (recordingId: string): Promise<IpcResponse<void>> => {
    return invokeIpc(MEETING_CHANNELS.DELETE, { recordingId });
  },

  resummarize: async (
    recordingId: string,
    promptTemplate?: string,
  ): Promise<IpcResponse<{ recording: MeetingRecording }>> => {
    const response = await invokeIpc(MEETING_CHANNELS.RESUMMARIZE, {
      recordingId,
      promptTemplate,
    });
    return validateResponse(response, MeetingRecordingResponseSchema);
  },

  retranscribe: async (
    recordingId: string,
  ): Promise<IpcResponse<{ recording: MeetingRecording }>> => {
    const response = await invokeIpc(MEETING_CHANNELS.RETRANSCRIBE, { recordingId });
    return validateResponse(response, MeetingRecordingResponseSchema);
  },

  sendToJournal: async (
    recordingId: string,
    journalDate?: string,
  ): Promise<IpcResponse<{ recording: MeetingRecording; journalNoteId: string }>> => {
    const response = await invokeIpc(MEETING_CHANNELS.SEND_TO_JOURNAL, {
      recordingId,
      journalDate,
    });
    return validateResponse(response, SendMeetingToJournalResponseSchema);
  },

  /**
   * Push recorder phase to main so the menu bar tray can reflect it.
   * Fire-and-forget — failure here shouldn't break anything user-facing.
   * The accepted phases mirror the renderer's RecorderPhase, not the
   * persisted DB status (those are separate state machines).
   */
  setTrayState: async (
    phase: 'idle' | 'preparing' | 'recording' | 'uploading' | 'finalizing' | 'done' | 'error',
  ): Promise<void> => {
    try {
      await invokeIpc(MEETING_CHANNELS.TRAY_SET_STATE, { phase });
    } catch {
      // best-effort — tray state isn't worth surfacing failures for.
    }
  },

  /**
   * Subscribe to background-pipeline status pushes. `finalize()` now enqueues
   * a durable job and returns immediately; the main process pushes the
   * recording on each transition ('transcribing' → 'summarizing' →
   * 'ready' | 'failed') over EVENTS.MEETING_STATUS_CHANGED.
   *
   * Returns an unsubscribe function. The payload is zod-validated; malformed
   * events are dropped silently rather than crashing a listener.
   */
  onStatusChanged: (cb: (recording: MeetingRecording) => void): Unsubscribe => {
    const off = window.electron.on(EVENTS.MEETING_STATUS_CHANGED, (payload: unknown) => {
      const parsed = MeetingRecordingResponseSchema.safeParse(payload);
      if (parsed.success) cb(parsed.data.recording);
    });
    return () => off?.();
  },
};
