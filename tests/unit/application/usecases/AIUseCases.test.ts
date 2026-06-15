import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AskNotesUseCase } from '../../../../src/main/application/usecases/ai/AskNotesUseCase';
import { SuggestLinksUseCase } from '../../../../src/main/application/usecases/ai/SuggestLinksUseCase';
import { SummarizeNoteUseCase } from '../../../../src/main/application/usecases/ai/SummarizeNoteUseCase';
import { WarmUpTranscriberUseCase } from '../../../../src/main/application/usecases/ai/WarmUpTranscriberUseCase';
import type { NoteProps } from '../../../../src/main/domain/entities/Note';
import type {
  IAppConfigRepository,
  IIndexRepository,
  IJournalReader,
  IMarkdownProcessor,
  INoteRepository,
  ITextGenerator,
  ITranscriber,
} from '../../../../src/main/domain';
import type { IWorkspaceRepository } from '../../../../src/main/domain/ports/out/IWorkspaceRepository';
import type {
  IHybridSearchUseCase,
  HybridSearchResultRow,
} from '../../../../src/main/domain/ports/in/ISearchUseCases';

function createMockNoteRepository(): INoteRepository {
  return {
    findById: vi.fn(),
    findAll: vi.fn(),
    findByNotebookId: vi.fn(),
    findByWorkspaceId: vi.fn(),
    findByFilePath: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    searchByTitle: vi.fn(),
    count: vi.fn(),
    exists: vi.fn(),
    findRecentlyUpdated: vi.fn(),
    findFavorites: vi.fn(),
    findPinned: vi.fn(),
    findArchived: vi.fn(),
    findDeleted: vi.fn(),
    getContentById: vi.fn(),
    getEmbedding: vi.fn(),
    updateEmbedding: vi.fn(),
    findBySimilarity: vi.fn(),
  } as unknown as INoteRepository;
}

function createMockHybridSearch(): IHybridSearchUseCase {
  return { execute: vi.fn() } as unknown as IHybridSearchUseCase;
}

function createMockTextGenerator(): ITextGenerator {
  return {
    generateAnswer: vi.fn(),
    // Echo the query, no date scope — keeps retrieval on the literal query so
    // the existing citation assertions hold; date-scoped behaviour is covered
    // separately.
    planQuery: vi.fn(async ({ query }: { query: string }) => ({
      searchQuery: query,
      dateStart: null,
      dateEnd: null,
    })),
  } as unknown as ITextGenerator;
}

function createMockJournalReader() {
  return { findRecent: vi.fn().mockResolvedValue([]) } as unknown as IJournalReader;
}

function createMockWorkspaceRepository() {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findActive: vi.fn().mockResolvedValue(null),
  } as unknown as IWorkspaceRepository;
}

function createMockAppConfigRepository() {
  return {
    get: vi.fn().mockResolvedValue({
      notes: { locationPolicy: { journalFolder: 'Journal' } },
    }),
  } as unknown as IAppConfigRepository;
}

function createMockIndexRepository(): IIndexRepository {
  return {
    getNoteVector: vi.fn(),
    findSimilarNotesByVector: vi.fn(),
  } as unknown as IIndexRepository;
}

function createMockMarkdownProcessor(): IMarkdownProcessor {
  return {
    extractPlainText: vi.fn((markdown: string) => markdown.replace(/[#*_`]/g, '')),
  } as unknown as IMarkdownProcessor;
}

function createMockTranscriber(): ITranscriber {
  return {
    isReady: vi.fn().mockReturnValue(false),
    initialize: vi.fn(),
    transcribe: vi.fn(),
  };
}

function createNoteProps(overrides: Partial<NoteProps> = {}): NoteProps {
  return {
    id: 'note-1',
    title: 'AI Roadmap',
    filePath: 'ai-roadmap.md',
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

describe('AIUseCases', () => {
  describe('AskNotesUseCase', () => {
    let noteRepository: INoteRepository;
    let hybridSearch: IHybridSearchUseCase;
    let textGenerator: ITextGenerator;
    let useCase: AskNotesUseCase;

    beforeEach(() => {
      noteRepository = createMockNoteRepository();
      hybridSearch = createMockHybridSearch();
      textGenerator = createMockTextGenerator();
      useCase = new AskNotesUseCase(
        hybridSearch,
        noteRepository,
        textGenerator,
        createMockJournalReader(),
        createMockWorkspaceRepository(),
        createMockAppConfigRepository(),
      );
    });

    it('builds chunk-level citations from hybrid search results', async () => {
      const note = createNoteProps({ id: 'note-1', title: 'AI Roadmap' });
      const results: HybridSearchResultRow[] = [
        {
          note,
          score: 0.05,
          searchType: 'hybrid',
          chunks: [
            {
              chunkId: 'note-1:2',
              noteId: 'note-1',
              headingPath: ['AI Roadmap', 'Constraints'],
              excerpt: 'LLM answers must cite notes and avoid unsupported claims.',
              score: 0.05,
              sources: ['fts', 'semantic'],
            },
          ],
        },
      ];
      vi.mocked(hybridSearch.execute).mockResolvedValue({
        results,
        total: 1,
        queryTimeMs: 12,
      });
      vi.mocked(textGenerator.generateAnswer).mockImplementation(async (req) => ({
        text: 'Cite notes and avoid unsupported claims [1].',
        usedSources: req.sources,
      }));

      const result = await useCase.execute({
        query: 'How should the LLM answer questions?',
        workspaceId: 'ws-1',
        limit: 3,
      });

      expect(hybridSearch.execute).toHaveBeenCalledWith({
        query: 'How should the LLM answer questions?',
        workspaceId: 'ws-1',
        limit: 3,
      });
      expect(textGenerator.generateAnswer).toHaveBeenCalledWith({
        query: 'How should the LLM answer questions?',
        today: expect.any(String),
        sources: [
          {
            chunkId: 'note-1:2',
            noteId: 'note-1',
            title: 'AI Roadmap',
            headingPath: ['AI Roadmap', 'Constraints'],
            excerpt: 'LLM answers must cite notes and avoid unsupported claims.',
          },
        ],
      });
      expect(result.answer).toContain('Cite notes');
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].chunkId).toBe('note-1:2');
    });

    it('falls back to whole-note content when a result has no chunks yet', async () => {
      const note = createNoteProps({ id: 'note-1', title: 'Legacy Note' });
      const results: HybridSearchResultRow[] = [
        {
          note,
          score: 0.03,
          searchType: 'fts',
          // no chunks (note hasn't been chunked yet)
        },
      ];
      vi.mocked(hybridSearch.execute).mockResolvedValue({
        results,
        total: 1,
        queryTimeMs: 5,
      });
      vi.mocked(noteRepository.getContentById).mockResolvedValue(
        'Plain markdown body of the legacy note.',
      );
      vi.mocked(textGenerator.generateAnswer).mockImplementation(async (req) => ({
        text: 'ok',
        usedSources: req.sources,
      }));

      const result = await useCase.execute({ query: 'legacy?' });

      expect(noteRepository.getContentById).toHaveBeenCalledWith('note-1');
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].chunkId).toBe('note-1');
      expect(result.sources[0].excerpt).toBe('Plain markdown body of the legacy note.');
    });

    it('returns the canned message when no usable sources exist', async () => {
      vi.mocked(hybridSearch.execute).mockResolvedValue({
        results: [],
        total: 0,
        queryTimeMs: 2,
      });
      vi.mocked(textGenerator.generateAnswer).mockResolvedValue({
        text: 'I could not find relevant notes to answer that.',
        usedSources: [],
      });

      const result = await useCase.execute({ query: 'anything?' });

      expect(textGenerator.generateAnswer).toHaveBeenCalledWith({
        query: 'anything?',
        today: expect.any(String),
        sources: [],
      });
      expect(result).toEqual({
        answer: 'I could not find relevant notes to answer that.',
        sources: [],
      });
    });
  });

  describe('SuggestLinksUseCase', () => {
    let noteRepository: INoteRepository;
    let indexRepository: IIndexRepository;
    let useCase: SuggestLinksUseCase;

    beforeEach(() => {
      noteRepository = createMockNoteRepository();
      indexRepository = createMockIndexRepository();
      useCase = new SuggestLinksUseCase(noteRepository, indexRepository);
    });

    it('suggests semantic links from the indexed note vector', async () => {
      vi.mocked(indexRepository.getNoteVector).mockResolvedValue([0.1, 0.2, 0.3]);
      vi.mocked(noteRepository.findById).mockResolvedValue(
        createNoteProps({ id: 'source', workspaceId: 'ws-1' }),
      );
      vi.mocked(indexRepository.findSimilarNotesByVector).mockResolvedValue([
        { noteId: 'target', title: 'Target', similarity: 0.82, matchedChunks: 2 },
      ]);

      const result = await useCase.execute({ noteId: 'source', limit: 4 });

      expect(indexRepository.findSimilarNotesByVector).toHaveBeenCalledWith([0.1, 0.2, 0.3], {
        limit: 4,
        workspaceId: 'ws-1',
        excludeNoteId: 'source',
      });
      expect(result.links).toEqual([
        {
          noteId: 'target',
          title: 'Target',
          reason: 'Semantically similar note',
          score: 0.82,
        },
      ]);
    });

    it('returns no suggestions when the source note has no vector or metadata', async () => {
      vi.mocked(indexRepository.getNoteVector).mockResolvedValueOnce(null);
      await expect(useCase.execute({ noteId: 'source' })).resolves.toEqual({ links: [] });

      vi.mocked(indexRepository.getNoteVector).mockResolvedValueOnce([1, 2, 3]);
      vi.mocked(noteRepository.findById).mockResolvedValueOnce(null);
      await expect(useCase.execute({ noteId: 'source' })).resolves.toEqual({ links: [] });
    });
  });

  describe('SummarizeNoteUseCase', () => {
    let noteRepository: INoteRepository;
    let markdownProcessor: IMarkdownProcessor;
    let textGenerator: ITextGenerator;
    let useCase: SummarizeNoteUseCase;

    beforeEach(() => {
      noteRepository = createMockNoteRepository();
      markdownProcessor = createMockMarkdownProcessor();
      textGenerator = createMockTextGenerator();
      useCase = new SummarizeNoteUseCase(noteRepository, markdownProcessor, textGenerator);
    });

    it('summarizes note content through the text generator with one citation source', async () => {
      vi.mocked(noteRepository.findById).mockResolvedValue(
        createNoteProps({ id: 'note-1', title: 'Architecture' }),
      );
      vi.mocked(noteRepository.getContentById).mockResolvedValue('# Architecture\n\n**Ports**');
      vi.mocked(textGenerator.generateAnswer).mockImplementation(async (request) => ({
        text: 'Ports keep adapters swappable.',
        usedSources: request.sources,
      }));

      const result = await useCase.execute({ noteId: 'note-1' });

      expect(markdownProcessor.extractPlainText).toHaveBeenCalledWith('# Architecture\n\n**Ports**');
      expect(textGenerator.generateAnswer).toHaveBeenCalledWith({
        query: 'Summarize this note: Architecture',
        sources: [
          {
            chunkId: 'note-1',
            noteId: 'note-1',
            title: 'Architecture',
            excerpt: 'Architecture Ports',
          },
        ],
      });
      expect(result.summary).toBe('Ports keep adapters swappable.');
      expect(result.sources).toHaveLength(1);
    });

    it('throws for missing notes and returns empty output for empty content', async () => {
      vi.mocked(noteRepository.findById).mockResolvedValueOnce(null);
      await expect(useCase.execute({ noteId: 'missing' })).rejects.toThrow(
        'Note not found: missing',
      );

      vi.mocked(noteRepository.findById).mockResolvedValueOnce(createNoteProps());
      vi.mocked(noteRepository.getContentById).mockResolvedValueOnce(null);
      await expect(useCase.execute({ noteId: 'note-1' })).resolves.toEqual({
        summary: '',
        sources: [],
      });
    });
  });

  describe('WarmUpTranscriberUseCase', () => {
    it('initializes the transcriber when it is not ready', async () => {
      const transcriber = createMockTranscriber();
      vi.mocked(transcriber.isReady).mockReturnValueOnce(false).mockReturnValueOnce(true);
      const useCase = new WarmUpTranscriberUseCase(transcriber);

      await expect(useCase.execute()).resolves.toEqual({ ready: true });
      expect(transcriber.initialize).toHaveBeenCalled();
    });

    it('reports not ready when initialization fails', async () => {
      const transcriber = createMockTranscriber();
      vi.mocked(transcriber.initialize).mockRejectedValue(new Error('download failed'));
      const useCase = new WarmUpTranscriberUseCase(transcriber);

      await expect(useCase.execute()).resolves.toEqual({ ready: false });
    });
  });
});
