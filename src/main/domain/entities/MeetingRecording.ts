/**
 * MeetingRecording Domain Entity
 *
 * Persistent record of a captured meeting: transcript, summary, and the
 * metadata that ties them back to a journal day. The audio file itself
 * is ephemeral (lives under <workspace>/.stone/recordings/ until cleaned
 * up); we keep its relative path here only so we can purge orphans.
 *
 * PURE DOMAIN — no external dependencies.
 */

import { MeetingRecordingValidationError } from '../errors';

export type MeetingRecordingStatus =
  | 'recording'
  | 'transcribing'
  | 'summarizing'
  | 'ready'
  | 'failed';

export interface TranscriptSegment {
  text: string;
  startMs: number;
  endMs: number;
  /** Which captured source this segment came from: the user's mic ('mic') or
   *  system audio / other participants ('system'). Absent on legacy single-
   *  track transcripts. */
  source?: 'mic' | 'system';
}

export interface MeetingRecordingProps {
  id: string;
  workspaceId: string;
  title: string;
  status: MeetingRecordingStatus;
  /** Workspace-relative path to the cached audio file, or null after cleanup. */
  audioPath: string | null;
  durationMs: number;
  transcriptText: string | null;
  transcriptSegments: TranscriptSegment[];
  /** Markdown summary produced by the LLM. */
  summary: string | null;
  /** The prompt template used to produce the current summary. */
  promptUsed: string | null;
  /** ISO date (YYYY-MM-DD) for the journal entry, set when sent to journal. */
  journalDate: string | null;
  /** Populated when status === 'failed'. */
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMeetingRecordingInput {
  id: string;
  workspaceId: string;
  title: string;
  audioPath: string;
}

export class MeetingRecordingEntity {
  private constructor(private props: MeetingRecordingProps) {}

  // -------------------- Factories --------------------

  static create(input: CreateMeetingRecordingInput): MeetingRecordingEntity {
    if (!input.id || input.id.trim().length === 0) {
      throw new MeetingRecordingValidationError('Meeting recording ID is required');
    }
    if (!input.workspaceId || input.workspaceId.trim().length === 0) {
      throw new MeetingRecordingValidationError('Workspace ID is required');
    }
    if (!input.audioPath || input.audioPath.trim().length === 0) {
      throw new MeetingRecordingValidationError('Audio path is required');
    }

    const now = new Date();
    return new MeetingRecordingEntity({
      id: input.id,
      workspaceId: input.workspaceId,
      title: input.title.trim() || formatDefaultTitle(now),
      status: 'recording',
      audioPath: input.audioPath,
      durationMs: 0,
      transcriptText: null,
      transcriptSegments: [],
      summary: null,
      promptUsed: null,
      journalDate: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: MeetingRecordingProps): MeetingRecordingEntity {
    return new MeetingRecordingEntity(props);
  }

  // -------------------- Getters --------------------

  get id(): string {
    return this.props.id;
  }
  get workspaceId(): string {
    return this.props.workspaceId;
  }
  get title(): string {
    return this.props.title;
  }
  get status(): MeetingRecordingStatus {
    return this.props.status;
  }
  get audioPath(): string | null {
    return this.props.audioPath;
  }
  get durationMs(): number {
    return this.props.durationMs;
  }
  get transcriptText(): string | null {
    return this.props.transcriptText;
  }
  get transcriptSegments(): TranscriptSegment[] {
    return this.props.transcriptSegments;
  }
  get summary(): string | null {
    return this.props.summary;
  }
  get promptUsed(): string | null {
    return this.props.promptUsed;
  }
  get journalDate(): string | null {
    return this.props.journalDate;
  }
  get error(): string | null {
    return this.props.error;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // -------------------- Mutations (state transitions) --------------------

  markTranscribing(): void {
    this.transition('transcribing');
  }

  attachTranscript(text: string, segments: TranscriptSegment[], durationMs: number): void {
    this.props.transcriptText = text;
    this.props.transcriptSegments = segments;
    this.props.durationMs = durationMs;
    this.transition('summarizing');
  }

  attachSummary(summary: string, promptUsed: string): void {
    this.props.summary = summary;
    this.props.promptUsed = promptUsed;
    this.transition('ready');
  }

  /** Replace the existing summary without changing journal state. */
  replaceSummary(summary: string, promptUsed: string): void {
    this.props.summary = summary;
    this.props.promptUsed = promptUsed;
    this.props.updatedAt = new Date();
  }

  markJournaledFor(journalDate: string): void {
    if (!isIsoDate(journalDate)) {
      throw new MeetingRecordingValidationError(
        `journalDate must be a YYYY-MM-DD string, got "${journalDate}"`,
      );
    }
    this.props.journalDate = journalDate;
    this.props.updatedAt = new Date();
  }

  markFailed(error: string): void {
    this.props.error = error;
    this.transition('failed');
  }

  rename(title: string): void {
    const trimmed = title.trim();
    if (trimmed.length === 0) {
      throw new MeetingRecordingValidationError('Title cannot be empty');
    }
    this.props.title = trimmed;
    this.props.updatedAt = new Date();
  }

  clearAudio(): void {
    this.props.audioPath = null;
    this.props.updatedAt = new Date();
  }

  // -------------------- Persistence --------------------

  toPersistence(): MeetingRecordingProps {
    return { ...this.props, transcriptSegments: [...this.props.transcriptSegments] };
  }

  private transition(next: MeetingRecordingStatus): void {
    this.props.status = next;
    this.props.updatedAt = new Date();
  }
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatDefaultTitle(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `Meeting ${y}-${m}-${d} ${hh}:${mm}`;
}
