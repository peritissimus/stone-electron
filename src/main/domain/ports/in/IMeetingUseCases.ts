/**
 * Meeting Use Cases Port
 *
 * Contract for the in-app meeting recorder. The capture itself happens
 * in the renderer (MediaRecorder); these use cases own the post-capture
 * pipeline (transcribe → summarize → persist), the management surface
 * (list/get/delete/resummarize), and the explicit "send to journal"
 * action.
 *
 * Per the agreed UX: re-summarizing a meeting only updates the meeting
 * row; the journal is only ever touched by `sendToJournal` so the user
 * stays in control.
 */

import { Context } from 'effect';
import type { Effect } from 'effect';
import type { MeetingRecordingProps } from '../../entities';
import type { LiveChunkResult } from '../out/ILiveTranscriber';

// ---------- Reserve recording slot (renderer prepares to capture) ----------

export interface ReserveRecordingSlotRequest {
  workspaceId?: string;
  /** Optional custom title; if omitted, defaults to `Meeting YYYY-MM-DD HH:mm`. */
  title?: string;
}

export interface ReserveRecordingSlotResponse {
  recordingId: string;
  /** Absolute audio path the renderer should write bytes to (via IPC). */
  audioAbsolutePath: string;
  /** True when the native system-audio tap started (macOS, permission granted). */
  systemAudio: boolean;
}

// ---------- Finalize: ingest captured audio and run the pipeline ----------

export interface FinalizeRecordingRequest {
  recordingId: string;
  /** Total captured duration in ms (renderer is authoritative). */
  durationMs: number;
}

export interface FinalizeRecordingResponse {
  recording: MeetingRecordingProps;
}

export interface RequestFinalizeRecordingResponse {
  jobId: string;
}

export interface FinalizeRecordingOptions {
  /** Internal cancellation propagated by the durable job runner. */
  signal?: AbortSignal;
}

// ---------- Append captured audio bytes from the renderer ----------

export interface AppendRecordingAudioRequest {
  recordingId: string;
  /** Complete WAV bytes for one capture source. */
  chunk: ArrayBuffer;
  /** Which track: the mic (default) or the system-audio sibling file. */
  channel?: 'mic' | 'system';
}

/** Relative path of the system-audio track, derived from the mic audioPath. */
export function systemTrackPath(micAudioPath: string): string {
  return micAudioPath.replace(/\.wav$/i, '.system.wav');
}

// ---------- List + get + delete (management surface) ----------

export interface ListMeetingRecordingsRequest {
  workspaceId?: string;
  limit?: number;
  cursor?: number; // unix ms
}

export interface ListMeetingRecordingsResponse {
  recordings: MeetingRecordingProps[];
  nextCursor: number | null;
}

export interface GetMeetingRecordingRequest {
  recordingId: string;
}

export interface GetMeetingRecordingResponse {
  recording: MeetingRecordingProps | null;
}

export interface DeleteMeetingRecordingRequest {
  recordingId: string;
}

// ---------- Re-summarize (updates the row only) ----------

export interface ResummarizeMeetingRequest {
  recordingId: string;
  /** Optional override; falls back to the configured default prompt. */
  promptTemplate?: string;
}

export interface ResummarizeMeetingResponse {
  recording: MeetingRecordingProps;
}

// ---------- Re-transcribe (re-run the pipeline on kept audio) ----------

export interface RetranscribeMeetingRequest {
  recordingId: string;
}

export interface RetranscribeMeetingResponse {
  recording: MeetingRecordingProps;
}

// ---------- Prune audio (retention sweep) ----------

export interface PruneRecordingAudioResponse {
  /** How many recordings had their audio deleted in this sweep. */
  deletedCount: number;
}

// ---------- Send to journal (always appends fresh) ----------

export interface SendToJournalRequest {
  recordingId: string;
  /** Optional date override; defaults to today. */
  journalDate?: string;
}

export interface SendToJournalResponse {
  recording: MeetingRecordingProps;
  journalNoteId: string;
}

export interface GetMeetingAudioResponse {
  /** Mic-track WAV bytes, or null if the recording has no/deleted audio. */
  mic: Uint8Array | null;
  /** System-track WAV bytes, or null when mic-only. */
  system: Uint8Array | null;
}

/**
 * Deletes audio for recordings older than the configured retention window.
 * Transcript + summary are preserved; only the audio files are removed.
 * Internal maintenance task run at startup — not exposed over IPC.
 */
// ---------- Warm up the transcriber (preload the Whisper model) ----------

export interface WarmUpTranscriberResponse {
  /** True once the Whisper model is loaded and ready to transcribe. */
  ready: boolean;
}

// ---------- Native Effect use-case service ----------

export interface IMeetingUseCases {
  reserveRecordingSlot: {
    execute: (
      request: ReserveRecordingSlotRequest,
    ) => Effect.Effect<ReserveRecordingSlotResponse, Error>;
  };
  appendRecordingAudio: {
    execute: (
      request: AppendRecordingAudioRequest,
    ) => Effect.Effect<void, Error>;
  };
  /** Producer: enqueues the finalize job and returns immediately (IPC-facing). */
  requestFinalize: {
    execute: (
      request: FinalizeRecordingRequest,
    ) => Effect.Effect<RequestFinalizeRecordingResponse, Error>;
  };
  /** The actual pipeline; invoked by the background job handler, not over IPC. */
  finalizeRecording: {
    execute: (
      request: FinalizeRecordingRequest,
      options?: FinalizeRecordingOptions,
    ) => Effect.Effect<FinalizeRecordingResponse, Error>;
  };
  listMeetingRecordings: {
    execute: (
      request: ListMeetingRecordingsRequest,
    ) => Effect.Effect<ListMeetingRecordingsResponse, Error>;
  };
  getMeetingRecording: {
    execute: (
      request: GetMeetingRecordingRequest,
    ) => Effect.Effect<GetMeetingRecordingResponse, Error>;
  };
  getMeetingAudio: {
    execute: (
      request: { recordingId: string },
    ) => Effect.Effect<GetMeetingAudioResponse, Error>;
  };
  deleteMeetingRecording: {
    execute: (
      request: DeleteMeetingRecordingRequest,
    ) => Effect.Effect<void, Error>;
  };
  resummarizeMeeting: {
    execute: (
      request: ResummarizeMeetingRequest,
    ) => Effect.Effect<ResummarizeMeetingResponse, Error>;
  };
  retranscribeMeeting: {
    execute: (
      request: RetranscribeMeetingRequest,
    ) => Effect.Effect<RetranscribeMeetingResponse, Error>;
  };
  sendToJournal: {
    execute: (
      request: SendToJournalRequest,
    ) => Effect.Effect<SendToJournalResponse, Error>;
  };
  pruneRecordingAudio: {
    execute: () => Effect.Effect<PruneRecordingAudioResponse, Error>;
  };
  warmUpTranscriber: {
    execute: () => Effect.Effect<WarmUpTranscriberResponse, never>;
  };
  liveTranscription: {
    start: () => Effect.Effect<void, Error>;
    transcribeChunk: (
      request: { wav: ArrayBuffer },
    ) => Effect.Effect<LiveChunkResult, Error>;
    stop: () => Effect.Effect<void, Error>;
  };
}

export const MeetingUseCasesPort =
  Context.GenericTag<IMeetingUseCases>('stone/IMeetingUseCases');
