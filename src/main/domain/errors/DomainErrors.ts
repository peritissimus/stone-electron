import { Data } from 'effect';

/** Structural categories retained for callers that group failures. */
export type DomainError = ValidationError | OperationError | NotFoundError;
export type ValidationError =
  | NoteValidationError
  | NotebookValidationError
  | TagValidationError
  | WorkspaceValidationError
  | TopicValidationError
  | AttachmentValidationError
  | VersionValidationError
  | NoteLinkValidationError
  | MeetingRecordingValidationError
  | ShortcutConflictError;
export type OperationError =
  | NoteOperationError
  | NotebookOperationError
  | WorkspaceOperationError;
export type NotFoundError =
  | NoteNotFoundError
  | NotebookNotFoundError
  | WorkspaceNotFoundError
  | TagNotFoundError
  | MeetingRecordingNotFoundError;

// ============================================================================
// Validation Errors - Invalid input/state
// ============================================================================

export class NoteValidationError extends Data.TaggedError('NoteValidationError')<{
  readonly message: string;
}> {
  constructor(message: string) {
    super({ message });
  }
}

export class NotebookValidationError extends Data.TaggedError('NotebookValidationError')<{
  readonly message: string;
}> {
  constructor(message: string) {
    super({ message });
  }
}

export class TagValidationError extends Data.TaggedError('TagValidationError')<{
  readonly message: string;
}> {
  constructor(message: string) {
    super({ message });
  }
}

export class WorkspaceValidationError extends Data.TaggedError('WorkspaceValidationError')<{
  readonly message: string;
}> {
  constructor(message: string) {
    super({ message });
  }
}

export class TopicValidationError extends Data.TaggedError('TopicValidationError')<{
  readonly message: string;
}> {
  constructor(message: string) {
    super({ message });
  }
}

export class AttachmentValidationError extends Data.TaggedError('AttachmentValidationError')<{
  readonly message: string;
}> {
  constructor(message: string) {
    super({ message });
  }
}

export class VersionValidationError extends Data.TaggedError('VersionValidationError')<{
  readonly message: string;
}> {
  constructor(message: string) {
    super({ message });
  }
}

export class NoteLinkValidationError extends Data.TaggedError('NoteLinkValidationError')<{
  readonly message: string;
}> {
  constructor(message: string) {
    super({ message });
  }
}

export class MeetingRecordingValidationError extends Data.TaggedError(
  'MeetingRecordingValidationError',
)<{ readonly message: string }> {
  constructor(message: string) {
    super({ message });
  }
}

/**
 * Thrown when a user-supplied shortcut chord collides with another shortcut
 * or with a reserved built-in (StarterKit) binding.
 */
export class ShortcutConflictError extends Data.TaggedError('ShortcutConflictError')<{
  readonly message: string;
  readonly chord: string;
  readonly conflictingActions: readonly string[];
  readonly reserved: boolean;
}> {
  constructor(args: { chord: string; conflictingActions: string[]; reserved?: boolean }) {
    const detail = args.reserved
      ? 'reserved by built-in editor binding'
      : `conflicts with: ${args.conflictingActions.join(', ')}`;
    super({
      message: `Shortcut '${args.chord}' ${detail}`,
      chord: args.chord,
      conflictingActions: args.conflictingActions,
      reserved: args.reserved ?? false,
    });
  }
}

// ============================================================================
// Operation Errors - Invalid operations on valid entities
// ============================================================================

export class NoteOperationError extends Data.TaggedError('NoteOperationError')<{
  readonly message: string;
}> {
  constructor(message: string) {
    super({ message });
  }
}

export class NotebookOperationError extends Data.TaggedError('NotebookOperationError')<{
  readonly message: string;
}> {
  constructor(message: string) {
    super({ message });
  }
}

export class WorkspaceOperationError extends Data.TaggedError('WorkspaceOperationError')<{
  readonly message: string;
}> {
  constructor(message: string) {
    super({ message });
  }
}

// ============================================================================
// Not Found Errors - Entity doesn't exist
// ============================================================================

export class NoteNotFoundError extends Data.TaggedError('NoteNotFoundError')<{
  readonly message: string;
  readonly id: string;
}> {
  constructor(id: string) {
    super({ message: `Note not found: ${id}`, id });
  }
}

export class NotebookNotFoundError extends Data.TaggedError('NotebookNotFoundError')<{
  readonly message: string;
  readonly id: string;
}> {
  constructor(id: string) {
    super({ message: `Notebook not found: ${id}`, id });
  }
}

export class WorkspaceNotFoundError extends Data.TaggedError('WorkspaceNotFoundError')<{
  readonly message: string;
  readonly id: string;
}> {
  constructor(id: string) {
    super({ message: `Workspace not found: ${id}`, id });
  }
}

export class TagNotFoundError extends Data.TaggedError('TagNotFoundError')<{
  readonly message: string;
  readonly id: string;
}> {
  constructor(id: string) {
    super({ message: `Tag not found: ${id}`, id });
  }
}

export class MeetingRecordingNotFoundError extends Data.TaggedError(
  'MeetingRecordingNotFoundError',
)<{ readonly message: string; readonly id: string }> {
  constructor(id: string) {
    super({ message: `Meeting recording not found: ${id}`, id });
  }
}
