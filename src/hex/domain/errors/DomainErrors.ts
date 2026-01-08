/**
 * Domain Errors
 *
 * Centralized domain error definitions.
 * These are pure domain errors without infrastructure dependencies.
 */

/**
 * Base class for all domain errors
 */
export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

// ============================================================================
// Validation Errors - Invalid input/state
// ============================================================================

export abstract class ValidationError extends DomainError {}

export class NoteValidationError extends ValidationError {
  constructor(message: string) {
    super(message);
  }
}

export class NotebookValidationError extends ValidationError {
  constructor(message: string) {
    super(message);
  }
}

export class TagValidationError extends ValidationError {
  constructor(message: string) {
    super(message);
  }
}

export class WorkspaceValidationError extends ValidationError {
  constructor(message: string) {
    super(message);
  }
}

export class TopicValidationError extends ValidationError {
  constructor(message: string) {
    super(message);
  }
}

export class AttachmentValidationError extends ValidationError {
  constructor(message: string) {
    super(message);
  }
}

export class VersionValidationError extends ValidationError {
  constructor(message: string) {
    super(message);
  }
}

export class NoteLinkValidationError extends ValidationError {
  constructor(message: string) {
    super(message);
  }
}

// ============================================================================
// Operation Errors - Invalid operations on valid entities
// ============================================================================

export abstract class OperationError extends DomainError {}

export class NoteOperationError extends OperationError {
  constructor(message: string) {
    super(message);
  }
}

export class NotebookOperationError extends OperationError {
  constructor(message: string) {
    super(message);
  }
}

export class WorkspaceOperationError extends OperationError {
  constructor(message: string) {
    super(message);
  }
}

// ============================================================================
// Not Found Errors - Entity doesn't exist
// ============================================================================

export abstract class NotFoundError extends DomainError {}

export class NoteNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Note not found: ${id}`);
  }
}

export class NotebookNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Notebook not found: ${id}`);
  }
}

export class WorkspaceNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Workspace not found: ${id}`);
  }
}

export class TagNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Tag not found: ${id}`);
  }
}
