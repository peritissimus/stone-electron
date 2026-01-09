/**
 * DomainErrors Tests
 *
 * Tests domain error instantiation and inheritance.
 */

import { describe, it, expect } from 'vitest';
import {
  NoteValidationError,
  NotebookValidationError,
  TagValidationError,
  WorkspaceValidationError,
  TopicValidationError,
  AttachmentValidationError,
  VersionValidationError,
  NoteLinkValidationError,
  NoteOperationError,
  NotebookOperationError,
  WorkspaceOperationError,
} from '../../../../src/main/domain/errors/DomainErrors';

describe('DomainErrors', () => {
  describe('ValidationErrors', () => {
    it('creates NoteValidationError with message', () => {
      const error = new NoteValidationError('Invalid note');
      expect(error.message).toBe('Invalid note');
      expect(error.name).toBe('NoteValidationError');
    });

    it('creates NotebookValidationError with message', () => {
      const error = new NotebookValidationError('Invalid notebook');
      expect(error.message).toBe('Invalid notebook');
      expect(error.name).toBe('NotebookValidationError');
    });

    it('creates TagValidationError with message', () => {
      const error = new TagValidationError('Invalid tag');
      expect(error.message).toBe('Invalid tag');
      expect(error.name).toBe('TagValidationError');
    });

    it('creates WorkspaceValidationError with message', () => {
      const error = new WorkspaceValidationError('Invalid workspace');
      expect(error.message).toBe('Invalid workspace');
      expect(error.name).toBe('WorkspaceValidationError');
    });

    it('creates TopicValidationError with message', () => {
      const error = new TopicValidationError('Invalid topic');
      expect(error.message).toBe('Invalid topic');
      expect(error.name).toBe('TopicValidationError');
    });

    it('creates AttachmentValidationError with message', () => {
      const error = new AttachmentValidationError('Invalid attachment');
      expect(error.message).toBe('Invalid attachment');
      expect(error.name).toBe('AttachmentValidationError');
    });

    it('creates VersionValidationError with message', () => {
      const error = new VersionValidationError('Invalid version');
      expect(error.message).toBe('Invalid version');
      expect(error.name).toBe('VersionValidationError');
    });

    it('creates NoteLinkValidationError with message', () => {
      const error = new NoteLinkValidationError('Invalid link');
      expect(error.message).toBe('Invalid link');
      expect(error.name).toBe('NoteLinkValidationError');
    });
  });

  describe('OperationErrors', () => {
    it('creates NoteOperationError with message', () => {
      const error = new NoteOperationError('Operation failed');
      expect(error.message).toBe('Operation failed');
      expect(error.name).toBe('NoteOperationError');
    });

    it('creates NotebookOperationError with message', () => {
      const error = new NotebookOperationError('Operation failed');
      expect(error.message).toBe('Operation failed');
      expect(error.name).toBe('NotebookOperationError');
    });

    it('creates WorkspaceOperationError with message', () => {
      const error = new WorkspaceOperationError('Operation failed');
      expect(error.message).toBe('Operation failed');
      expect(error.name).toBe('WorkspaceOperationError');
    });
  });
});
