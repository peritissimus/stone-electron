/**
 * NoteEntity Domain Entity Tests
 *
 * Tests business rules and state transitions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NoteEntity } from '../../../../src/main/domain/entities/Note';
import { NoteValidationError, NoteOperationError } from '../../../../src/main/domain/errors';

describe('NoteEntity', () => {
  describe('create', () => {
    it('creates note with required props', () => {
      const note = NoteEntity.create({
        id: 'note-1',
        workspaceId: 'ws-1',
      });

      expect(note.id).toBe('note-1');
      expect(note.workspaceId).toBe('ws-1');
      expect(note.title).toBe('Untitled'); // Default
    });

    it('creates note with all props', () => {
      const note = NoteEntity.create({
        id: 'note-1',
        workspaceId: 'ws-1',
        title: 'My Note',
        notebookId: 'nb-1',
        filePath: '/notes/my-note.md',
      });

      expect(note.title).toBe('My Note');
      expect(note.notebookId).toBe('nb-1');
      expect(note.filePath).toBe('/notes/my-note.md');
    });

    it('sets default values', () => {
      const note = NoteEntity.create({
        id: 'note-1',
        workspaceId: 'ws-1',
      });

      expect(note.isFavorite).toBe(false);
      expect(note.isPinned).toBe(false);
      expect(note.isArchived).toBe(false);
      expect(note.isDeleted).toBe(false);
      expect(note.createdAt).toBeInstanceOf(Date);
      expect(note.updatedAt).toBeInstanceOf(Date);
    });

    it('throws on empty id', () => {
      expect(() =>
        NoteEntity.create({
          id: '',
          workspaceId: 'ws-1',
        })
      ).toThrow(NoteValidationError);
    });

    it('allows empty workspaceId (optional)', () => {
      // workspaceId is optional and defaults to null
      const note = NoteEntity.create({
        id: 'note-1',
      });

      expect(note.workspaceId).toBeNull();
    });
  });

  describe('updateTitle', () => {
    let note: NoteEntity;

    beforeEach(() => {
      note = NoteEntity.create({
        id: 'note-1',
        workspaceId: 'ws-1',
        title: 'Original',
      });
    });

    it('updates title', () => {
      note.updateTitle('New Title');

      expect(note.title).toBe('New Title');
    });

    it('trims whitespace', () => {
      note.updateTitle('  Trimmed  ');

      expect(note.title).toBe('Trimmed');
    });

    it('updates timestamp', () => {
      const before = note.updatedAt;
      note.updateTitle('New Title');

      expect(note.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('throws on empty title', () => {
      expect(() => note.updateTitle('')).toThrow(NoteValidationError);
      expect(() => note.updateTitle('   ')).toThrow(NoteValidationError);
    });

    it('throws on title exceeding max length', () => {
      const longTitle = 'a'.repeat(256);

      expect(() => note.updateTitle(longTitle)).toThrow(NoteValidationError);
    });

    it('allows title at max length', () => {
      const maxTitle = 'a'.repeat(255);

      note.updateTitle(maxTitle);

      expect(note.title).toBe(maxTitle);
    });
  });

  describe('moveToNotebook', () => {
    let note: NoteEntity;

    beforeEach(() => {
      note = NoteEntity.create({
        id: 'note-1',
        workspaceId: 'ws-1',
        notebookId: 'nb-1',
      });
    });

    it('moves note to another notebook', () => {
      note.moveToNotebook('nb-2');

      expect(note.notebookId).toBe('nb-2');
    });

    it('allows moving to null (root)', () => {
      note.moveToNotebook(null);

      expect(note.notebookId).toBeNull();
    });

    it('updates timestamp', () => {
      const before = note.updatedAt;
      note.moveToNotebook('nb-2');

      expect(note.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('throws when note is deleted', () => {
      note.delete();

      expect(() => note.moveToNotebook('nb-2')).toThrow(NoteOperationError);
    });
  });

  describe('favorite operations', () => {
    let note: NoteEntity;

    beforeEach(() => {
      note = NoteEntity.create({
        id: 'note-1',
        workspaceId: 'ws-1',
      });
    });

    it('toggles favorite on', () => {
      note.toggleFavorite();

      expect(note.isFavorite).toBe(true);
    });

    it('toggles favorite off', () => {
      note.setFavorite(true);
      note.toggleFavorite();

      expect(note.isFavorite).toBe(false);
    });

    it('sets favorite explicitly', () => {
      note.setFavorite(true);
      expect(note.isFavorite).toBe(true);

      note.setFavorite(false);
      expect(note.isFavorite).toBe(false);
    });

    it('throws when note is deleted', () => {
      note.delete();

      expect(() => note.toggleFavorite()).toThrow(NoteOperationError);
      expect(() => note.setFavorite(true)).toThrow(NoteOperationError);
    });
  });

  describe('pinned operations', () => {
    let note: NoteEntity;

    beforeEach(() => {
      note = NoteEntity.create({
        id: 'note-1',
        workspaceId: 'ws-1',
      });
    });

    it('toggles pinned on', () => {
      note.togglePinned();

      expect(note.isPinned).toBe(true);
    });

    it('toggles pinned off', () => {
      note.setPinned(true);
      note.togglePinned();

      expect(note.isPinned).toBe(false);
    });

    it('unpins when archived', () => {
      note.setPinned(true);
      note.setArchived(true);

      expect(note.isPinned).toBe(false);
    });

    it('throws when note is deleted', () => {
      note.delete();

      expect(() => note.togglePinned()).toThrow(NoteOperationError);
    });

    it('throws when setPinned called on deleted note', () => {
      note.delete();

      expect(() => note.setPinned(true)).toThrow(NoteOperationError);
      expect(() => note.setPinned(true)).toThrow('Cannot modify a deleted note');
    });
  });

  describe('archive operations', () => {
    let note: NoteEntity;

    beforeEach(() => {
      note = NoteEntity.create({
        id: 'note-1',
        workspaceId: 'ws-1',
      });
    });

    it('archives note', () => {
      note.archive();

      expect(note.isArchived).toBe(true);
    });

    it('unarchives note', () => {
      note.archive();
      note.unarchive();

      expect(note.isArchived).toBe(false);
    });

    it('clears pinned flag on archive', () => {
      note.setPinned(true);
      note.archive();

      expect(note.isPinned).toBe(false);
    });

    it('throws when note is deleted', () => {
      note.delete();

      expect(() => note.archive()).toThrow(NoteOperationError);
    });

    it('throws when note is already archived', () => {
      note.archive();

      expect(() => note.archive()).toThrow(NoteOperationError);
      expect(() => note.archive()).toThrow('Note is already archived');
    });

    it('throws when unarchiving non-archived note', () => {
      expect(() => note.unarchive()).toThrow(NoteOperationError);
      expect(() => note.unarchive()).toThrow('Note is not archived');
    });

    it('throws when setArchived called on deleted note', () => {
      note.delete();

      expect(() => note.setArchived(true)).toThrow(NoteOperationError);
      expect(() => note.setArchived(true)).toThrow('Cannot modify a deleted note');
    });
  });

  describe('delete/restore operations', () => {
    let note: NoteEntity;

    beforeEach(() => {
      note = NoteEntity.create({
        id: 'note-1',
        workspaceId: 'ws-1',
      });
    });

    it('soft deletes note', () => {
      note.delete();

      expect(note.isDeleted).toBe(true);
      expect(note.deletedAt).toBeInstanceOf(Date);
    });

    it('clears flags on delete', () => {
      note.setFavorite(true);
      note.setPinned(true);
      note.delete();

      expect(note.isFavorite).toBe(false);
      expect(note.isPinned).toBe(false);
    });

    it('restores deleted note', () => {
      note.delete();
      note.restore();

      expect(note.isDeleted).toBe(false);
      expect(note.deletedAt).toBeNull();
    });

    it('throws error when restoring non-deleted note', () => {
      expect(() => note.restore()).toThrow(NoteOperationError);
      expect(() => note.restore()).toThrow('Note is not deleted');
    });

    it('throws error when deleting already deleted note', () => {
      note.delete();

      expect(() => note.delete()).toThrow(NoteOperationError);
      expect(() => note.delete()).toThrow('Note is already deleted');
    });
  });

  describe('canEdit', () => {
    it('returns true for normal note', () => {
      const note = NoteEntity.create({
        id: 'note-1',
        workspaceId: 'ws-1',
      });

      expect(note.canEdit()).toBe(true);
    });

    it('returns false for deleted note', () => {
      const note = NoteEntity.create({
        id: 'note-1',
        workspaceId: 'ws-1',
      });
      note.delete();

      expect(note.canEdit()).toBe(false);
    });
  });

  describe('toPersistence', () => {
    it('converts to persistence format', () => {
      const note = NoteEntity.create({
        id: 'note-1',
        workspaceId: 'ws-1',
        title: 'Test',
        notebookId: 'nb-1',
      });

      const data = note.toPersistence();

      expect(data).toMatchObject({
        id: 'note-1',
        workspaceId: 'ws-1',
        title: 'Test',
        notebookId: 'nb-1',
      });
    });
  });

  describe('fromPersistence', () => {
    it('reconstructs entity from persistence', () => {
      const data = {
        id: 'note-1',
        workspaceId: 'ws-1',
        title: 'Persisted',
        notebookId: 'nb-1',
        filePath: '/path.md',
        isFavorite: true,
        isPinned: false,
        isArchived: false,
        isDeleted: false,
        deletedAt: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      const note = NoteEntity.fromPersistence(data);

      expect(note.id).toBe('note-1');
      expect(note.title).toBe('Persisted');
      expect(note.isFavorite).toBe(true);
      expect(note.createdAt).toEqual(new Date('2024-01-01'));
    });
  });

  describe('toJSON', () => {
    it('converts to JSON format', () => {
      const note = NoteEntity.create({
        id: 'note-1',
        workspaceId: 'ws-1',
        title: 'Test',
        notebookId: 'nb-1',
      });

      const json = note.toJSON();

      expect(json).toMatchObject({
        id: 'note-1',
        workspaceId: 'ws-1',
        title: 'Test',
        notebookId: 'nb-1',
      });
    });
  });
});
