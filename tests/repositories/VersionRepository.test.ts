/**
 * VersionRepository Tests
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { setupTestDatabase } from '../helpers/testDatabase';
import { VersionRepository } from '../../src/main/repositories/VersionRepository';
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

describe('VersionRepository', () => {
  let cleanup: () => Promise<void>;
  let versionRepo: VersionRepository;
  let noteRepo: NoteRepository;
  let workspaceRepo: WorkspaceRepository;
  let testWorkspacePath: string;
  let workspaceId: string;
  let testNoteId: string;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    cleanup = setup.cleanup;
    versionRepo = new VersionRepository();
    noteRepo = new NoteRepository();
    workspaceRepo = new WorkspaceRepository();

    // Create test workspace folder and workspace
    testWorkspacePath = path.join(process.cwd(), 'tests', 'tmp', 'version-workspace-' + Date.now());
    fs.mkdirSync(testWorkspacePath, { recursive: true });

    // Create Personal folder (required for note creation)
    const personalFolder = path.join(testWorkspacePath, 'Personal');
    fs.mkdirSync(personalFolder, { recursive: true });

    const workspace = await workspaceRepo.create({
      name: 'Version Test Workspace',
      folderPath: testWorkspacePath,
    });
    workspaceId = workspace.id;

    // Set as active workspace
    await workspaceRepo.setActive(workspace.id);

    // Create a test note file and sync
    fs.writeFileSync(path.join(personalFolder, 'version-test-note.md'), '# Version Test\n\nContent for versions');
    await noteRepo.syncWithFileSystem(workspaceId);

    // Get the note from the database
    const notes = await noteRepo.findAll({ where: { workspaceId, isDeleted: false } });
    if (notes.length > 0) {
      testNoteId = notes[0].id;
    } else {
      throw new Error('Failed to create test note for version tests');
    }
  });

  afterAll(async () => {
    if (fs.existsSync(testWorkspacePath)) {
      fs.rmSync(testWorkspacePath, { recursive: true });
    }
    await cleanup();
  });

  describe('createVersion', () => {
    it('should create a version with incrementing version numbers', async () => {
      const v1 = await versionRepo.createVersion(testNoteId, 'Title v1', '<p>Content v1</p>');
      expect(v1.id).toBeDefined();
      expect(v1.noteId).toBe(testNoteId);
      expect(v1.title).toBe('Title v1');
      expect(v1.content).toBe('<p>Content v1</p>');
      expect(v1.versionNumber).toBe(1);
      expect(v1.createdAt).toBeDefined();

      const v2 = await versionRepo.createVersion(testNoteId, 'Title v2', '<p>Content v2</p>');
      expect(v2.versionNumber).toBe(2);

      const v3 = await versionRepo.createVersion(testNoteId, 'Title v3', '<p>Content v3</p>');
      expect(v3.versionNumber).toBe(3);
    });
  });

  describe('findById', () => {
    it('should find version by id', async () => {
      const created = await versionRepo.createVersion(testNoteId, 'Find Test', 'Find Content');

      const found = await versionRepo.findById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.title).toBe('Find Test');
      expect(found?.content).toBe('Find Content');
    });

    it('should return undefined for non-existent id', async () => {
      const found = await versionRepo.findById('non-existent-version-id');
      expect(found).toBeUndefined();
    });
  });

  describe('getVersionSummary', () => {
    it('should return version summary for a note', async () => {
      const summary = await versionRepo.getVersionSummary(testNoteId);

      expect(Array.isArray(summary)).toBe(true);
      expect(summary.length).toBeGreaterThanOrEqual(1);

      // Each summary should have expected fields
      summary.forEach((s) => {
        expect(s.versionNumber).toBeDefined();
        expect(s.title).toBeDefined();
        expect(s.createdAt).toBeDefined();
        expect(typeof s.contentLength).toBe('number');
      });
    });

    it('should return empty array for note without versions', async () => {
      const summary = await versionRepo.getVersionSummary('note-without-versions');
      expect(summary).toEqual([]);
    });
  });
});
