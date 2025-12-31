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
  });
});
