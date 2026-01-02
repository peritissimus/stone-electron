/**
 * TopicService Tests
 *
 * Covers initialization, semantic flows, keyword fallback, centroid recompute,
 * and similar note lookups with mocked dependencies.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { vi } from 'vitest';

const loggerSpies = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('../../src/main/utils/logger', () => ({
  logger: loggerSpies,
}));

const mockTopicRepo = vi.hoisted(() => ({
  getAll: vi.fn(),
  findById: vi.fn(),
  findByName: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteWithAssociations: vi.fn(),
  getAllWithCounts: vi.fn(),
  getTopicsForNote: vi.fn(),
  setTopicsForNote: vi.fn(),
  getNotesForTopic: vi.fn(),
  updateCentroid: vi.fn(),
}));

const mockNoteRepo = vi.hoisted(() => ({
  findById: vi.fn(),
  getContentById: vi.fn(),
  updateEmbedding: vi.fn(),
  findBySimilarity: vi.fn(),
  getEmbedding: vi.fn(),
}));

vi.mock('../../src/main/repositories', () => ({
  getRepositories: vi.fn(() => ({
    topic: mockTopicRepo,
    note: mockNoteRepo,
  })),
}));

const mockEmbeddingService = vi.hoisted(() => ({
  initialize: vi.fn(),
  isReady: vi.fn(() => true),
  getEmbedding: vi.fn(),
}));

vi.mock('../../src/main/services/EmbeddingService', () => ({
  getEmbeddingService: vi.fn(() => mockEmbeddingService),
  EmbeddingService: class {},
}));

const mockMarkdownService = vi.hoisted(() => ({
  htmlToPlainText: vi.fn((html: string) => html),
}));

vi.mock('../../src/main/services/MarkdownService', () => ({
  getMarkdownService: vi.fn(() => mockMarkdownService),
}));

import { getTopicService } from '../../src/main/services/TopicService';

describe('TopicService', () => {
  const topicService = getTopicService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('seeds predefined topics and initializes embedding service', async () => {
    mockTopicRepo.getAll.mockResolvedValueOnce([]);
    mockTopicRepo.create.mockResolvedValue({ id: 'topic_work' });

    await topicService.initialize();

    expect(mockTopicRepo.create).toHaveBeenCalled();
    expect(mockEmbeddingService.initialize).toHaveBeenCalled();
  });

  it('returns empty semantic results for blank query', async () => {
    const results = await topicService.semanticSearch('   ');
    expect(results).toEqual([]);
  });

  it('performs semantic search when query provided', async () => {
    mockEmbeddingService.getEmbedding.mockResolvedValue([0.1, 0.2]);
    mockNoteRepo.findBySimilarity.mockResolvedValue([{ noteId: 'n1', title: 't', distance: 0.1 }]);

    const results = await topicService.semanticSearch('hello', 2);

    expect(mockEmbeddingService.getEmbedding).toHaveBeenCalled();
    expect(results[0].noteId).toBe('n1');
  });

  it('findSimilarNotes throws when note missing', async () => {
    mockNoteRepo.findById.mockResolvedValue(null);
    await expect(topicService.findSimilarNotes('missing')).rejects.toThrow('Note not found');
  });

  it('findSimilarNotes skips when embedding missing', async () => {
    mockNoteRepo.findById.mockResolvedValue({ id: 'n1' });
    mockNoteRepo.getEmbedding.mockResolvedValue(null);

    const results = await topicService.findSimilarNotes('n1');
    expect(results).toEqual([]);
  });

  it('classifies by keywords when embeddings fail', async () => {
    mockNoteRepo.findById.mockResolvedValue({ id: 'n1', title: 'Work note' });
    mockNoteRepo.getContentById.mockResolvedValue('<p>Project work</p>');
    mockTopicRepo.getAll.mockResolvedValue([
      { id: 'topic_work', name: 'Work' },
    ]);
    mockEmbeddingService.getEmbedding.mockRejectedValue(new Error('no embed'));
    mockTopicRepo.setTopicsForNote.mockResolvedValue(undefined);

    const results = await topicService.classifyNote('n1');

    expect(results.length).toBeGreaterThan(0);
    expect(mockTopicRepo.setTopicsForNote).toHaveBeenCalledWith(
      'n1',
      expect.arrayContaining([
        expect.objectContaining({ topicId: 'topic_work' }),
      ]),
    );
  });

  it('recomputes centroids from embeddings', async () => {
    mockTopicRepo.getNotesForTopic.mockResolvedValue([
      { noteId: 'n1' },
      { noteId: 'n2' },
    ]);
    mockNoteRepo.getEmbedding.mockImplementation(async (id: string) =>
      id === 'n1' ? [1, 0] : [0, 1],
    );

    await topicService.recomputeTopicCentroid('topic_work');

    expect(mockTopicRepo.updateCentroid).toHaveBeenCalled();
  });

  it('merges assignment details when fetching notes for topic', async () => {
    mockTopicRepo.getNotesForTopic.mockResolvedValue([
      { noteId: 'n1', confidence: 0.5, isManual: true },
      { noteId: 'missing', confidence: 0.5, isManual: false },
    ]);
    mockNoteRepo.findById.mockImplementation(async (id: string) =>
      id === 'n1' ? { id: 'n1', title: 't' } : null,
    );

    const notes = await topicService.getNotesForTopic('topic_work');

    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ id: 'n1', confidence: 0.5, isManual: true });
  });
});
