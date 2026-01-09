/**
 * FilePath Value Object Tests
 *
 * Immutable value object - no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import { FilePath } from '../../../../src/main/domain/value-objects/FilePath';

describe('FilePath', () => {
  describe('fromString', () => {
    it('creates FilePath from valid string', () => {
      const filePath = FilePath.fromString('/path/to/file.md');

      expect(filePath.value).toBe('/path/to/file.md');
    });

    it('trims whitespace', () => {
      const filePath = FilePath.fromString('  /path/to/file.md  ');

      expect(filePath.value).toBe('/path/to/file.md');
    });

    it('throws on empty string', () => {
      expect(() => FilePath.fromString('')).toThrow('FilePath cannot be empty');
    });

    it('throws on whitespace-only string', () => {
      expect(() => FilePath.fromString('   ')).toThrow('FilePath cannot be empty');
    });
  });

  describe('value getter', () => {
    it('returns the path value', () => {
      const filePath = FilePath.fromString('/notes/my-note.md');

      expect(filePath.value).toBe('/notes/my-note.md');
    });

    it('preserves relative paths', () => {
      const filePath = FilePath.fromString('./relative/path.md');

      expect(filePath.value).toBe('./relative/path.md');
    });

    it('preserves Windows-style paths', () => {
      const filePath = FilePath.fromString('C:\\Users\\name\\file.md');

      expect(filePath.value).toBe('C:\\Users\\name\\file.md');
    });
  });

  describe('equals', () => {
    it('returns true for equal paths', () => {
      const a = FilePath.fromString('/path/to/file.md');
      const b = FilePath.fromString('/path/to/file.md');

      expect(a.equals(b)).toBe(true);
    });

    it('returns false for different paths', () => {
      const a = FilePath.fromString('/path/to/file1.md');
      const b = FilePath.fromString('/path/to/file2.md');

      expect(a.equals(b)).toBe(false);
    });

    it('is case sensitive', () => {
      const a = FilePath.fromString('/Path/To/File.md');
      const b = FilePath.fromString('/path/to/file.md');

      expect(a.equals(b)).toBe(false);
    });

    it('returns false for null', () => {
      const filePath = FilePath.fromString('/path/file.md');

      expect(filePath.equals(null as unknown as FilePath)).toBe(false);
    });

    it('returns false for undefined', () => {
      const filePath = FilePath.fromString('/path/file.md');

      expect(filePath.equals(undefined as unknown as FilePath)).toBe(false);
    });
  });

  describe('toString', () => {
    it('returns string representation', () => {
      const filePath = FilePath.fromString('/path/to/file.md');

      expect(filePath.toString()).toBe('/path/to/file.md');
    });

    it('can be used in string contexts', () => {
      const filePath = FilePath.fromString('/path/to/file.md');

      expect(`Path: ${filePath}`).toBe('Path: /path/to/file.md');
    });
  });
});
