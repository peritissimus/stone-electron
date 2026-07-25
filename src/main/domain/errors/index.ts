/**
 * Domain Errors Index
 */

export type {
  // Base classes
  DomainError,
  ValidationError,
  OperationError,
  NotFoundError,
} from './DomainErrors';

export {
  // Validation errors
  NoteValidationError,
  NotebookValidationError,
  TagValidationError,
  WorkspaceValidationError,
  TopicValidationError,
  AttachmentValidationError,
  VersionValidationError,
  NoteLinkValidationError,
  MeetingRecordingValidationError,
  // Operation errors
  NoteOperationError,
  NotebookOperationError,
  WorkspaceOperationError,
  // Not found errors
  NoteNotFoundError,
  NotebookNotFoundError,
  WorkspaceNotFoundError,
  TagNotFoundError,
  MeetingRecordingNotFoundError,
  // Shortcut configuration
  ShortcutConflictError,
} from './DomainErrors';
