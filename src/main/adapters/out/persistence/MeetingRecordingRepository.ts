/**
 * MeetingRecordingRepository — drizzle-backed persistence for meeting
 * recordings. Transcript segments are JSON-encoded in a TEXT column
 * (they're never queried structurally, only loaded back wholesale).
 */

import { and, desc, eq, lt } from 'drizzle-orm';
import { meetingRecordings, type Database } from '../../../shared';
import {
  MeetingRecordingEntity,
  type MeetingRecordingProps,
  type MeetingRecordingStatus,
  type TranscriptSegment,
} from '../../../domain';
import type {
  IMeetingRecordingRepository,
  ListMeetingRecordingsOptions,
  ListMeetingRecordingsResult,
} from '../../../domain/ports/out/IMeetingRecordingRepository';
import { handleOperation } from '../../../shared/utils';

export interface MeetingRecordingRepositoryDeps {
  db: Database;
}

export class MeetingRecordingRepository implements IMeetingRecordingRepository {
  constructor(private deps: MeetingRecordingRepositoryDeps) {}

  private handle<T>(operation: string, fn: () => Promise<T>, context?: Record<string, unknown>) {
    return handleOperation(fn, {
      adapter: 'MeetingRecordingRepository',
      operation,
      context,
    });
  }

  async save(recording: MeetingRecordingEntity): Promise<void> {
    return this.handle(
      'save',
      async () => {
        const props = recording.toPersistence();
        await this.deps.db
          .insert(meetingRecordings)
          .values({
            id: props.id,
            workspaceId: props.workspaceId,
            title: props.title,
            status: props.status,
            audioPath: props.audioPath,
            durationMs: props.durationMs,
            transcriptText: props.transcriptText,
            transcriptSegments: JSON.stringify(props.transcriptSegments),
            summary: props.summary,
            promptUsed: props.promptUsed,
            journalDate: props.journalDate,
            error: props.error,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt,
          })
          .onConflictDoUpdate({
            target: meetingRecordings.id,
            set: {
              title: props.title,
              status: props.status,
              audioPath: props.audioPath,
              durationMs: props.durationMs,
              transcriptText: props.transcriptText,
              transcriptSegments: JSON.stringify(props.transcriptSegments),
              summary: props.summary,
              promptUsed: props.promptUsed,
              journalDate: props.journalDate,
              error: props.error,
              updatedAt: props.updatedAt,
            },
          });
      },
      { recordingId: recording.id, workspaceId: recording.workspaceId, status: recording.status },
    );
  }

  async findById(id: string): Promise<MeetingRecordingEntity | null> {
    return this.handle(
      'findById',
      async () => {
        const rows = await this.deps.db
          .select()
          .from(meetingRecordings)
          .where(eq(meetingRecordings.id, id))
          .limit(1);
        if (rows.length === 0) return null;
        return MeetingRecordingEntity.fromPersistence(this.toProps(rows[0]));
      },
      { recordingId: id },
    );
  }

  async list(options: ListMeetingRecordingsOptions): Promise<ListMeetingRecordingsResult> {
    return this.handle(
      'list',
      async () => {
        const limit = options.limit && options.limit > 0 ? options.limit : 50;

        const conditions = [eq(meetingRecordings.workspaceId, options.workspaceId)];
        if (options.cursor) {
          conditions.push(lt(meetingRecordings.createdAt, options.cursor));
        }

        // Fetch limit+1 so we know whether to expose a nextCursor.
        const rows = await this.deps.db
          .select()
          .from(meetingRecordings)
          .where(and(...conditions))
          .orderBy(desc(meetingRecordings.createdAt))
          .limit(limit + 1);

        const recordings = rows
          .slice(0, limit)
          .map((row) => MeetingRecordingEntity.fromPersistence(this.toProps(row)));
        const nextCursor = rows.length > limit ? recordings[recordings.length - 1].createdAt : null;

        return { recordings, nextCursor };
      },
      { workspaceId: options.workspaceId, limit: options.limit ?? null },
    );
  }

  async delete(id: string): Promise<void> {
    return this.handle(
      'delete',
      async () => {
        await this.deps.db.delete(meetingRecordings).where(eq(meetingRecordings.id, id));
      },
      { recordingId: id },
    );
  }

  private toProps(row: typeof meetingRecordings.$inferSelect): MeetingRecordingProps {
    let segments: TranscriptSegment[] = [];
    try {
      const parsed = JSON.parse(row.transcriptSegments ?? '[]');
      if (Array.isArray(parsed)) segments = parsed as TranscriptSegment[];
    } catch {
      // Corrupt JSON — treat as empty rather than crashing the load path.
    }

    return {
      id: row.id,
      workspaceId: row.workspaceId,
      title: row.title,
      status: row.status as MeetingRecordingStatus,
      audioPath: row.audioPath,
      durationMs: row.durationMs,
      transcriptText: row.transcriptText,
      transcriptSegments: segments,
      summary: row.summary,
      promptUsed: row.promptUsed,
      journalDate: row.journalDate,
      error: row.error,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
