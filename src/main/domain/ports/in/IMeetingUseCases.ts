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

// ---------- Use case interfaces ----------

export interface IReserveRecordingSlotUseCase {
  execute(request: ReserveRecordingSlotRequest): Promise<ReserveRecordingSlotResponse>;
}

export interface IAppendRecordingAudioUseCase {
  execute(request: AppendRecordingAudioRequest): Promise<void>;
}

export interface IFinalizeRecordingUseCase {
  execute(request: FinalizeRecordingRequest): Promise<FinalizeRecordingResponse>;
}

export interface IListMeetingRecordingsUseCase {
  execute(request: ListMeetingRecordingsRequest): Promise<ListMeetingRecordingsResponse>;
}

export interface IGetMeetingRecordingUseCase {
  execute(request: GetMeetingRecordingRequest): Promise<GetMeetingRecordingResponse>;
}

export interface GetMeetingAudioResponse {
  /** Mic-track WAV bytes, or null if the recording has no/deleted audio. */
  mic: Uint8Array | null;
  /** System-track WAV bytes, or null when mic-only. */
  system: Uint8Array | null;
}

export interface IGetMeetingAudioUseCase {
  execute(request: { recordingId: string }): Promise<GetMeetingAudioResponse>;
}

export interface IDeleteMeetingRecordingUseCase {
  execute(request: DeleteMeetingRecordingRequest): Promise<void>;
}

export interface IResummarizeMeetingUseCase {
  execute(request: ResummarizeMeetingRequest): Promise<ResummarizeMeetingResponse>;
}

export interface IRetranscribeMeetingUseCase {
  execute(request: RetranscribeMeetingRequest): Promise<RetranscribeMeetingResponse>;
}

export interface ISendToJournalUseCase {
  execute(request: SendToJournalRequest): Promise<SendToJournalResponse>;
}

// ---------- Live transcription (fast raw draft while recording) ----------

export interface ILiveTranscriptionUseCases {
  /** Spawn/warm the resident model so chunks transcribe without a reload. */
  start(): Promise<void>;
  /** Transcribe one 16 kHz mono WAV chunk for the live draft. */
  transcribeChunk(request: { wav: ArrayBuffer }): Promise<LiveChunkResult>;
  /** Tear down the resident model (frees memory after recording). */
  stop(): Promise<void>;
}

export interface IMeetingUseCases {
  reserveRecordingSlot: IReserveRecordingSlotUseCase;
  appendRecordingAudio: IAppendRecordingAudioUseCase;
  finalizeRecording: IFinalizeRecordingUseCase;
  listMeetingRecordings: IListMeetingRecordingsUseCase;
  getMeetingRecording: IGetMeetingRecordingUseCase;
  getMeetingAudio: IGetMeetingAudioUseCase;
  deleteMeetingRecording: IDeleteMeetingRecordingUseCase;
  resummarizeMeeting: IResummarizeMeetingUseCase;
  retranscribeMeeting: IRetranscribeMeetingUseCase;
  sendToJournal: ISendToJournalUseCase;
  liveTranscription: ILiveTranscriptionUseCases;
}
