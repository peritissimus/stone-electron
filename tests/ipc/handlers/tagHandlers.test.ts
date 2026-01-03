/**
 * Tag IPC Handler Tests
 *
 * Tests IPC layer concerns: parameter mapping, error code mapping, response formatting.
 * Business logic is tested in TagService.test.ts
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

// Mock TagService
const mockTagService = {
  createTag: vi.fn(),
  deleteTag: vi.fn(),
  getAllTags: vi.fn(),
  addTagsToNote: vi.fn(),
  removeTagFromNote: vi.fn(),
};

vi.mock('../../../src/main/services/TagService', () => ({
  getTagService: vi.fn(() => mockTagService),
}));

// Import after mocks
import { registerTagHandlers } from '../../../src/main/ipc/handlers/tagHandlers';
import { ipcMain } from 'electron';

// Create mock container
const mockContainer = {
  cradle: {
    tagService: mockTagService,
  },
} as any;

describe('Tag IPC Handlers', () => {
  let registeredHandlers: Map<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    registeredHandlers = new Map();

    (ipcMain.handle as any).mockImplementation((channel: string, handler: Function) => {
      registeredHandlers.set(channel, handler);
    });

    registerTagHandlers(mockContainer);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('tags:create', () => {
    it('should call service and return formatted response', async () => {
      const mockTag = { id: 'tag-1', name: 'Test Tag', color: '#ff0000', note_count: 0 };
      mockTagService.createTag.mockResolvedValue(mockTag);

      const handler = registeredHandlers.get('tags:create');
      const result = await handler({}, { name: 'Test Tag', color: '#ff0000' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockTag);
      expect(mockTagService.createTag).toHaveBeenCalledWith({
        name: 'Test Tag',
        color: '#ff0000',
      });
    });

    it('should map duplicate error to DUPLICATE code', async () => {
      mockTagService.createTag.mockRejectedValue(new Error('Tag with this name already exists'));

      const handler = registeredHandlers.get('tags:create');
      const result = await handler({}, { name: 'Test Tag' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('DUPLICATE');
    });
  });

  describe('tags:delete', () => {
    it('should call service and format affected_notes response', async () => {
      mockTagService.deleteTag.mockResolvedValue({ affectedNotes: 5 });

      const handler = registeredHandlers.get('tags:delete');
      const result = await handler({}, { id: 'tag-1' });

      expect(result.success).toBe(true);
      expect(result.data.affected_notes).toBe(5);
      expect(mockTagService.deleteTag).toHaveBeenCalledWith('tag-1');
    });

    it('should map not found error to NOT_FOUND code', async () => {
      mockTagService.deleteTag.mockRejectedValue(new Error('Tag not found'));

      const handler = registeredHandlers.get('tags:delete');
      const result = await handler({}, { id: 'non-existent' });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });
  });

  describe('tags:getAll', () => {
    it('should pass sort parameter to service', async () => {
      mockTagService.getAllTags.mockResolvedValue([]);

      const handler = registeredHandlers.get('tags:getAll');
      const result = await handler({}, { sort: 'count' });

      expect(result.success).toBe(true);
      expect(result.data.tags).toEqual([]);
      expect(mockTagService.getAllTags).toHaveBeenCalledWith('count');
    });
  });

  describe('tags:addToNote', () => {
    it('should call service with noteId and tagIds', async () => {
      const mockTags = [{ id: 'tag-1', name: 'Tag 1' }];
      mockTagService.addTagsToNote.mockResolvedValue(mockTags);

      const handler = registeredHandlers.get('tags:addToNote');
      const result = await handler({}, { noteId: 'note-1', tagIds: ['tag-1'] });

      expect(result.success).toBe(true);
      expect(result.data.tags).toEqual(mockTags);
      expect(mockTagService.addTagsToNote).toHaveBeenCalledWith('note-1', ['tag-1']);
    });

    it('should map note not found error to NOT_FOUND code', async () => {
      mockTagService.addTagsToNote.mockRejectedValue(new Error('Note not found'));

      const handler = registeredHandlers.get('tags:addToNote');
      const result = await handler({}, { noteId: 'bad', tagIds: ['tag-1'] });

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('NOT_FOUND');
    });
  });

  describe('tags:removeFromNote', () => {
    it('should call service and return noteId in response', async () => {
      mockTagService.removeTagFromNote.mockResolvedValue(undefined);

      const handler = registeredHandlers.get('tags:removeFromNote');
      const result = await handler({}, { noteId: 'note-1', tagId: 'tag-1' });

      expect(result.success).toBe(true);
      expect(result.data.noteId).toBe('note-1');
      expect(mockTagService.removeTagFromNote).toHaveBeenCalledWith('note-1', 'tag-1');
    });
  });
});
