/**
 * Wire shapes for meeting recordings — the renderer never sees the
 * domain entity, just the serializable props.
 */

export type MeetingRecordingStatus =
  | 'recording'
  | 'transcribing'
  | 'summarizing'
  | 'ready'
  | 'failed';

export interface MeetingTranscriptSegment {
  text: string;
  startMs: number;
  endMs: number;
}

export interface MeetingRecording {
  id: string;
  workspaceId: string;
  title: string;
  status: MeetingRecordingStatus;
  audioPath: string | null;
  durationMs: number;
  transcriptText: string | null;
  transcriptSegments: MeetingTranscriptSegment[];
  summary: string | null;
  promptUsed: string | null;
  journalDate: string | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecordingSlot {
  recordingId: string;
  audioAbsolutePath: string;
}
