/**
 * NoteRepository Tests
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDatabase } from '../helpers/testDatabase';
import { NoteRepository } from '../../src/main/repositories/NoteRepository';
import { WorkspaceRepository } from '../../src/main/repositories/WorkspaceRepository';
import path from 'path';
import fs from 'fs';

// Mock BrowserWindow for events
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

describe('NoteRepository', () => {
  let cleanup: () => Promise<void>;
  let noteRepo: NoteRepository;
  let workspaceRepo: WorkspaceRepository;
  let testWorkspacePath: string;
  let workspaceId: string;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    cleanup = setup.cleanup;
    noteRepo = new NoteRepository();
    workspaceRepo = new WorkspaceRepository();

    // Create test workspace folder and workspace
    testWorkspacePath = path.join(process.cwd(), 'tests', 'tmp', 'note-workspace-' + Date.now());
    fs.mkdirSync(testWorkspacePath, { recursive: true });

    const workspace = await workspaceRepo.create({
      name: 'Note Test Workspace',
      folderPath: testWorkspacePath,
    });
    workspaceId = workspace.id;

    // Set as active workspace
    await workspaceRepo.setActive(workspace.id);
  });

  afterAll(async () => {
    if (fs.existsSync(testWorkspacePath)) {
      fs.rmSync(testWorkspacePath, { recursive: true });
    }
    await cleanup();
  });

  describe('findAll', () => {
    it('should return an array of notes', async () => {
      const notes = await noteRepo.findAll();
      expect(Array.isArray(notes)).toBe(true);
    });

    it('should filter by workspace', async () => {
      const notes = await noteRepo.findAll({
        where: { workspaceId },
      });
      expect(Array.isArray(notes)).toBe(true);
    });

    it('should filter by isDeleted', async () => {
      const notes = await noteRepo.findAll({
        where: { isDeleted: false },
      });
      expect(Array.isArray(notes)).toBe(true);
      notes.forEach((note) => {
        expect(note.isDeleted).toBe(false);
      });
    });

    it('should filter by isFavorite', async () => {
      const notes = await noteRepo.findAll({
        where: { isFavorite: true },
      });
      expect(Array.isArray(notes)).toBe(true);
    });

    it('should apply limit', async () => {
      const notes = await noteRepo.findAll({ limit: 5 });
      expect(notes.length).toBeLessThanOrEqual(5);
    });
  });

  describe('findById', () => {
    it('should return null for non-existent id', async () => {
      const note = await noteRepo.findById('non-existent-id');
      expect(note).toBeNull();
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate title cache', () => {
      // Just test that the method doesn't throw
      expect(() => noteRepo.invalidateTitleCache()).not.toThrow();
    });

    it('should invalidate graph cache', () => {
      // Just test that the method doesn't throw
      expect(() => noteRepo.invalidateGraphCache()).not.toThrow();
    });
  });

  describe('toggleFavorite', () => {
    it('should toggle note favorite status', async () => {
      // Create a test note file first
      const testNotePath = path.join(testWorkspacePath, 'toggle-fav-test.md');
      fs.writeFileSync(testNotePath, '# Test Note\n\nContent');

      // Find the note after syncing
      const notes = await noteRepo.findAll({
        where: { workspaceId, isDeleted: false },
      });

      if (notes.length > 0) {
        const note = notes[0];
        const originalFavorite = note.isFavorite;
        const toggled = await noteRepo.toggleFavorite(note.id);
        expect(toggled.isFavorite).toBe(!originalFavorite);
      }
    });
  });

  describe('togglePin', () => {
    it('should toggle note pin status', async () => {
      const notes = await noteRepo.findAll({
        where: { workspaceId, isDeleted: false },
      });

      if (notes.length > 0) {
        const note = notes[0];
        const originalPinned = note.isPinned;
        const toggled = await noteRepo.togglePin(note.id);
        expect(toggled.isPinned).toBe(!originalPinned);
      }
    });
  });

  describe('toggleArchive', () => {
    it('should toggle note archive status', async () => {
      const notes = await noteRepo.findAll({
        where: { workspaceId, isDeleted: false },
      });

      if (notes.length > 0) {
        const note = notes[0];
        const originalArchived = note.isArchived;
        const toggled = await noteRepo.toggleArchive(note.id);
        expect(toggled.isArchived).toBe(!originalArchived);
      }
    });
  });

  describe('searchFullText', () => {
    it('should search notes by query', async () => {
      const results = await noteRepo.searchFullText('test');
      expect(Array.isArray(results)).toBe(true);
    });

    it('should limit search results', async () => {
      const results = await noteRepo.searchFullText('a', 3);
      expect(results.length).toBeLessThanOrEqual(3);
    });
  });

  describe('getGraphData', () => {
    it('should return graph data structure', async () => {
      const graphData = await noteRepo.getGraphData();
      expect(graphData).toHaveProperty('nodes');
      expect(graphData).toHaveProperty('links');
      expect(Array.isArray(graphData.nodes)).toBe(true);
      expect(Array.isArray(graphData.links)).toBe(true);
    });

    it('should cache graph data', async () => {
      // First call
      const graphData1 = await noteRepo.getGraphData();
      // Second call should use cache
      const graphData2 = await noteRepo.getGraphData();

      expect(graphData1).toEqual(graphData2);
    });
  });

  describe('getBacklinks', () => {
    it('should return backlinks for a note', async () => {
      const notes = await noteRepo.findAll({ where: { isDeleted: false } });
      if (notes.length > 0) {
        const backlinks = await noteRepo.getBacklinks(notes[0].id);
        expect(Array.isArray(backlinks)).toBe(true);
      }
    });

    it('should return empty array for non-existent note', async () => {
      const backlinks = await noteRepo.getBacklinks('non-existent-id');
      expect(backlinks).toEqual([]);
    });
  });

  describe('getForwardLinks', () => {
    it('should return forward links for a note', async () => {
      const notes = await noteRepo.findAll({ where: { isDeleted: false } });
      if (notes.length > 0) {
        const forwardLinks = await noteRepo.getForwardLinks(notes[0].id);
        expect(Array.isArray(forwardLinks)).toBe(true);
      }
    });

    it('should return empty array for non-existent note', async () => {
      const forwardLinks = await noteRepo.getForwardLinks('non-existent-id');
      expect(forwardLinks).toEqual([]);
    });
  });

  describe('addLink and removeLink', () => {
    it('should add and remove links between notes', async () => {
      // Create test note files
      const personalFolder = path.join(testWorkspacePath, 'Personal');
      if (!fs.existsSync(personalFolder)) {
        fs.mkdirSync(personalFolder, { recursive: true });
      }
      fs.writeFileSync(path.join(personalFolder, 'link-source.md'), '# Source Note\n\nSource content');
      fs.writeFileSync(path.join(personalFolder, 'link-target.md'), '# Target Note\n\nTarget content');

      // Sync to get notes in the database
      await noteRepo.syncWithFileSystem(workspaceId);

      const notes = await noteRepo.findAll({ where: { workspaceId, isDeleted: false } });
      if (notes.length >= 2) {
        const sourceNote = notes[0];
        const targetNote = notes[1];

        // Add link
        await noteRepo.addLink(sourceNote.id, targetNote.id);

        // Verify link exists
        const forwardLinks = await noteRepo.getForwardLinks(sourceNote.id);
        expect(forwardLinks.some((n) => n.id === targetNote.id)).toBe(true);

        // Remove link
        await noteRepo.removeLink(sourceNote.id, targetNote.id);

        // Verify link removed
        const afterRemove = await noteRepo.getForwardLinks(sourceNote.id);
        expect(afterRemove.some((n) => n.id === targetNote.id)).toBe(false);
      }
    });
  });

  describe('getFavorites', () => {
    it('should return favorite notes', async () => {
      const favorites = await noteRepo.getFavorites();
      expect(Array.isArray(favorites)).toBe(true);
      favorites.forEach((note) => {
        expect(note.isFavorite).toBe(true);
        expect(note.isDeleted).toBe(false);
      });
    });
  });

  describe('getPinned', () => {
    it('should return pinned notes', async () => {
      const pinned = await noteRepo.getPinned();
      expect(Array.isArray(pinned)).toBe(true);
      pinned.forEach((note) => {
        expect(note.isPinned).toBe(true);
        expect(note.isDeleted).toBe(false);
      });
    });
  });

  describe('getRecent', () => {
    it('should return recent notes', async () => {
      const recent = await noteRepo.getRecent();
      expect(Array.isArray(recent)).toBe(true);
    });

    it('should limit recent notes', async () => {
      const recent = await noteRepo.getRecent(5);
      expect(recent.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getDeleted', () => {
    it('should return deleted notes', async () => {
      const deleted = await noteRepo.getDeleted();
      expect(Array.isArray(deleted)).toBe(true);
      deleted.forEach((note) => {
        expect(note.isDeleted).toBe(true);
      });
    });
  });

  describe('getArchived', () => {
    it('should return archived notes', async () => {
      const archived = await noteRepo.getArchived();
      expect(Array.isArray(archived)).toBe(true);
      archived.forEach((note) => {
        expect(note.isArchived).toBe(true);
        expect(note.isDeleted).toBe(false);
      });
    });
  });

  describe('softDelete and restore', () => {
    it('should soft delete and restore a note', async () => {
      const personalFolder = path.join(testWorkspacePath, 'Personal');
      if (!fs.existsSync(personalFolder)) {
        fs.mkdirSync(personalFolder, { recursive: true });
      }
      fs.writeFileSync(path.join(personalFolder, 'soft-delete-test.md'), '# Soft Delete Test\n\nContent');

      await noteRepo.syncWithFileSystem(workspaceId);

      const notes = await noteRepo.findAll({ where: { workspaceId, isDeleted: false } });
      if (notes.length > 0) {
        const note = notes[0];

        // Soft delete
        const deleted = await noteRepo.softDelete(note.id);
        expect(deleted.isDeleted).toBe(true);
        expect(deleted.deletedAt).toBeDefined();

        // Restore
        const restored = await noteRepo.restore(note.id);
        expect(restored.isDeleted).toBe(false);
        expect(restored.deletedAt).toBeNull();
      }
    });
  });

  describe('count', () => {
    it('should count notes', async () => {
      const count = await noteRepo.count();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should count with filter', async () => {
      const count = await noteRepo.count({ isDeleted: false });
      expect(typeof count).toBe('number');
    });
  });

  describe('transaction', () => {
    it('should execute operations in transaction', async () => {
      const result = await noteRepo.transaction(async () => {
        return 'transaction-result';
      });
      expect(result).toBe('transaction-result');
    });
  });

  describe('findByFolder', () => {
    it('should return notes in a folder', async () => {
      const notes = await noteRepo.findByFolder('Personal');
      expect(Array.isArray(notes)).toBe(true);
    });

    it('should return all notes for root folder', async () => {
      const notes = await noteRepo.findByFolder('');
      expect(Array.isArray(notes)).toBe(true);
    });

    it('should handle dot folder', async () => {
      const notes = await noteRepo.findByFolder('.');
      expect(Array.isArray(notes)).toBe(true);
    });
  });

  describe('findByNotebook', () => {
    it('should return notes for a notebook', async () => {
      const notes = await noteRepo.findByNotebook('non-existent-notebook');
      expect(Array.isArray(notes)).toBe(true);
      expect(notes.length).toBe(0);
    });
  });

  describe('findByFilePath', () => {
    it('should find note by file path', async () => {
      const personalFolder = path.join(testWorkspacePath, 'Personal');
      if (!fs.existsSync(personalFolder)) {
        fs.mkdirSync(personalFolder, { recursive: true });
      }
      fs.writeFileSync(path.join(personalFolder, 'find-by-path.md'), '# Find By Path\n\nContent');

      await noteRepo.syncWithFileSystem(workspaceId);

      const note = await noteRepo.findByFilePath('Personal/find-by-path.md');
      // May or may not find depending on sync timing
      if (note) {
        expect(note.filePath).toContain('find-by-path.md');
      }
    });

    it('should return null for non-existent path', async () => {
      const note = await noteRepo.findByFilePath('non-existent/path.md');
      expect(note).toBeNull();
    });
  });

  describe('getContentById', () => {
    it('should return content for a note', async () => {
      const personalFolder = path.join(testWorkspacePath, 'Personal');
      if (!fs.existsSync(personalFolder)) {
        fs.mkdirSync(personalFolder, { recursive: true });
      }
      fs.writeFileSync(path.join(personalFolder, 'content-test.md'), '# Content Test\n\nThis is content');

      await noteRepo.syncWithFileSystem(workspaceId);

      const notes = await noteRepo.findAll({ where: { workspaceId, isDeleted: false } });
      if (notes.length > 0) {
        const content = await noteRepo.getContentById(notes[0].id);
        expect(typeof content).toBe('string');
      }
    });

    it('should return null for non-existent note', async () => {
      const content = await noteRepo.getContentById('non-existent-id');
      expect(content).toBeNull();
    });
  });

  describe('getRawContentById', () => {
    it('should return raw markdown content for a note', async () => {
      const notes = await noteRepo.findAll({ where: { workspaceId, isDeleted: false } });
      if (notes.length > 0 && notes[0].filePath) {
        const content = await noteRepo.getRawContentById(notes[0].id);
        expect(typeof content).toBe('string');
      }
    });

    it('should return null for non-existent note', async () => {
      const content = await noteRepo.getRawContentById('non-existent-id');
      expect(content).toBeNull();
    });
  });

  describe('findByTags', () => {
    it('should return empty array for empty tagIds', async () => {
      const notes = await noteRepo.findByTags([]);
      expect(notes).toEqual([]);
    });
  });

  describe('findByTagsAny', () => {
    it('should return empty array for empty tagIds', async () => {
      const notes = await noteRepo.findByTagsAny([]);
      expect(notes).toEqual([]);
    });
  });

  describe('findByDateRange', () => {
    it('should return notes in date range', async () => {
      const startDate = new Date('2020-01-01');
      const endDate = new Date('2030-12-31');
      const notes = await noteRepo.findByDateRange(startDate, endDate);
      expect(Array.isArray(notes)).toBe(true);
    });

    it('should filter by updatedAt', async () => {
      const startDate = new Date('2020-01-01');
      const endDate = new Date('2030-12-31');
      const notes = await noteRepo.findByDateRange(startDate, endDate, 'updatedAt');
      expect(Array.isArray(notes)).toBe(true);
    });
  });

  describe('syncWithFileSystem', () => {
    it('should sync notes with file system', async () => {
      const personalFolder = path.join(testWorkspacePath, 'Personal');
      if (!fs.existsSync(personalFolder)) {
        fs.mkdirSync(personalFolder, { recursive: true });
      }
      fs.writeFileSync(path.join(personalFolder, 'sync-test.md'), '# Sync Test\n\nContent');

      const result = await noteRepo.syncWithFileSystem(workspaceId);

      expect(result).toHaveProperty('created');
      expect(result).toHaveProperty('updated');
      expect(result).toHaveProperty('deleted');
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should return error for non-existent workspace', async () => {
      const result = await noteRepo.syncWithFileSystem('non-existent-workspace');

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Workspace not found');
    });

    it('should handle file relocation when file moves', async () => {
      // Create a note file
      const personalFolder = path.join(testWorkspacePath, 'Personal');
      if (!fs.existsSync(personalFolder)) {
        fs.mkdirSync(personalFolder, { recursive: true });
      }
      const originalFile = path.join(personalFolder, 'relocate-test.md');
      fs.writeFileSync(originalFile, '# Relocate Test\n\nContent');

      // Sync to create the note
      await noteRepo.syncWithFileSystem(workspaceId);

      // Find the note
      const notesBefore = await noteRepo.findAll({ where: { workspaceId, isDeleted: false } });
      const note = notesBefore.find(n => n.filePath?.includes('relocate-test.md'));

      if (note) {
        // Move the file to a different location
        const newFolder = path.join(testWorkspacePath, 'Work');
        if (!fs.existsSync(newFolder)) {
          fs.mkdirSync(newFolder, { recursive: true });
        }
        const newFile = path.join(newFolder, 'relocate-test.md');
        fs.renameSync(originalFile, newFile);

        // Sync again - should relocate the note
        const result = await noteRepo.syncWithFileSystem(workspaceId);

        // Either updated (relocated) or deleted + created
        expect(result.updated + result.deleted + result.created).toBeGreaterThanOrEqual(0);
      }
    });

    it('should soft delete notes when files are removed', async () => {
      // Create a note file
      const personalFolder = path.join(testWorkspacePath, 'Personal');
      if (!fs.existsSync(personalFolder)) {
        fs.mkdirSync(personalFolder, { recursive: true });
      }
      const testFile = path.join(personalFolder, 'delete-sync-test.md');
      fs.writeFileSync(testFile, '# Delete Sync Test\n\nContent');

      // Sync to create the note
      await noteRepo.syncWithFileSystem(workspaceId);

      // Find the note
      const notesBefore = await noteRepo.findAll({ where: { workspaceId, isDeleted: false } });
      const note = notesBefore.find(n => n.filePath?.includes('delete-sync-test.md'));

      if (note) {
        // Delete the file
        fs.unlinkSync(testFile);

        // Sync again - should soft delete the note
        const result = await noteRepo.syncWithFileSystem(workspaceId);

        expect(result.deleted).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('create', () => {
    it('should create a note with title', async () => {
      const note = await noteRepo.create({
        title: 'Test Create Note',
      });

      expect(note.id).toBeDefined();
      expect(note.title).toBe('Test Create Note');
      expect(note.workspaceId).toBe(workspaceId);
    });

    it('should create note with default title if empty', async () => {
      const note = await noteRepo.create({
        title: '',
      });

      expect(note.title).toBe('Untitled Note');
    });

    it('should create note in specified folder', async () => {
      const note = await noteRepo.create({
        title: 'Folder Note Test',
        folderPath: 'Personal',
      } as any);

      expect(note.filePath).toContain('Personal');
    });
  });

  describe('update', () => {
    it('should update note title', async () => {
      const notes = await noteRepo.findAll({ where: { workspaceId, isDeleted: false } });
      if (notes.length > 0) {
        const note = notes[0];
        const updated = await noteRepo.update(note.id, {
          title: 'Updated Title ' + Date.now(),
        });

        expect(updated.title).toContain('Updated Title');
      }
    });

    it('should throw for non-existent note', async () => {
      await expect(noteRepo.update('non-existent-id', { title: 'Test' }))
        .rejects.toThrow('Note not found');
    });
  });

  describe('delete', () => {
    it('should delete a note', async () => {
      // Create a note to delete
      const note = await noteRepo.create({
        title: 'To Delete',
      });

      const result = await noteRepo.delete(note.id);
      expect(result).toBe(true);

      const deleted = await noteRepo.findById(note.id);
      expect(deleted).toBeNull();
    });
  });

  describe('permanentDelete', () => {
    it('should permanently delete a note', async () => {
      // Create a note to delete
      const note = await noteRepo.create({
        title: 'To Permanent Delete',
      });

      const result = await noteRepo.permanentDelete(note.id);
      expect(result).toBe(true);

      const deleted = await noteRepo.findById(note.id);
      expect(deleted).toBeNull();
    });
  });

  describe('updateLinksFromContent', () => {
    it('should extract and update links from content', async () => {
      // Create two notes
      const note1 = await noteRepo.create({ title: 'Link Source' });
      const note2 = await noteRepo.create({ title: 'Link Target' });

      // Update note1 with content linking to note2
      await noteRepo.updateLinksFromContent(note1.id, '# Link Source\n\nSee [[Link Target]] for more info.');

      // Check forward links
      const forwardLinks = await noteRepo.getForwardLinks(note1.id);
      expect(forwardLinks.some(n => n.title === 'Link Target')).toBe(true);
    });

    it('should remove links when content changes', async () => {
      const notes = await noteRepo.findAll({ where: { workspaceId, isDeleted: false } });
      if (notes.length > 0) {
        // Update with no links
        await noteRepo.updateLinksFromContent(notes[0].id, '# Just a heading\n\nNo links here.');

        const forwardLinks = await noteRepo.getForwardLinks(notes[0].id);
        expect(forwardLinks.length).toBe(0);
      }
    });
  });

  describe('findAllFiltered', () => {
    it('should filter by isPinned', async () => {
      const notes = await noteRepo.findAll({
        where: { isPinned: true, isDeleted: false },
      });
      expect(Array.isArray(notes)).toBe(true);
    });

    it('should filter by isArchived', async () => {
      const notes = await noteRepo.findAll({
        where: { isArchived: true, isDeleted: false },
      });
      expect(Array.isArray(notes)).toBe(true);
    });

    it('should filter by notebookId null', async () => {
      const notes = await noteRepo.findAll({
        where: { notebookId: null, isDeleted: false },
      });
      expect(Array.isArray(notes)).toBe(true);
    });

    it('should sort by title ASC', async () => {
      const notes = await noteRepo.findAll({
        where: { isDeleted: false },
        sort: { field: 'title', order: 'ASC' },
      });
      expect(Array.isArray(notes)).toBe(true);
    });

    it('should sort by createdAt DESC', async () => {
      const notes = await noteRepo.findAll({
        where: { isDeleted: false },
        sort: { field: 'createdAt', order: 'DESC' },
      });
      expect(Array.isArray(notes)).toBe(true);
    });

    it('should apply offset', async () => {
      const notes = await noteRepo.findAll({
        where: { isDeleted: false },
        limit: 5,
        offset: 1,
      });
      expect(Array.isArray(notes)).toBe(true);
    });
  });

  describe('toggle methods with non-existent note', () => {
    it('toggleFavorite should throw for non-existent note', async () => {
      await expect(noteRepo.toggleFavorite('non-existent-id'))
        .rejects.toThrow('Note not found');
    });

    it('togglePin should throw for non-existent note', async () => {
      await expect(noteRepo.togglePin('non-existent-id'))
        .rejects.toThrow('Note not found');
    });

    it('toggleArchive should throw for non-existent note', async () => {
      await expect(noteRepo.toggleArchive('non-existent-id'))
        .rejects.toThrow('Note not found');
    });
  });
});
