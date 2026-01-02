/**
 * TagService Tests
 *
 * Unit tests for tag management service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock electron
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
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
  setTagsForNote: vi.fn(),
};

const mockNoteRepo = {
  findById: vi.fn(),
};

vi.mock('../../src/main/repositories', () => ({
  getRepositories: vi.fn(() => ({
    tag: mockTagRepo,
    note: mockNoteRepo,
  })),
}));

// Mock EventBus
const mockEventBus = {
  emit: vi.fn(),
};

vi.mock('../../src/main/services/EventBus', () => ({
  getEventBus: vi.fn(() => mockEventBus),
}));

// Import after mocks
import { getTagService, TagService } from '../../src/main/services/TagService';

describe('TagService', () => {
  let tagService: ReturnType<typeof getTagService>;

  beforeEach(() => {
    vi.clearAllMocks();
    tagService = getTagService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createTag', () => {
    it('should create a new tag', async () => {
      const mockTag = { id: 'tag-1', name: 'Test Tag', color: '#ff0000', createdAt: new Date(), updatedAt: new Date() };
      mockTagRepo.findOne.mockResolvedValue(null);
      mockTagRepo.create.mockResolvedValue(mockTag);

      const result = await tagService.createTag({ name: 'Test Tag', color: '#ff0000' });

      expect(result.name).toBe('Test Tag');
      expect(result.color).toBe('#ff0000');
      expect(result.note_count).toBe(0);
      expect(mockTagRepo.create).toHaveBeenCalledWith({
        name: 'Test Tag',
        color: '#ff0000',
      });
      expect(mockEventBus.emit).toHaveBeenCalledWith('tags:created', { tag: mockTag });
    });

    it('should use default color if not provided', async () => {
      const mockTag = { id: 'tag-1', name: 'Test Tag', color: '#6b7280', createdAt: new Date(), updatedAt: new Date() };
      mockTagRepo.findOne.mockResolvedValue(null);
      mockTagRepo.create.mockResolvedValue(mockTag);

      await tagService.createTag({ name: 'Test Tag' });

      expect(mockTagRepo.create).toHaveBeenCalledWith({
        name: 'Test Tag',
        color: '#6b7280',
      });
    });

    it('should throw error for duplicate tag names', async () => {
      mockTagRepo.findOne.mockResolvedValue({ id: 'existing', name: 'Test Tag' });

      await expect(tagService.createTag({ name: 'Test Tag' })).rejects.toThrow('Tag with this name already exists');
    });
  });

  describe('deleteTag', () => {
    it('should delete a tag and return affected notes count', async () => {
      mockTagRepo.findById.mockResolvedValue({ id: 'tag-1', name: 'Test Tag' });
      mockTagRepo.getAllWithCounts.mockResolvedValue([{ id: 'tag-1', note_count: 5, name: 'Test Tag' }]);
      mockTagRepo.deleteWithAssociations.mockResolvedValue(true);

      const result = await tagService.deleteTag('tag-1');

      expect(result.affectedNotes).toBe(5);
      expect(mockTagRepo.deleteWithAssociations).toHaveBeenCalledWith('tag-1');
      expect(mockEventBus.emit).toHaveBeenCalledWith('tags:deleted', { id: 'tag-1' });
    });

    it('should throw error if tag not found', async () => {
      mockTagRepo.findById.mockResolvedValue(null);

      await expect(tagService.deleteTag('non-existent')).rejects.toThrow('Tag not found');
    });

    it('should return 0 affected notes if tag has no associations', async () => {
      mockTagRepo.findById.mockResolvedValue({ id: 'tag-1', name: 'Empty Tag' });
      mockTagRepo.getAllWithCounts.mockResolvedValue([{ id: 'tag-1', note_count: 0, name: 'Empty Tag' }]);
      mockTagRepo.deleteWithAssociations.mockResolvedValue(true);

      const result = await tagService.deleteTag('tag-1');

      expect(result.affectedNotes).toBe(0);
    });
  });

  describe('getAllTags', () => {
    const mockTags = [
      { id: 'tag-1', name: 'Beta', note_count: 3, createdAt: new Date('2024-01-02') },
      { id: 'tag-2', name: 'Alpha', note_count: 5, createdAt: new Date('2024-01-01') },
      { id: 'tag-3', name: 'Gamma', note_count: 1, createdAt: new Date('2024-01-03') },
    ];

    it('should return tags sorted by name (default)', async () => {
      mockTagRepo.getAllWithCounts.mockResolvedValue([...mockTags]);

      const result = await tagService.getAllTags();

      expect(result[0].name).toBe('Alpha');
      expect(result[1].name).toBe('Beta');
      expect(result[2].name).toBe('Gamma');
    });

    it('should sort by name explicitly', async () => {
      mockTagRepo.getAllWithCounts.mockResolvedValue([...mockTags]);

      const result = await tagService.getAllTags('name');

      expect(result[0].name).toBe('Alpha');
      expect(result[2].name).toBe('Gamma');
    });

    it('should sort by count', async () => {
      mockTagRepo.getAllWithCounts.mockResolvedValue([...mockTags]);

      const result = await tagService.getAllTags('count');

      expect(result[0].note_count).toBe(5); // Alpha
      expect(result[1].note_count).toBe(3); // Beta
      expect(result[2].note_count).toBe(1); // Gamma
    });

    it('should sort by recent (createdAt)', async () => {
      mockTagRepo.getAllWithCounts.mockResolvedValue([...mockTags]);

      const result = await tagService.getAllTags('recent');

      expect(result[0].name).toBe('Gamma'); // Jan 03
      expect(result[1].name).toBe('Beta');  // Jan 02
      expect(result[2].name).toBe('Alpha'); // Jan 01
    });
  });

  describe('findById', () => {
    it('should find tag by id', async () => {
      const mockTag = { id: 'tag-1', name: 'Test Tag' };
      mockTagRepo.findById.mockResolvedValue(mockTag);

      const result = await tagService.findById('tag-1');

      expect(result).toEqual(mockTag);
    });

    it('should return null if tag not found', async () => {
      mockTagRepo.findById.mockResolvedValue(undefined);

      const result = await tagService.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByName', () => {
    it('should find tag by name', async () => {
      const mockTag = { id: 'tag-1', name: 'Test Tag' };
      mockTagRepo.findOne.mockResolvedValue(mockTag);

      const result = await tagService.findByName('Test Tag');

      expect(result).toEqual(mockTag);
      expect(mockTagRepo.findOne).toHaveBeenCalledWith({ name: 'Test Tag' });
    });

    it('should return null if tag not found', async () => {
      mockTagRepo.findOne.mockResolvedValue(undefined);

      const result = await tagService.findByName('Non-existent');

      expect(result).toBeNull();
    });
  });

  describe('addTagsToNote', () => {
    it('should add tags to a note', async () => {
      const mockNote = { id: 'note-1', title: 'Test Note' };
      const mockTags = [
        { id: 'tag-1', name: 'Tag 1' },
        { id: 'tag-2', name: 'Tag 2' },
      ];
      mockNoteRepo.findById.mockResolvedValue(mockNote);
      mockTagRepo.addToNote.mockResolvedValue(undefined);
      mockTagRepo.getTagsForNote.mockResolvedValue(mockTags);

      const result = await tagService.addTagsToNote('note-1', ['tag-1', 'tag-2']);

      expect(result).toEqual(mockTags);
      expect(mockTagRepo.addToNote).toHaveBeenCalledTimes(2);
      expect(mockTagRepo.addToNote).toHaveBeenCalledWith('note-1', 'tag-1');
      expect(mockTagRepo.addToNote).toHaveBeenCalledWith('note-1', 'tag-2');
    });

    it('should throw error if note not found', async () => {
      mockNoteRepo.findById.mockResolvedValue(null);

      await expect(tagService.addTagsToNote('non-existent', ['tag-1'])).rejects.toThrow('Note not found');
    });
  });

  describe('removeTagFromNote', () => {
    it('should remove a tag from a note', async () => {
      mockTagRepo.removeFromNote.mockResolvedValue(undefined);

      await tagService.removeTagFromNote('note-1', 'tag-1');

      expect(mockTagRepo.removeFromNote).toHaveBeenCalledWith('note-1', 'tag-1');
    });
  });

  describe('getTagsForNote', () => {
    it('should return tags for a note', async () => {
      const mockTags = [
        { id: 'tag-1', name: 'Tag 1' },
        { id: 'tag-2', name: 'Tag 2' },
      ];
      mockTagRepo.getTagsForNote.mockResolvedValue(mockTags);

      const result = await tagService.getTagsForNote('note-1');

      expect(result).toEqual(mockTags);
      expect(mockTagRepo.getTagsForNote).toHaveBeenCalledWith('note-1');
    });
  });

  describe('setTagsForNote', () => {
    it('should set tags for a note', async () => {
      mockTagRepo.setTagsForNote.mockResolvedValue(undefined);

      await tagService.setTagsForNote('note-1', ['Tag A', 'Tag B']);

      expect(mockTagRepo.setTagsForNote).toHaveBeenCalledWith('note-1', ['Tag A', 'Tag B']);
    });
  });

  describe('getTagService', () => {
    it('should return singleton instance', () => {
      const instance1 = getTagService();
      const instance2 = getTagService();

      expect(instance1).toBe(instance2);
    });
  });
});
