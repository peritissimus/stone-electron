/**
 * NotebookId Value Object Tests
 *
 * Immutable value object - no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import { NotebookId } from '../../../../src/main/domain/value-objects/NotebookId';

describe('NotebookId', () => {
  describe('fromString', () => {
    it('creates NotebookId from valid string', () => {
      const notebookId = NotebookId.fromString('notebook-123');

      expect(notebookId.value).toBe('notebook-123');
    });

    it('trims whitespace', () => {
      const notebookId = NotebookId.fromString('  notebook-123  ');

      expect(notebookId.value).toBe('notebook-123');
    });

    it('throws on empty string', () => {
      expect(() => NotebookId.fromString('')).toThrow('NotebookId cannot be empty');
    });

    it('throws on whitespace-only string', () => {
      expect(() => NotebookId.fromString('   ')).toThrow('NotebookId cannot be empty');
    });
  });

  describe('value getter', () => {
    it('returns the id value', () => {
      const notebookId = NotebookId.fromString('abc-123');

      expect(notebookId.value).toBe('abc-123');
    });
  });

  describe('equals', () => {
    it('returns true for equal ids', () => {
      const a = NotebookId.fromString('notebook-1');
      const b = NotebookId.fromString('notebook-1');

      expect(a.equals(b)).toBe(true);
    });

    it('returns false for different ids', () => {
      const a = NotebookId.fromString('notebook-1');
      const b = NotebookId.fromString('notebook-2');

      expect(a.equals(b)).toBe(false);
    });

    it('returns false for null', () => {
      const notebookId = NotebookId.fromString('notebook-1');

      expect(notebookId.equals(null as unknown as NotebookId)).toBe(false);
    });

    it('returns false for undefined', () => {
      const notebookId = NotebookId.fromString('notebook-1');

      expect(notebookId.equals(undefined as unknown as NotebookId)).toBe(false);
    });
  });

  describe('toString', () => {
    it('returns string representation', () => {
      const notebookId = NotebookId.fromString('notebook-123');

      expect(notebookId.toString()).toBe('notebook-123');
    });

    it('can be used in string contexts', () => {
      const notebookId = NotebookId.fromString('notebook-123');

      expect(`ID: ${notebookId}`).toBe('ID: notebook-123');
    });
  });
});
