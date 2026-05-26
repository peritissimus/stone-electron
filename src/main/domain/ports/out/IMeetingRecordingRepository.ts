/**
 * IMeetingRecordingRepository — persistence port for meeting recordings.
 *
 * Repository owns serialization of the transcript segments column
 * (JSON-encoded) so use cases can keep working with the typed entity.
 */

import type { MeetingRecordingEntity } from '../../entities';

export interface ListMeetingRecordingsOptions {
  workspaceId: string;
  limit?: number;
  /** Created-at cursor for pagination. */
  cursor?: Date;
}

export interface ListMeetingRecordingsResult {
  recordings: MeetingRecordingEntity[];
  nextCursor: Date | null;
}

export interface IMeetingRecordingRepository {
  save(recording: MeetingRecordingEntity): Promise<void>;
  findById(id: string): Promise<MeetingRecordingEntity | null>;
  list(options: ListMeetingRecordingsOptions): Promise<ListMeetingRecordingsResult>;
  delete(id: string): Promise<void>;
}
