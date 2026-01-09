/**
 * NoteId Value Object Tests
 *
 * Immutable value object - no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import { NoteId } from '../../../../src/main/domain/value-objects/NoteId';

describe('NoteId', () => {
  describe('fromString', () => {
    it('creates NoteId from valid string', () => {
      const noteId = NoteId.fromString('note-123');

      expect(noteId.value).toBe('note-123');
    });

    it('trims whitespace', () => {
      const noteId = NoteId.fromString('  note-123  ');

      expect(noteId.value).toBe('note-123');
    });

    it('throws on empty string', () => {
      expect(() => NoteId.fromString('')).toThrow('NoteId cannot be empty');
    });

    it('throws on whitespace-only string', () => {
      expect(() => NoteId.fromString('   ')).toThrow('NoteId cannot be empty');
    });
  });

  describe('value getter', () => {
    it('returns the id value', () => {
      const noteId = NoteId.fromString('abc-123');

      expect(noteId.value).toBe('abc-123');
    });
  });

  describe('equals', () => {
    it('returns true for equal ids', () => {
      const a = NoteId.fromString('note-1');
      const b = NoteId.fromString('note-1');

      expect(a.equals(b)).toBe(true);
    });

    it('returns false for different ids', () => {
      const a = NoteId.fromString('note-1');
      const b = NoteId.fromString('note-2');

      expect(a.equals(b)).toBe(false);
    });

    it('returns false for null', () => {
      const noteId = NoteId.fromString('note-1');

      expect(noteId.equals(null as unknown as NoteId)).toBe(false);
    });

    it('returns false for undefined', () => {
      const noteId = NoteId.fromString('note-1');

      expect(noteId.equals(undefined as unknown as NoteId)).toBe(false);
    });
  });

  describe('toString', () => {
    it('returns string representation', () => {
      const noteId = NoteId.fromString('note-123');

      expect(noteId.toString()).toBe('note-123');
    });

    it('can be used in string contexts', () => {
      const noteId = NoteId.fromString('note-123');

      expect(`ID: ${noteId}`).toBe('ID: note-123');
    });
  });
});
