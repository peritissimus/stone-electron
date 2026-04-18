/**
 * TopicUseCases Application Layer Tests
 *
 * Tests use case orchestration with mocked OUT ports.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTopicUseCases } from '../../../../src/main/application/usecases/TopicUseCases';
import type { INoteRepository } from '../../../../src/main/domain/ports/out/INoteRepository';
import type { ITopicRepository } from '../../../../src/main/domain/ports/out/ITopicRepository';
import type { IWorkspaceRepository } from '../../../../src/main/domain/ports/out/IWorkspaceRepository';
import type { IFileStorage } from '../../../../src/main/domain/ports/out/IFileStorage';
import type { IEmbedder } from '../../../../src/main/domain/ports/out/IEmbedder';
import type { IMarkdownProcessor } from '../../../../src/main/domain/ports/out/IMarkdownProcessor';
import type { IEventPublisher } from '../../../../src/main/domain/ports/out/IEventPublisher';
import type { ITopicUseCases } from '../../../../src/main/domain/ports/in/ITopicUseCases';
import type { NoteProps } from '../../../../src/main/domain/entities/Note';
import type { WorkspaceProps } from '../../../../src/main/domain/entities/Workspace';
import type { TopicProps } from '../../../../src/main/domain/entities/Topic';

// Mock factories
function createMockNoteRepository(): INoteRepository {
  return {
    findById: vi.fn(),
    findAll: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    getEmbedding: vi.fn(),
    updateEmbedding: vi.fn(),
    findBySimilarity: vi.fn(),
  } as unknown as INoteRepository;
}

function createMockTopicRepository(): ITopicRepository {
  return {
    findById: vi.fn(),
    findAll: vi.fn(),
    findAllWithCounts: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    getNotesForTopic: vi.fn(),
    getTopicsForNote: vi.fn(),
    assignToNote: vi.fn(),
    removeFromNote: vi.fn(),
    updateCentroid: vi.fn(),
  } as unknown as ITopicRepository;
}

function createMockWorkspaceRepository(): IWorkspaceRepository {
  return {
    findById: vi.fn(),
    findAll: vi.fn(),
    findActive: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  } as unknown as IWorkspaceRepository;
}

function createMockFileStorage(): IFileStorage {
  return {
    read: vi.fn(),
    write: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
  } as unknown as IFileStorage;
}

function createMockEmbedder(): IEmbedder {
  return {
    initialize: vi.fn(),
    isReady: vi.fn(),
    generateEmbedding: vi.fn(),
    generateEmbeddings: vi.fn(),
  } as unknown as IEmbedder;
}

function createMockMarkdownProcessor(): IMarkdownProcessor {
  return {
    htmlToMarkdown: vi.fn(),
    markdownToHtml: vi.fn(),
    extractPlainText: vi.fn(),
  } as unknown as IMarkdownProcessor;
}

function createMockEventPublisher(): IEventPublisher {
  return {
    emit: vi.fn(),
    publish: vi.fn(),
    subscribe: vi.fn(),
  } as unknown as IEventPublisher;
}

function createNoteProps(overrides: Partial<NoteProps> = {}): NoteProps {
  return {
    id: 'note-1',
    title: 'Test Note',
    filePath: 'test.md',
    notebookId: null,
    workspaceId: 'ws-1',
    isFavorite: false,
    isPinned: false,
    isArchived: false,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
    ...overrides,
  };
}

function createWorkspaceProps(overrides: Partial<WorkspaceProps> = {}): WorkspaceProps {
  return {
    id: 'ws-1',
    name: 'Test Workspace',
    folderPath: '/test/workspace',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    lastAccessedAt: new Date('2024-01-02'),
    ...overrides,
  };
}

function createTopicProps(overrides: Partial<TopicProps> = {}): TopicProps {
  return {
    id: 'topic-1',
    name: 'Test Topic',
    description: 'Test description',
    color: '#6366f1',
    isPredefined: false,
    centroid: null,
    noteCount: 0,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
    ...overrides,
  };
}

import { EVENTS } from '@shared/constants/ipcChannels';

describe('TopicUseCases', () => {
  let noteRepo: INoteRepository;
  let topicRepo: ITopicRepository;
  let workspaceRepo: IWorkspaceRepository;
  let fileStorage: IFileStorage;
  let embeddingService: IEmbedder;
  let markdownProcessor: IMarkdownProcessor;
  let eventPublisher: IEventPublisher;
  let useCases: ITopicUseCases;

  beforeEach(() => {
    noteRepo = createMockNoteRepository();
    topicRepo = createMockTopicRepository();
    workspaceRepo = createMockWorkspaceRepository();
    fileStorage = createMockFileStorage();
    embeddingService = createMockEmbedder();
    markdownProcessor = createMockMarkdownProcessor();
    eventPublisher = createMockEventPublisher();
    useCases = createTopicUseCases({
      noteRepository: noteRepo,
      topicRepository: topicRepo,
      workspaceRepository: workspaceRepo,
      fileStorage,
      embeddingService,
      markdownProcessor,
      eventPublisher,
    });
  });

  describe('initialize', () => {
    it('initializes embedding service', async () => {
      vi.mocked(embeddingService.initialize).mockResolvedValue(undefined);

      await useCases.initialize();

      expect(embeddingService.initialize).toHaveBeenCalled();
    });
  });

  describe('getAllTopics', () => {
    it('returns all topics with counts', async () => {
      const topics = [
        { ...createTopicProps({ id: 'topic-1', name: 'Topic 1' }), noteCount: 5 },
        { ...createTopicProps({ id: 'topic-2', name: 'Topic 2' }), noteCount: 3 },
      ];
      vi.mocked(topicRepo.findAllWithCounts).mockResolvedValue(topics);

      const result = await useCases.getAllTopics();

      expect(result).toHaveLength(2);
      expect(result[0].noteCount).toBe(5);
    });
  });

  describe('getTopicById', () => {
    it('returns topic when found', async () => {
      const topic = createTopicProps();
      vi.mocked(topicRepo.findById).mockResolvedValue(topic);
      vi.mocked(topicRepo.getNotesForTopic).mockResolvedValue([]);

      const result = await useCases.getTopicById('topic-1');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Test Topic');
    });

    it('returns null when topic not found', async () => {
      vi.mocked(topicRepo.findById).mockResolvedValue(null);

      const result = await useCases.getTopicById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createTopic', () => {
    it('creates new topic', async () => {
      vi.mocked(topicRepo.save).mockResolvedValue(undefined);

      const result = await useCases.createTopic({ name: 'New Topic' });

      expect(result.name).toBe('New Topic');
      expect(topicRepo.save).toHaveBeenCalled();
      expect(eventPublisher.emit).toHaveBeenCalled();
    });

    it('uses custom color when provided', async () => {
      vi.mocked(topicRepo.save).mockResolvedValue(undefined);

      const result = await useCases.createTopic({ name: 'Topic', color: '#ff0000' });

      expect(result.color).toBe('#ff0000');
    });
  });

  describe('updateTopic', () => {
    it('updates topic properties', async () => {
      const topic = createTopicProps();
      vi.mocked(topicRepo.findById).mockResolvedValue(topic);
      vi.mocked(topicRepo.save).mockResolvedValue(undefined);
      vi.mocked(topicRepo.getNotesForTopic).mockResolvedValue([]);

      const result = await useCases.updateTopic('topic-1', { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
      expect(eventPublisher.emit).toHaveBeenCalled();
    });

    it('throws error when topic not found', async () => {
      vi.mocked(topicRepo.findById).mockResolvedValue(null);

      await expect(useCases.updateTopic('nonexistent', { name: 'New' })).rejects.toThrow(
        'Topic not found: nonexistent',
      );
    });
  });

  describe('deleteTopic', () => {
    it('deletes topic', async () => {
      const topic = createTopicProps();
      vi.mocked(topicRepo.findById).mockResolvedValue(topic);
      vi.mocked(topicRepo.delete).mockResolvedValue(undefined);

      await useCases.deleteTopic('topic-1');

      expect(topicRepo.delete).toHaveBeenCalledWith('topic-1');
      expect(eventPublisher.emit).toHaveBeenCalled();
    });

    it('throws error when topic not found', async () => {
      vi.mocked(topicRepo.findById).mockResolvedValue(null);

      await expect(useCases.deleteTopic('nonexistent')).rejects.toThrow(
        'Topic not found: nonexistent',
      );
    });

    it('throws error when trying to delete predefined topic', async () => {
      const topic = createTopicProps({ isPredefined: true });
      vi.mocked(topicRepo.findById).mockResolvedValue(topic);

      await expect(useCases.deleteTopic('topic-1')).rejects.toThrow(
        'Cannot delete predefined topics',
      );
    });
  });

  describe('classifyNote', () => {
    it('classifies note and assigns topic', async () => {
      const note = createNoteProps();
      const workspace = createWorkspaceProps();
      const topic = createTopicProps({
        centroid: new Uint8Array(new Float32Array([0.1, 0.2, 0.3]).buffer),
      });
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(noteRepo.getEmbedding).mockResolvedValue(null);
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(fileStorage.read).mockResolvedValue('# Test Content');
      vi.mocked(markdownProcessor.extractPlainText).mockResolvedValue('Test Content');
      vi.mocked(embeddingService.generateEmbedding).mockResolvedValue(
        new Float32Array([0.1, 0.2, 0.3]),
      );
      vi.mocked(noteRepo.updateEmbedding).mockResolvedValue(undefined);
      vi.mocked(topicRepo.findAll).mockResolvedValue([topic]);
      vi.mocked(topicRepo.assignToNote).mockResolvedValue(undefined);

      const result = await useCases.classifyNote('note-1');

      expect(result.noteId).toBe('note-1');
      expect(noteRepo.updateEmbedding).toHaveBeenCalled();
    });

    it('skips classification when embedding exists and force is false', async () => {
      const note = createNoteProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(noteRepo.getEmbedding).mockResolvedValue([0.1, 0.2, 0.3]);

      const result = await useCases.classifyNote('note-1', false);

      expect(result.topics).toHaveLength(0);
      expect(noteRepo.updateEmbedding).not.toHaveBeenCalled();
    });

    it('throws error when note not found', async () => {
      vi.mocked(noteRepo.findById).mockResolvedValue(null);

      await expect(useCases.classifyNote('nonexistent')).rejects.toThrow(
        'Note not found: nonexistent',
      );
    });
  });

  describe('assignTopicToNote', () => {
    it('manually assigns topic to note', async () => {
      vi.mocked(topicRepo.assignToNote).mockResolvedValue(undefined);

      await useCases.assignTopicToNote('note-1', 'topic-1');

      expect(topicRepo.assignToNote).toHaveBeenCalledWith('note-1', 'topic-1', {
        confidence: 1.0,
        isManual: true,
      });
      expect(eventPublisher.emit).toHaveBeenCalled();
    });
  });

  describe('removeTopicFromNote', () => {
    it('removes topic from note', async () => {
      vi.mocked(topicRepo.removeFromNote).mockResolvedValue(undefined);

      await useCases.removeTopicFromNote('note-1', 'topic-1');

      expect(topicRepo.removeFromNote).toHaveBeenCalledWith('note-1', 'topic-1');
      expect(eventPublisher.emit).toHaveBeenCalled();
    });
  });

  describe('getSimilarNotes', () => {
    it('returns similar notes', async () => {
      const note = createNoteProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(noteRepo.getEmbedding).mockResolvedValue([0.1, 0.2, 0.3]);
      vi.mocked(noteRepo.findBySimilarity).mockResolvedValue([
        { noteId: 'note-2', title: 'Similar Note', distance: 0.2 },
      ]);

      const result = await useCases.getSimilarNotes('note-1');

      expect(result).toHaveLength(1);
      expect(result[0].noteId).toBe('note-2');
    });

    it('returns empty array when note not found', async () => {
      vi.mocked(noteRepo.findById).mockResolvedValue(null);

      const result = await useCases.getSimilarNotes('nonexistent');

      expect(result).toHaveLength(0);
    });

    it('returns empty array when note has no embedding', async () => {
      const note = createNoteProps();
      vi.mocked(noteRepo.findById).mockResolvedValue(note);
      vi.mocked(noteRepo.getEmbedding).mockResolvedValue(null);

      const result = await useCases.getSimilarNotes('note-1');

      expect(result).toHaveLength(0);
    });
  });

  describe('semanticSearch', () => {
    it('performs semantic search', async () => {
      const workspace = createWorkspaceProps();
      const note = createNoteProps();
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(workspace);
      vi.mocked(embeddingService.generateEmbedding).mockResolvedValue(
        new Float32Array([0.1, 0.2, 0.3]),
      );
      vi.mocked(noteRepo.findBySimilarity).mockResolvedValue([
        { noteId: 'note-1', title: 'Match', distance: 0.1 },
      ]);
      vi.mocked(noteRepo.findById).mockResolvedValue(note);

      const result = await useCases.semanticSearch('search query');

      expect(result).toHaveLength(1);
      expect(embeddingService.generateEmbedding).toHaveBeenCalledWith('search query');
    });

    it('returns empty array when no active workspace', async () => {
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(null);

      const result = await useCases.semanticSearch('query');

      expect(result).toHaveLength(0);
    });
  });

  describe('recomputeCentroids', () => {
    it('recomputes centroids for all topics', async () => {
      const topic = createTopicProps();
      const notesForTopic = [
        { noteId: 'note-1', confidence: 1.0, isManual: false },
        { noteId: 'note-2', confidence: 1.0, isManual: false },
      ];

      vi.mocked(topicRepo.findAll).mockResolvedValue([topic]);
      vi.mocked(topicRepo.getNotesForTopic).mockResolvedValue(notesForTopic as any);
      vi.mocked(noteRepo.getEmbedding)
        .mockResolvedValueOnce([0.1, 0.2, 0.3])
        .mockResolvedValueOnce([0.4, 0.5, 0.6]);
      vi.mocked(topicRepo.updateCentroid).mockResolvedValue(undefined);

      await useCases.recomputeCentroids();

      expect(topicRepo.findAll).toHaveBeenCalled();
      expect(topicRepo.getNotesForTopic).toHaveBeenCalledWith('topic-1');
      expect(noteRepo.getEmbedding).toHaveBeenCalledTimes(2);
      expect(topicRepo.updateCentroid).toHaveBeenCalled();
    });
  });

  describe('classifyAllNotes', () => {
    it('classifies all notes in workspace', async () => {
      const workspace = createWorkspaceProps();
      const notes = [createNoteProps({ id: 'note-1' }), createNoteProps({ id: 'note-2' })];

      vi.mocked(workspaceRepo.findActive).mockResolvedValue(workspace);
      vi.mocked(noteRepo.findAll).mockResolvedValue(notes);

      // Mock classifyNote internal call implicitly by mocking dependencies
      vi.mocked(noteRepo.findById).mockResolvedValue(notes[0]);
      vi.mocked(noteRepo.getEmbedding).mockResolvedValue(null);
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(fileStorage.read).mockResolvedValue('content');
      vi.mocked(markdownProcessor.extractPlainText).mockResolvedValue('content');
      vi.mocked(embeddingService.generateEmbedding).mockResolvedValue(
        new Float32Array([0.1, 0.2, 0.3]),
      );
      vi.mocked(topicRepo.findAll).mockResolvedValue([]);

      const result = await useCases.classifyAllNotes();

      expect(result.processed).toBe(2);
      expect(eventPublisher.emit).toHaveBeenCalledWith(
        EVENTS.EMBEDDING_PROGRESS,
        expect.objectContaining({
          current: expect.any(Number),
          total: 2,
          failed: expect.any(Number),
        }),
      );
    });

    it('returns zeros when no active workspace', async () => {
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(null);

      const result = await useCases.classifyAllNotes();

      expect(result.processed).toBe(0);
      expect(result.total).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  describe('getEmbeddingStatus', () => {
    it('returns embedding status', async () => {
      const workspace = createWorkspaceProps();
      const notes = [createNoteProps({ id: 'note-1' }), createNoteProps({ id: 'note-2' })];
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(workspace);
      vi.mocked(noteRepo.findAll).mockResolvedValue(notes);
      vi.mocked(noteRepo.getEmbedding)
        .mockResolvedValueOnce([0.1, 0.2])
        .mockResolvedValueOnce(null);
      vi.mocked(embeddingService.isReady).mockResolvedValue(true);

      const result = await useCases.getEmbeddingStatus();

      expect(result.totalNotes).toBe(2);
      expect(result.embeddedNotes).toBe(1);
      expect(result.pendingNotes).toBe(1);
      expect(result.ready).toBe(true);
    });

    it('returns empty status when no active workspace', async () => {
      vi.mocked(workspaceRepo.findActive).mockResolvedValue(null);
      vi.mocked(embeddingService.isReady).mockResolvedValue(false);

      const result = await useCases.getEmbeddingStatus();

      expect(result.totalNotes).toBe(0);
      expect(result.embeddedNotes).toBe(0);
      expect(result.pendingNotes).toBe(0);
      expect(result.ready).toBe(false);
    });
  });

  describe('getNotesForTopic', () => {
    it('returns notes for topic with titles', async () => {
      const notesForTopic = [{ noteId: 'note-1', confidence: 0.9, isManual: false }];
      const note = createNoteProps({ id: 'note-1', title: 'Test Note' });
      vi.mocked(topicRepo.getNotesForTopic).mockResolvedValue(notesForTopic);
      vi.mocked(noteRepo.findById).mockResolvedValue(note);

      const result = await useCases.getNotesForTopic('topic-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('note-1');
      expect(result[0].title).toBe('Test Note');
      expect(result[0].confidence).toBe(0.9);
    });
  });

  describe('getTopicsForNote', () => {
    it('returns topics for note', async () => {
      const topics = [
        {
          noteId: 'note-1',
          topicId: 'topic-1',
          confidence: 0.9,
          isManual: false,
          createdAt: new Date(),
          topicName: 'Topic',
          topicColor: '#6366f1',
        },
      ];
      vi.mocked(topicRepo.getTopicsForNote).mockResolvedValue(topics);

      const result = await useCases.getTopicsForNote('note-1');

      expect(result).toHaveLength(1);
      expect(result[0].topicId).toBe('topic-1');
    });
  });
});
