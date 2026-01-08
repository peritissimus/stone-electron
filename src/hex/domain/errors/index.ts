/**
 * Domain Errors Index
 */

export {
  // Base classes
  DomainError,
  ValidationError,
  OperationError,
  NotFoundError,
  // Validation errors
  NoteValidationError,
  NotebookValidationError,
  TagValidationError,
  WorkspaceValidationError,
  TopicValidationError,
  AttachmentValidationError,
  VersionValidationError,
  NoteLinkValidationError,
  // Operation errors
  NoteOperationError,
  NotebookOperationError,
  WorkspaceOperationError,
  // Not found errors
  NoteNotFoundError,
  NotebookNotFoundError,
  WorkspaceNotFoundError,
  TagNotFoundError,
} from './DomainErrors';
