/**
 * Path Utilities Tests
 *
 * Tests for path manipulation utilities
 */

import { describe, it, expect } from 'vitest';
import path from 'path';
import { normalizeRelativePath, resolveInsideRoot } from '../../src/main/utils/path';

describe('Path Utilities', () => {
  describe('normalizeRelativePath', () => {
    it('should return empty string for null input', () => {
      expect(normalizeRelativePath(null)).toBe('');
    });

    it('should return empty string for undefined input', () => {
      expect(normalizeRelativePath(undefined)).toBe('');
    });

    it('should return empty string for empty string input', () => {
      expect(normalizeRelativePath('')).toBe('');
    });

    it('should convert backslashes to forward slashes', () => {
      expect(normalizeRelativePath('foo\\bar\\baz')).toBe('foo/bar/baz');
    });

    it('should remove leading ./', () => {
      expect(normalizeRelativePath('./foo/bar')).toBe('foo/bar');
    });

    it('should remove leading slashes', () => {
      expect(normalizeRelativePath('/foo/bar')).toBe('foo/bar');
      expect(normalizeRelativePath('///foo/bar')).toBe('foo/bar');
    });

    it('should remove trailing slashes', () => {
      expect(normalizeRelativePath('foo/bar/')).toBe('foo/bar');
      expect(normalizeRelativePath('foo/bar///')).toBe('foo/bar');
    });

    it('should handle combination of issues', () => {
      expect(normalizeRelativePath('.\\foo\\bar\\')).toBe('foo/bar');
      expect(normalizeRelativePath('/./foo/bar/')).toBe('./foo/bar');
    });

    it('should preserve internal path structure', () => {
      expect(normalizeRelativePath('folder/subfolder/file.md')).toBe('folder/subfolder/file.md');
    });

    it('should handle single folder name', () => {
      expect(normalizeRelativePath('folder')).toBe('folder');
    });
  });

  describe('resolveInsideRoot', () => {
    const testRoot = '/workspace/notes';

    it('should resolve path inside root', () => {
      const result = resolveInsideRoot(testRoot, 'subfolder/file.md');
      expect(result).toBe(path.resolve(testRoot, 'subfolder/file.md'));
    });

    it('should allow exact root match with empty string', () => {
      const result = resolveInsideRoot(testRoot, '');
      expect(result).toBe(path.resolve(testRoot));
    });

    it('should allow exact root match with .', () => {
      const result = resolveInsideRoot(testRoot, '.');
      expect(result).toBe(path.resolve(testRoot));
    });

    it('should throw for path traversal with ..', () => {
      expect(() => {
        resolveInsideRoot(testRoot, '../outside');
      }).toThrow('Path escapes workspace root');
    });

    it('should throw for absolute path outside root', () => {
      expect(() => {
        resolveInsideRoot(testRoot, '/etc/passwd');
      }).toThrow('Path escapes workspace root');
    });

    it('should handle nested paths correctly', () => {
      const result = resolveInsideRoot(testRoot, 'a/b/c/d/file.md');
      expect(result).toBe(path.resolve(testRoot, 'a/b/c/d/file.md'));
    });

    it('should throw for traversal in middle of path', () => {
      expect(() => {
        resolveInsideRoot(testRoot, 'subfolder/../../outside');
      }).toThrow('Path escapes workspace root');
    });

    it('should allow valid paths that go up and back down', () => {
      // Going up one level and back down is fine if it stays inside root
      const result = resolveInsideRoot(testRoot, 'folder/../other/file.md');
      expect(result).toBe(path.resolve(testRoot, 'other/file.md'));
    });

    it('should handle root with trailing slash', () => {
      const rootWithSlash = '/workspace/notes/';
      const result = resolveInsideRoot(rootWithSlash, 'file.md');
      expect(result).toBe(path.resolve(rootWithSlash, 'file.md'));
    });

    it('should prevent prefix-based attacks', () => {
      // /workspace/notes-evil should not be allowed for root /workspace/notes
      const maliciousPath = path.relative('/workspace/notes', '/workspace/notes-evil/file.md');
      expect(() => {
        resolveInsideRoot('/workspace/notes', maliciousPath);
      }).toThrow('Path escapes workspace root');
    });
  });
});
