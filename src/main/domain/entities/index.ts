/**
 * Domain Entities Index
 *
 * Export all domain entities and their related types.
 * Errors are exported from ../errors
 */

export { NoteEntity, type NoteProps, type CreateNoteProps } from './Note';

export { NotebookEntity, type NotebookProps, type CreateNotebookProps } from './Notebook';

export { TagEntity, type TagProps, type CreateTagProps } from './Tag';

export { WorkspaceEntity, type WorkspaceProps, type CreateWorkspaceProps } from './Workspace';

export { AttachmentEntity, type AttachmentProps, type CreateAttachmentInput } from './Attachment';

export { TopicEntity, type TopicProps, type CreateTopicInput, type TopicWithCount } from './Topic';

export {
  VersionEntity,
  type VersionProps,
  type CreateVersionInput,
  type VersionSummary,
} from './Version';

export {
  NoteLinkEntity,
  type NoteLinkProps,
  type CreateNoteLinkInput,
  type LinkCount,
} from './NoteLink';

export {
  MeetingRecordingEntity,
  type MeetingRecordingProps,
  type CreateMeetingRecordingInput,
  type MeetingRecordingStatus,
  type TranscriptSegment,
} from './MeetingRecording';
