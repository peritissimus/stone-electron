/**
 * AttachmentRepository Tests
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { setupTestDatabase } from '../helpers/testDatabase';
import { AttachmentRepository } from '../../src/main/repositories/AttachmentRepository';
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

describe('AttachmentRepository', () => {
  let cleanup: () => Promise<void>;
  let attachmentRepo: AttachmentRepository;
  let noteRepo: NoteRepository;
  let workspaceRepo: WorkspaceRepository;
  let testWorkspacePath: string;
  let workspaceId: string;
  let testNoteId: string;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    cleanup = setup.cleanup;
    attachmentRepo = new AttachmentRepository();
    noteRepo = new NoteRepository();
    workspaceRepo = new WorkspaceRepository();

    // Create test workspace folder and workspace
    testWorkspacePath = path.join(process.cwd(), 'tests', 'tmp', 'attachment-workspace-' + Date.now());
    fs.mkdirSync(testWorkspacePath, { recursive: true });

    // Create Personal folder (required for note creation)
    const personalFolder = path.join(testWorkspacePath, 'Personal');
    fs.mkdirSync(personalFolder, { recursive: true });

    const workspace = await workspaceRepo.create({
      name: 'Attachment Test Workspace',
      folderPath: testWorkspacePath,
    });
    workspaceId = workspace.id;

    // Set as active workspace
    await workspaceRepo.setActive(workspace.id);

    // Create a test note file and sync
    fs.writeFileSync(path.join(personalFolder, 'attachment-test-note.md'), '# Test Note\n\nContent for attachments');
    await noteRepo.syncWithFileSystem(workspaceId);

    // Get the note from the database
    const notes = await noteRepo.findAll({ where: { workspaceId, isDeleted: false } });
    if (notes.length > 0) {
      testNoteId = notes[0].id;
    } else {
      throw new Error('Failed to create test note for attachment tests');
    }
  });

  afterAll(async () => {
    if (fs.existsSync(testWorkspacePath)) {
      fs.rmSync(testWorkspacePath, { recursive: true });
    }
    await cleanup();
  });

  describe('create', () => {
    it('should create an attachment', async () => {
      const attachment = await attachmentRepo.create({
        noteId: testNoteId,
        filename: 'test-image.png',
        mimeType: 'image/png',
        size: 1024,
        path: '/attachments/test-image.png',
      });

      expect(attachment.id).toBeDefined();
      expect(attachment.noteId).toBe(testNoteId);
      expect(attachment.filename).toBe('test-image.png');
      expect(attachment.mimeType).toBe('image/png');
      expect(attachment.size).toBe(1024);
      expect(attachment.path).toBe('/attachments/test-image.png');
      expect(attachment.createdAt).toBeDefined();
    });

    it('should create multiple attachments for same note', async () => {
      await attachmentRepo.create({
        noteId: testNoteId,
        filename: 'doc1.pdf',
        mimeType: 'application/pdf',
        size: 2048,
        path: '/attachments/doc1.pdf',
      });

      await attachmentRepo.create({
        noteId: testNoteId,
        filename: 'doc2.pdf',
        mimeType: 'application/pdf',
        size: 4096,
        path: '/attachments/doc2.pdf',
      });

      const attachments = await attachmentRepo.getAttachmentsForNote(testNoteId);
      expect(attachments.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('findById', () => {
    it('should find attachment by id', async () => {
      const created = await attachmentRepo.create({
        noteId: testNoteId,
        filename: 'find-test.jpg',
        mimeType: 'image/jpeg',
        size: 512,
        path: '/attachments/find-test.jpg',
      });

      const found = await attachmentRepo.findById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.filename).toBe('find-test.jpg');
    });

    it('should return undefined for non-existent id', async () => {
      const found = await attachmentRepo.findById('non-existent-id');
      expect(found).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('should delete an attachment', async () => {
      const created = await attachmentRepo.create({
        noteId: testNoteId,
        filename: 'delete-test.txt',
        mimeType: 'text/plain',
        size: 100,
        path: '/attachments/delete-test.txt',
      });

      const result = await attachmentRepo.delete(created.id);
      expect(result).toBe(true);

      const found = await attachmentRepo.findById(created.id);
      expect(found).toBeUndefined();
    });
  });

  describe('getAttachmentsForNote', () => {
    it('should return attachments for a specific note', async () => {
      // Use the testNoteId which we know exists
      await attachmentRepo.create({
        noteId: testNoteId,
        filename: 'note-specific-1.png',
        mimeType: 'image/png',
        size: 256,
        path: '/attachments/note-specific-1.png',
      });

      await attachmentRepo.create({
        noteId: testNoteId,
        filename: 'note-specific-2.png',
        mimeType: 'image/png',
        size: 512,
        path: '/attachments/note-specific-2.png',
      });

      const attachments = await attachmentRepo.getAttachmentsForNote(testNoteId);

      expect(Array.isArray(attachments)).toBe(true);
      expect(attachments.length).toBeGreaterThanOrEqual(2);
      attachments.forEach((att) => {
        expect(att.noteId).toBe(testNoteId);
      });
    });

    it('should return empty array for note without attachments', async () => {
      const attachments = await attachmentRepo.getAttachmentsForNote('note-without-attachments');
      expect(attachments).toEqual([]);
    });

    it('should order by createdAt descending', async () => {
      // Use testNoteId - attachments from previous test will be included
      const attachments = await attachmentRepo.getAttachmentsForNote(testNoteId);
      expect(attachments.length).toBeGreaterThanOrEqual(1);
      // Verify it's an array ordered properly (most recent first)
      if (attachments.length >= 2) {
        expect(attachments[0].createdAt >= attachments[1].createdAt).toBe(true);
      }
    });
  });

  describe('getAttachmentsForNotes', () => {
    it('should return attachments grouped by noteId', async () => {
      // Use testNoteId which has attachments
      const result = await attachmentRepo.getAttachmentsForNotes([testNoteId]);

      expect(result instanceof Map).toBe(true);
      expect(result.get(testNoteId)?.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty map for empty noteIds array', async () => {
      const result = await attachmentRepo.getAttachmentsForNotes([]);
      expect(result instanceof Map).toBe(true);
      expect(result.size).toBe(0);
    });

    it('should handle noteIds with no attachments', async () => {
      const result = await attachmentRepo.getAttachmentsForNotes(['no-attachments-note']);
      expect(result instanceof Map).toBe(true);
      expect(result.has('no-attachments-note')).toBe(false);
    });
  });
});
