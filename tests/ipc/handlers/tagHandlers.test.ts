/**
 * Tag IPC Handler Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock electron before importing handlers
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
  ipcMain: {
    handle: vi.fn(),
  },
}));

// Mock repositories
const mockTagRepo = {
  findOne: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  getAllWithCounts: vi.fn(),
  addToNote: vi.fn(),
  removeFromNote: vi.fn(),
  deleteWithAssociations: vi.fn(),
  getTagsForNote: vi.fn(),
};

const mockNoteRepo = {
  findById: vi.fn(),
};

vi.mock('../../../src/main/repositories', () => ({
  getRepositories: vi.fn(() => ({
    tag: mockTagRepo,
    note: mockNoteRepo,
  })),
}));

// Import after mocks
import { registerTagHandlers } from '../../../src/main/ipc/handlers/tagHandlers';
import { ipcMain } from 'electron';

describe('Tag IPC Handlers', () => {
  let registeredHandlers: Map<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    registeredHandlers = new Map();

    // Capture registered handlers
    (ipcMain.handle as any).mockImplementation((channel: string, handler: Function) => {
      registeredHandlers.set(channel, handler);
    });

    registerTagHandlers();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('tags:create', () => {
    it('should create a new tag', async () => {
      const mockTag = { id: 'tag-1', name: 'Test Tag', color: '#ff0000', createdAt: new Date() };
      mockTagRepo.findOne.mockResolvedValue(null);
      mockTagRepo.create.mockResolvedValue(mockTag);

      const handler = registeredHandlers.get('tags:create');
      const result = await handler({}, { name: 'Test Tag', color: '#ff0000' });

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Test Tag');
      expect(result.data.note_count).toBe(0);
      expect(mockTagRepo.create).toHaveBeenCalledWith({
        name: 'Test Tag',
        color: '#ff0000',
      });
    });

    it('should use default color if not provided', async () => {
      const mockTag = { id: 'tag-1', name: 'Test Tag', color: '#6b7280', createdAt: new Date() };
      mockTagRepo.findOne.mockResolvedValue(null);
      mockTagRepo.create.mockResolvedValue(mockTag);

      const handler = registeredHandlers.get('tags:create');
      await handler({}, { name: 'Test Tag' });

      expect(mockTagRepo.create).toHaveBeenCalledWith({
        name: 'Test Tag',
        color: '#6b7280',
      });
    });

    it('should reject duplicate tag names', async () => {
      mockTagRepo.findOne.mockResolvedValue({ id: 'existing', name: 'Test Tag' });

      const handler = registeredHandlers.get('tags:create');
      const result = await handler({}, { name: 'Test Tag' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('DUPLICATE');
    });
  });

  describe('tags:delete', () => {
    it('should delete a tag', async () => {
      mockTagRepo.findById.mockResolvedValue({ id: 'tag-1', name: 'Test Tag' });
      mockTagRepo.getAllWithCounts.mockResolvedValue([{ id: 'tag-1', note_count: 5 }]);
      mockTagRepo.deleteWithAssociations.mockResolvedValue(true);

      const handler = registeredHandlers.get('tags:delete');
      const result = await handler({}, { id: 'tag-1' });

      expect(result.success).toBe(true);
      expect(result.data.affected_notes).toBe(5);
      expect(mockTagRepo.deleteWithAssociations).toHaveBeenCalledWith('tag-1');
    });

    it('should return error if tag not found', async () => {
      mockTagRepo.findById.mockResolvedValue(null);

      const handler = registeredHandlers.get('tags:delete');
      const result = await handler({}, { id: 'non-existent' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });
  });

  describe('tags:getAll', () => {
    const mockTags = [
      { id: 'tag-1', name: 'Alpha', note_count: 3, createdAt: new Date('2024-01-01') },
      { id: 'tag-2', name: 'Beta', note_count: 5, createdAt: new Date('2024-01-02') },
      { id: 'tag-3', name: 'Gamma', note_count: 1, createdAt: new Date('2024-01-03') },
    ];

    it('should return all tags sorted by name (default)', async () => {
      mockTagRepo.getAllWithCounts.mockResolvedValue([...mockTags]);

      const handler = registeredHandlers.get('tags:getAll');
      const result = await handler({}, {});

      expect(result.success).toBe(true);
      expect(result.data.tags[0].name).toBe('Alpha');
      expect(result.data.tags[1].name).toBe('Beta');
      expect(result.data.tags[2].name).toBe('Gamma');
    });

    it('should sort by count when requested', async () => {
      mockTagRepo.getAllWithCounts.mockResolvedValue([...mockTags]);

      const handler = registeredHandlers.get('tags:getAll');
      const result = await handler({}, { sort: 'count' });

      expect(result.success).toBe(true);
      expect(result.data.tags[0].note_count).toBe(5); // Beta first
      expect(result.data.tags[1].note_count).toBe(3); // Alpha
      expect(result.data.tags[2].note_count).toBe(1); // Gamma
    });

    it('should sort by recent when requested', async () => {
      mockTagRepo.getAllWithCounts.mockResolvedValue([...mockTags]);

      const handler = registeredHandlers.get('tags:getAll');
      const result = await handler({}, { sort: 'recent' });

      expect(result.success).toBe(true);
      // Most recent first
      expect(result.data.tags[0].name).toBe('Gamma');
    });
  });

  describe('tags:addToNote', () => {
    it('should add tags to a note', async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: 'note-1', title: 'Test Note' });
      mockTagRepo.addToNote.mockResolvedValue(undefined);
      mockTagRepo.getTagsForNote.mockResolvedValue([
        { id: 'tag-1', name: 'Tag 1' },
        { id: 'tag-2', name: 'Tag 2' },
      ]);

      const handler = registeredHandlers.get('tags:addToNote');
      const result = await handler({}, { noteId: 'note-1', tagIds: ['tag-1', 'tag-2'] });

      expect(result.success).toBe(true);
      expect(result.data.tags.length).toBe(2);
      expect(mockTagRepo.addToNote).toHaveBeenCalledTimes(2);
    });

    it('should return error if note not found', async () => {
      mockNoteRepo.findById.mockResolvedValue(null);

      const handler = registeredHandlers.get('tags:addToNote');
      const result = await handler({}, { noteId: 'non-existent', tagIds: ['tag-1'] });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });
  });

  describe('tags:removeFromNote', () => {
    it('should remove a tag from a note', async () => {
      mockTagRepo.removeFromNote.mockResolvedValue(undefined);

      const handler = registeredHandlers.get('tags:removeFromNote');
      const result = await handler({}, { noteId: 'note-1', tagId: 'tag-1' });

      expect(result.success).toBe(true);
      expect(result.data.noteId).toBe('note-1');
      expect(mockTagRepo.removeFromNote).toHaveBeenCalledWith('note-1', 'tag-1');
    });
  });
});
