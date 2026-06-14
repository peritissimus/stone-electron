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
  /** Capture source: the user's mic ('mic') or system audio / other
   *  participants ('system'). Absent on legacy single-track transcripts. */
  source?: 'mic' | 'system';
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
  /** True when the native system-audio tap is live for this recording. */
  systemAudio?: boolean;
}
