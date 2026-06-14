/**
 * Meeting API — IPC wrappers for the meeting recorder pipeline.
 *
 * Audio bytes go over the wire as ArrayBuffer (structured-clone handles
 * Transferables transparently). For v1 we send one chunk per recording;
 * future streaming variants call APPEND_AUDIO multiple times.
 */

import { z } from 'zod';
import { invokeIpc } from '@renderer/lib/ipc';
import { MEETING_CHANNELS } from '@shared/constants/ipcChannels';
import type {
  IpcResponse,
  MeetingRecording,
  MeetingRecordingStatus,
  MeetingTranscriptSegment,
  RecordingSlot,
} from '@shared/types';
import { validateResponse } from './validation';

const StatusSchema: z.ZodType<MeetingRecordingStatus> = z.enum([
  'recording',
  'transcribing',
  'summarizing',
  'ready',
  'failed',
]);

const TranscriptSegmentSchema = z.object({
  text: z.string(),
  startMs: z.number(),
  endMs: z.number(),
  source: z.enum(['mic', 'system']).optional(),
});

// Drizzle gives Date instances for createdAt/updatedAt; the IPC bridge
// passes them through structured-clone so they arrive as Dates on this side.
const DateLike = z.union([z.date(), z.string(), z.number()]).transform((v) => new Date(v));

const MeetingRecordingSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  status: StatusSchema,
  audioPath: z.string().nullable(),
  durationMs: z.number(),
  transcriptText: z.string().nullable(),
  transcriptSegments: z.array(TranscriptSegmentSchema),
  summary: z.string().nullable(),
  promptUsed: z.string().nullable(),
  journalDate: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: DateLike,
  updatedAt: DateLike,
});

const RecordingSlotSchema: z.ZodType<RecordingSlot> = z.object({
  recordingId: z.string(),
  audioAbsolutePath: z.string(),
  systemAudio: z.boolean().optional(),
});

const ListResponseSchema = z.object({
  recordings: z.array(MeetingRecordingSchema),
  nextCursor: z.number().nullable(),
});

const FinalizeResponseSchema = z.object({
  recording: MeetingRecordingSchema,
});

const GetResponseSchema = z.object({
  recording: MeetingRecordingSchema.nullable(),
});

const ResummarizeResponseSchema = z.object({
  recording: MeetingRecordingSchema,
});

const SendToJournalResponseSchema = z.object({
  recording: MeetingRecordingSchema,
  journalNoteId: z.string(),
});

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
  ): Promise<IpcResponse<{ recording: MeetingRecording }>> => {
    const response = await invokeIpc(MEETING_CHANNELS.FINALIZE, { recordingId, durationMs });
    return validateResponse(response, FinalizeResponseSchema);
  },

  /** Live draft: start/stop the resident model, transcribe raw WAV chunks
   *  during recording. Not zod-validated — small trusted payloads. */
  liveStart: async (): Promise<IpcResponse<void>> => {
    return invokeIpc(MEETING_CHANNELS.LIVE_START, {});
  },
  transcribeLiveChunk: async (
    wav: ArrayBuffer,
  ): Promise<IpcResponse<{ text: string; segments: MeetingTranscriptSegment[] }>> => {
    return invokeIpc(MEETING_CHANNELS.LIVE_CHUNK, { wav });
  },
  liveStop: async (): Promise<IpcResponse<void>> => {
    return invokeIpc(MEETING_CHANNELS.LIVE_STOP, {});
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
    return validateResponse(response, ListResponseSchema);
  },

  get: async (
    recordingId: string,
  ): Promise<IpcResponse<{ recording: MeetingRecording | null }>> => {
    const response = await invokeIpc(MEETING_CHANNELS.GET, { recordingId });
    return validateResponse(response, GetResponseSchema);
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
    return validateResponse(response, ResummarizeResponseSchema);
  },

  retranscribe: async (
    recordingId: string,
  ): Promise<IpcResponse<{ recording: MeetingRecording }>> => {
    const response = await invokeIpc(MEETING_CHANNELS.RETRANSCRIBE, { recordingId });
    return validateResponse(response, FinalizeResponseSchema);
  },

  sendToJournal: async (
    recordingId: string,
    journalDate?: string,
  ): Promise<IpcResponse<{ recording: MeetingRecording; journalNoteId: string }>> => {
    const response = await invokeIpc(MEETING_CHANNELS.SEND_TO_JOURNAL, {
      recordingId,
      journalDate,
    });
    return validateResponse(response, SendToJournalResponseSchema);
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
};
