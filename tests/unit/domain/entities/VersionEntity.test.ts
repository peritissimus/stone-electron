/**
 * VersionEntity Domain Entity Tests
 *
 * Tests version snapshot business rules.
 */

import { describe, it, expect } from 'vitest';
import { VersionEntity } from '../../../../src/main/domain/entities/Version';
import { VersionValidationError } from '../../../../src/main/domain/errors';

describe('VersionEntity', () => {
  describe('create', () => {
    it('creates version with required props', () => {
      const version = VersionEntity.create({
        id: 'ver-1',
        noteId: 'note-1',
        title: 'My Note',
        content: '# Hello World',
        versionNumber: 1,
      });

      expect(version.id).toBe('ver-1');
      expect(version.noteId).toBe('note-1');
      expect(version.title).toBe('My Note');
      expect(version.content).toBe('# Hello World');
      expect(version.versionNumber).toBe(1);
    });

    it('sets createdAt to current date', () => {
      const version = VersionEntity.create({
        id: 'ver-1',
        noteId: 'note-1',
        title: 'Test',
        content: 'Content',
        versionNumber: 1,
      });

      expect(version.createdAt).toBeInstanceOf(Date);
    });

    it('throws on empty id', () => {
      expect(() =>
        VersionEntity.create({
          id: '',
          noteId: 'note-1',
          title: 'Test',
          content: 'Content',
          versionNumber: 1,
        })
      ).toThrow(VersionValidationError);
    });

    it('throws on whitespace-only id', () => {
      expect(() =>
        VersionEntity.create({
          id: '   ',
          noteId: 'note-1',
          title: 'Test',
          content: 'Content',
          versionNumber: 1,
        })
      ).toThrow(VersionValidationError);
    });
  });

  describe('contentLength', () => {
    it('returns content length', () => {
      const version = VersionEntity.create({
        id: 'ver-1',
        noteId: 'note-1',
        title: 'Test',
        content: 'Hello World', // 11 characters
        versionNumber: 1,
      });

      expect(version.contentLength).toBe(11);
    });

    it('returns 0 for empty content', () => {
      const version = VersionEntity.create({
        id: 'ver-1',
        noteId: 'note-1',
        title: 'Test',
        content: '',
        versionNumber: 1,
      });

      expect(version.contentLength).toBe(0);
    });
  });

  describe('summary', () => {
    it('returns version summary', () => {
      const version = VersionEntity.create({
        id: 'ver-1',
        noteId: 'note-1',
        title: 'My Note',
        content: 'Hello World',
        versionNumber: 5,
      });

      const summary = version.summary;

      expect(summary.id).toBe('ver-1');
      expect(summary.versionNumber).toBe(5);
      expect(summary.title).toBe('My Note');
      expect(summary.contentLength).toBe(11);
      expect(summary.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('formattedVersion', () => {
    it('returns formatted version string', () => {
      const version = VersionEntity.create({
        id: 'ver-1',
        noteId: 'note-1',
        title: 'Test',
        content: 'Content',
        versionNumber: 1,
      });

      expect(version.formattedVersion).toBe('v1');
    });

    it('handles multi-digit version numbers', () => {
      const version = VersionEntity.create({
        id: 'ver-1',
        noteId: 'note-1',
        title: 'Test',
        content: 'Content',
        versionNumber: 123,
      });

      expect(version.formattedVersion).toBe('v123');
    });
  });

  describe('isNewerThan', () => {
    it('returns true when version is newer', () => {
      const older = VersionEntity.create({
        id: 'ver-1',
        noteId: 'note-1',
        title: 'Test',
        content: 'Content',
        versionNumber: 1,
      });

      const newer = VersionEntity.create({
        id: 'ver-2',
        noteId: 'note-1',
        title: 'Test',
        content: 'Content',
        versionNumber: 2,
      });

      expect(newer.isNewerThan(older)).toBe(true);
    });

    it('returns false when version is older', () => {
      const older = VersionEntity.create({
        id: 'ver-1',
        noteId: 'note-1',
        title: 'Test',
        content: 'Content',
        versionNumber: 1,
      });

      const newer = VersionEntity.create({
        id: 'ver-2',
        noteId: 'note-1',
        title: 'Test',
        content: 'Content',
        versionNumber: 2,
      });

      expect(older.isNewerThan(newer)).toBe(false);
    });

    it('returns false when versions are equal', () => {
      const v1 = VersionEntity.create({
        id: 'ver-1',
        noteId: 'note-1',
        title: 'Test',
        content: 'Content',
        versionNumber: 5,
      });

      const v2 = VersionEntity.create({
        id: 'ver-2',
        noteId: 'note-1',
        title: 'Test',
        content: 'Content',
        versionNumber: 5,
      });

      expect(v1.isNewerThan(v2)).toBe(false);
    });
  });

  describe('toPersistence', () => {
    it('converts to persistence format', () => {
      const version = VersionEntity.create({
        id: 'ver-1',
        noteId: 'note-1',
        title: 'My Note',
        content: '# Content',
        versionNumber: 3,
      });

      const data = version.toPersistence();

      expect(data).toMatchObject({
        id: 'ver-1',
        noteId: 'note-1',
        title: 'My Note',
        content: '# Content',
        versionNumber: 3,
      });
      expect(data.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('fromPersistence', () => {
    it('reconstructs entity from persistence', () => {
      const data = {
        id: 'ver-1',
        noteId: 'note-1',
        title: 'Persisted',
        content: '# Saved content',
        versionNumber: 10,
        createdAt: new Date('2024-01-01'),
      };

      const version = VersionEntity.fromPersistence(data);

      expect(version.id).toBe('ver-1');
      expect(version.noteId).toBe('note-1');
      expect(version.title).toBe('Persisted');
      expect(version.content).toBe('# Saved content');
      expect(version.versionNumber).toBe(10);
      expect(version.createdAt).toEqual(new Date('2024-01-01'));
    });
  });
});
