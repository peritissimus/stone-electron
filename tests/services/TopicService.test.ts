/**
 * TopicService Tests
 *
 * Covers initialization, semantic flows, keyword fallback, centroid recompute,
 * classification, and similar note lookups with mocked dependencies.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock logger
vi.mock('../../src/main/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Create mock dependencies
const mockTopicRepo = {
  getAll: vi.fn(),
  findById: vi.fn(),
  findByName: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteWithAssociations: vi.fn(),
  getAllWithCounts: vi.fn(),
  getTopicsForNote: vi.fn(),
  setTopicsForNote: vi.fn(),
  assignToNote: vi.fn(),
  removeFromNote: vi.fn(),
  getNotesForTopic: vi.fn(),
  updateCentroid: vi.fn(),
};

const mockNoteRepo = {
  findById: vi.fn(),
  getContentById: vi.fn(),
  updateEmbedding: vi.fn(),
  findBySimilarity: vi.fn(),
  getEmbedding: vi.fn(),
};

const mockEmbeddingService = {
  initialize: vi.fn(),
  isReady: vi.fn(() => true),
  getEmbedding: vi.fn(),
  getDimensions: vi.fn(() => 384),
  shutdown: vi.fn(),
};

const mockMarkdownService = {
  htmlToPlainText: vi.fn((html: string) => html.replace(/<[^>]*>/g, '')),
};

import { createTopicService } from '../../src/main/services/TopicService';

describe('TopicService', () => {
  // Create service with mocked dependencies
  const createService = () =>
    createTopicService({
      topicRepository: mockTopicRepo as any,
      noteRepository: mockNoteRepo as any,
      embeddingService: mockEmbeddingService as any,
      markdownService: mockMarkdownService as any,
    });

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock returns
    mockTopicRepo.getAll.mockResolvedValue([]);
    mockTopicRepo.findById.mockResolvedValue(null);
    mockEmbeddingService.isReady.mockReturnValue(true);
  });

  describe('initialization', () => {
    it('seeds predefined topics when none exist', async () => {
      mockTopicRepo.getAll.mockResolvedValueOnce([]);
      mockTopicRepo.create.mockResolvedValue({ id: 'topic_work' });

      const service = createService();
      await service.initialize();

      // Should create 5 predefined topics
      expect(mockTopicRepo.create).toHaveBeenCalledTimes(5);
      expect(mockEmbeddingService.initialize).toHaveBeenCalled();
    });

    it('does not duplicate predefined topics if they exist', async () => {
      mockTopicRepo.getAll.mockResolvedValueOnce([
        { id: 'topic_work', name: 'Work' },
        { id: 'topic_personal', name: 'Personal' },
        { id: 'topic_learning', name: 'Learning' },
        { id: 'topic_projects', name: 'Projects' },
        { id: 'topic_ideas', name: 'Ideas' },
      ]);
      mockTopicRepo.findById.mockResolvedValue({ id: 'exists' });

      const service = createService();
      await service.initialize();

      // Should not create any topics
      expect(mockTopicRepo.create).not.toHaveBeenCalled();
    });

    it('creates missing predefined topics', async () => {
      mockTopicRepo.getAll.mockResolvedValueOnce([
        { id: 'topic_work', name: 'Work' },
      ]);
      // First findById returns existing, rest return null
      mockTopicRepo.findById
        .mockResolvedValueOnce({ id: 'topic_work' })
        .mockResolvedValue(null);
      mockTopicRepo.create.mockResolvedValue({ id: 'new' });

      const service = createService();
      await service.initialize();

      // Should create 4 missing topics
      expect(mockTopicRepo.create).toHaveBeenCalledTimes(4);
    });

    it('reports readiness based on embedding service', () => {
      const service = createService();

      mockEmbeddingService.isReady.mockReturnValue(true);
      expect(service.isReady()).toBe(true);

      mockEmbeddingService.isReady.mockReturnValue(false);
      expect(service.isReady()).toBe(false);
    });
  });

  describe('topic CRUD operations', () => {
    it('gets all topics with counts', async () => {
      const topics = [
        { id: 'topic_work', name: 'Work', noteCount: 5 },
        { id: 'topic_personal', name: 'Personal', noteCount: 3 },
      ];
      mockTopicRepo.getAllWithCounts.mockResolvedValue(topics);

      const service = createService();
      const result = await service.getAllTopics();

      expect(result).toEqual(topics);
      expect(mockTopicRepo.getAllWithCounts).toHaveBeenCalled();
    });

    it('gets topic by ID', async () => {
      const topic = { id: 'topic_work', name: 'Work' };
      mockTopicRepo.findById.mockResolvedValue(topic);

      const service = createService();
      const result = await service.getTopicById('topic_work');

      expect(result).toEqual(topic);
    });

    it('creates a new topic', async () => {
      const newTopic = { name: 'Custom', description: 'My topic', color: '#ff0000' };
      mockTopicRepo.create.mockResolvedValue({ id: 'custom_1', ...newTopic });

      const service = createService();
      const result = await service.createTopic(newTopic);

      expect(mockTopicRepo.create).toHaveBeenCalledWith(newTopic);
      expect(result.name).toBe('Custom');
    });

    it('updates a topic', async () => {
      mockTopicRepo.update.mockResolvedValue({ id: 'topic_work', name: 'Updated' });

      const service = createService();
      const result = await service.updateTopic('topic_work', { name: 'Updated' });

      expect(mockTopicRepo.update).toHaveBeenCalledWith('topic_work', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('deletes a topic', async () => {
      mockTopicRepo.deleteWithAssociations.mockResolvedValue(true);

      const service = createService();
      const result = await service.deleteTopic('topic_work');

      expect(result).toBe(true);
      expect(mockTopicRepo.deleteWithAssociations).toHaveBeenCalledWith('topic_work');
    });
  });

  describe('note-topic associations', () => {
    it('gets topics for a note', async () => {
      const noteTopics = [
        { topicId: 'topic_work', topicName: 'Work', confidence: 0.8 },
      ];
      mockTopicRepo.getTopicsForNote.mockResolvedValue(noteTopics);

      const service = createService();
      const result = await service.getTopicsForNote('note1');

      expect(result).toEqual(noteTopics);
    });

    it('manually assigns topic to note', async () => {
      mockTopicRepo.assignToNote.mockResolvedValue(undefined);

      const service = createService();
      await service.assignTopicToNote('note1', 'topic_work');

      expect(mockTopicRepo.assignToNote).toHaveBeenCalledWith('note1', 'topic_work', {
        confidence: 1,
        isManual: true,
      });
    });

    it('removes topic from note', async () => {
      mockTopicRepo.removeFromNote.mockResolvedValue(undefined);

      const service = createService();
      await service.removeTopicFromNote('note1', 'topic_work');

      expect(mockTopicRepo.removeFromNote).toHaveBeenCalledWith('note1', 'topic_work');
    });
  });

  describe('classification', () => {
    it('returns empty array for note without content', async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: 'n1', title: 'Empty' });
      mockNoteRepo.getContentById.mockResolvedValue('');

      const service = createService();
      const result = await service.classifyNote('n1');

      expect(result).toEqual([]);
    });

    it('throws error for missing note', async () => {
      mockNoteRepo.findById.mockResolvedValue(null);

      const service = createService();
      await expect(service.classifyNote('missing')).rejects.toThrow('Note not found');
    });

    it('classifies using embeddings when centroids exist', async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: 'n1', title: 'Work note' });
      mockNoteRepo.getContentById.mockResolvedValue('<p>Project meeting</p>');
      mockMarkdownService.htmlToPlainText.mockReturnValue('Project meeting');
      mockEmbeddingService.getEmbedding.mockResolvedValue(new Array(384).fill(0.5));
      mockNoteRepo.updateEmbedding.mockResolvedValue(undefined);

      // Topic with centroid (high similarity)
      const centroidBuffer = new Uint8Array(new Float32Array(384).fill(0.5).buffer);
      mockTopicRepo.getAll.mockResolvedValue([
        { id: 'topic_work', name: 'Work', centroid: centroidBuffer },
      ]);
      mockTopicRepo.setTopicsForNote.mockResolvedValue(undefined);

      const service = createService();
      const result = await service.classifyNote('n1');

      expect(mockEmbeddingService.getEmbedding).toHaveBeenCalledWith('Project meeting');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].topicId).toBe('topic_work');
    });

    it('falls back to keyword classification when no centroids', async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: 'n1', title: 'Work note' });
      mockNoteRepo.getContentById.mockResolvedValue('<p>Project meeting deadline</p>');
      mockMarkdownService.htmlToPlainText.mockReturnValue('Project meeting deadline');
      mockEmbeddingService.getEmbedding.mockResolvedValue(new Array(384).fill(0.1));
      mockNoteRepo.updateEmbedding.mockResolvedValue(undefined);

      // Topics without centroids
      mockTopicRepo.getAll.mockResolvedValue([
        { id: 'topic_work', name: 'Work', centroid: null },
        { id: 'topic_personal', name: 'Personal', centroid: null },
      ]);
      mockTopicRepo.setTopicsForNote.mockResolvedValue(undefined);

      const service = createService();
      const result = await service.classifyNote('n1');

      // Should match 'topic_work' based on keywords 'project', 'meeting', 'deadline'
      expect(result.some((r) => r.topicId === 'topic_work')).toBe(true);
    });

    it('falls back to keywords when embedding fails', async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: 'n1', title: 'Work note' });
      mockNoteRepo.getContentById.mockResolvedValue('<p>Work project</p>');
      mockMarkdownService.htmlToPlainText.mockReturnValue('Work project');
      mockEmbeddingService.getEmbedding.mockRejectedValue(new Error('Model not loaded'));
      mockTopicRepo.getAll.mockResolvedValue([
        { id: 'topic_work', name: 'Work' },
      ]);
      mockTopicRepo.setTopicsForNote.mockResolvedValue(undefined);

      const service = createService();
      const result = await service.classifyNote('n1');

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].topicId).toBe('topic_work');
    });

    it('limits topics per note to MAX_TOPICS_PER_NOTE', async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: 'n1', title: 'Multi-topic' });
      mockNoteRepo.getContentById.mockResolvedValue(
        'Project work meeting deadline study learn course tutorial idea brainstorm'
      );
      mockMarkdownService.htmlToPlainText.mockReturnValue(
        'Project work meeting deadline study learn course tutorial idea brainstorm'
      );
      mockEmbeddingService.getEmbedding.mockResolvedValue(new Array(384).fill(0.1));

      // Topics without centroids - will use keyword fallback
      mockTopicRepo.getAll.mockResolvedValue([
        { id: 'topic_work', name: 'Work', centroid: null },
        { id: 'topic_learning', name: 'Learning', centroid: null },
        { id: 'topic_ideas', name: 'Ideas', centroid: null },
        { id: 'topic_projects', name: 'Projects', centroid: null },
      ]);
      mockTopicRepo.setTopicsForNote.mockResolvedValue(undefined);

      const service = createService();
      const result = await service.classifyNote('n1');

      // Should be limited to 3 topics max
      expect(result.length).toBeLessThanOrEqual(3);
    });
  });

  describe('semantic search', () => {
    it('returns empty results for blank query', async () => {
      const service = createService();
      const results = await service.semanticSearch('   ');
      expect(results).toEqual([]);
    });

    it('returns empty results for empty query', async () => {
      const service = createService();
      const results = await service.semanticSearch('');
      expect(results).toEqual([]);
    });

    it('performs semantic search with valid query', async () => {
      mockEmbeddingService.getEmbedding.mockResolvedValue(new Array(384).fill(0.2));
      mockNoteRepo.findBySimilarity.mockResolvedValue([
        { noteId: 'n1', title: 'Match 1', distance: 0.1 },
        { noteId: 'n2', title: 'Match 2', distance: 0.2 },
      ]);

      const service = createService();
      const results = await service.semanticSearch('hello world', 5);

      expect(mockEmbeddingService.getEmbedding).toHaveBeenCalledWith('hello world');
      expect(mockNoteRepo.findBySimilarity).toHaveBeenCalledWith(expect.any(Array), 5);
      expect(results).toHaveLength(2);
      expect(results[0].noteId).toBe('n1');
    });
  });

  describe('findSimilarNotes', () => {
    it('throws error for missing note', async () => {
      mockNoteRepo.findById.mockResolvedValue(null);

      const service = createService();
      await expect(service.findSimilarNotes('missing')).rejects.toThrow('Note not found');
    });

    it('returns empty array when note has no embedding', async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: 'n1', title: 'Test' });
      mockNoteRepo.getEmbedding.mockResolvedValue(null);

      const service = createService();
      const results = await service.findSimilarNotes('n1');

      expect(results).toEqual([]);
    });

    it('finds similar notes excluding self', async () => {
      mockNoteRepo.findById.mockResolvedValue({ id: 'n1', title: 'Test' });
      mockNoteRepo.getEmbedding.mockResolvedValue(new Array(384).fill(0.3));
      mockNoteRepo.findBySimilarity.mockResolvedValue([
        { noteId: 'n1', title: 'Self', distance: 0 },
        { noteId: 'n2', title: 'Similar 1', distance: 0.1 },
        { noteId: 'n3', title: 'Similar 2', distance: 0.2 },
      ]);

      const service = createService();
      const results = await service.findSimilarNotes('n1', 2);

      // Should exclude self and return limit
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.noteId !== 'n1')).toBe(true);
    });
  });

  describe('centroid computation', () => {
    it('recomputes centroid from note embeddings', async () => {
      mockTopicRepo.getNotesForTopic.mockResolvedValue([
        { noteId: 'n1' },
        { noteId: 'n2' },
      ]);
      mockNoteRepo.getEmbedding
        .mockResolvedValueOnce(new Array(384).fill(1))
        .mockResolvedValueOnce(new Array(384).fill(0));

      const service = createService();
      await service.recomputeTopicCentroid('topic_work');

      expect(mockTopicRepo.updateCentroid).toHaveBeenCalledWith(
        'topic_work',
        expect.any(Uint8Array)
      );
    });

    it('skips centroid computation when topic has no notes', async () => {
      mockTopicRepo.getNotesForTopic.mockResolvedValue([]);

      const service = createService();
      await service.recomputeTopicCentroid('topic_work');

      expect(mockTopicRepo.updateCentroid).not.toHaveBeenCalled();
    });

    it('skips centroid computation when no embeddings found', async () => {
      mockTopicRepo.getNotesForTopic.mockResolvedValue([
        { noteId: 'n1' },
        { noteId: 'n2' },
      ]);
      mockNoteRepo.getEmbedding.mockResolvedValue(null);

      const service = createService();
      await service.recomputeTopicCentroid('topic_work');

      expect(mockTopicRepo.updateCentroid).not.toHaveBeenCalled();
    });

    it('recomputes all centroids', async () => {
      mockTopicRepo.getAll.mockResolvedValue([
        { id: 'topic_work', name: 'Work' },
        { id: 'topic_personal', name: 'Personal' },
      ]);
      mockTopicRepo.getNotesForTopic.mockResolvedValue([{ noteId: 'n1' }]);
      mockNoteRepo.getEmbedding.mockResolvedValue(new Array(384).fill(0.5));

      const service = createService();
      await service.recomputeAllCentroids();

      // Should update centroid for each topic
      expect(mockTopicRepo.updateCentroid).toHaveBeenCalledTimes(2);
    });
  });

  describe('getNotesForTopic', () => {
    it('returns notes with assignment details', async () => {
      mockTopicRepo.getNotesForTopic.mockResolvedValue([
        { noteId: 'n1', confidence: 0.8, isManual: false },
        { noteId: 'n2', confidence: 1, isManual: true },
      ]);
      mockNoteRepo.findById
        .mockResolvedValueOnce({ id: 'n1', title: 'Note 1' })
        .mockResolvedValueOnce({ id: 'n2', title: 'Note 2' });

      const service = createService();
      const notes = await service.getNotesForTopic('topic_work');

      expect(notes).toHaveLength(2);
      expect(notes[0]).toMatchObject({ id: 'n1', confidence: 0.8, isManual: false });
      expect(notes[1]).toMatchObject({ id: 'n2', confidence: 1, isManual: true });
    });

    it('filters out missing notes', async () => {
      mockTopicRepo.getNotesForTopic.mockResolvedValue([
        { noteId: 'n1', confidence: 0.5, isManual: false },
        { noteId: 'missing', confidence: 0.5, isManual: false },
      ]);
      mockNoteRepo.findById
        .mockResolvedValueOnce({ id: 'n1', title: 'Note 1' })
        .mockResolvedValueOnce(null);

      const service = createService();
      const notes = await service.getNotesForTopic('topic_work');

      expect(notes).toHaveLength(1);
      expect(notes[0].id).toBe('n1');
    });

    it('supports pagination options', async () => {
      mockTopicRepo.getNotesForTopic.mockResolvedValue([]);

      const service = createService();
      await service.getNotesForTopic('topic_work', { limit: 10, offset: 5 });

      expect(mockTopicRepo.getNotesForTopic).toHaveBeenCalledWith('topic_work', {
        limit: 10,
        offset: 5,
      });
    });
  });
});
