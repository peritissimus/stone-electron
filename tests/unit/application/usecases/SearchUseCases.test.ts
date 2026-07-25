import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Cause, Effect, Exit, Layer, ManagedRuntime } from 'effect';
import { SearchUseCasesLive } from '../../../../src/main/application/usecases/search';
import {
  AppConfigRepositoryPort,
  EmbedderPort,
  IndexRepositoryPort,
  NoteLinkRepositoryPort,
  NoteRepositoryPort,
  RerankerPort,
  SearchEnginePort,
  SearchUseCasesPort,
  TagRepositoryPort,
  type ISearchUseCases,
  type NoteProps,
} from '../../../../src/main/domain';
import { adapterLayer } from '../../../helpers/adapterLayer';

type PromiseFacade<T> = T extends (
  ...args: infer Args
) => Effect.Effect<infer Success, unknown, unknown>
  ? (...args: Args) => Promise<Success>
  : T extends object
    ? { [Key in keyof T]: PromiseFacade<T[Key]> }
    : T;

function note(overrides: Partial<NoteProps> = {}): NoteProps {
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

describe('SearchUseCases', () => {
  let notes: any;
  let engine: any;
  let embedder: any;
  let index: any;
  let reranker: any;
  let useCases: PromiseFacade<ISearchUseCases>;

  beforeEach(() => {
    notes = {
      findById: vi.fn(),
      findAll: vi.fn(async () => []),
    };
    engine = { searchFullText: vi.fn(async () => []) };
    embedder = {
      isReady: vi.fn(() => true),
      generateEmbedding: vi.fn(async () => new Float32Array([0.1, 0.2])),
    };
    index = {
      searchFullText: vi.fn(async () => []),
      searchVector: vi.fn(async () => []),
      getNoteVector: vi.fn(),
      findSimilarNotesByVector: vi.fn(async () => []),
      getChunksForWorkspace: vi.fn(async () => []),
    };
    reranker = { rerank: vi.fn(async () => []) };
    const runtime = ManagedRuntime.make(
      SearchUseCasesLive.pipe(
        Layer.provide(
          Layer.mergeAll(
            adapterLayer(NoteRepositoryPort, notes),
            adapterLayer(SearchEnginePort, engine),
            adapterLayer(EmbedderPort, embedder),
            adapterLayer(IndexRepositoryPort, index),
            adapterLayer(TagRepositoryPort, {
              getTagsForNotes: vi.fn(async () => new Map()),
            }),
            adapterLayer(NoteLinkRepositoryPort, {
              findAll: vi.fn(async () => []),
            }),
            adapterLayer(AppConfigRepositoryPort, {
              get: vi.fn(async () => ({
                notes: { locationPolicy: { journalFolder: 'Journal' } },
              })),
            }),
            adapterLayer(RerankerPort, reranker),
          ),
        ),
      ),
    );
    const run = <A, E>(
      use: (service: ISearchUseCases) => Effect.Effect<A, E>,
    ) =>
      runtime
        .runPromiseExit(
          SearchUseCasesPort.pipe(
            Effect.flatMap((service) => use(service)),
          ),
        )
        .then((exit) => {
          if (Exit.isSuccess(exit)) return exit.value;
          throw Cause.squash(exit.cause);
        });
    useCases = {
      fullTextSearch: {
        execute: (request) =>
          run((service) => service.fullTextSearch.execute(request)),
      },
      semanticSearch: {
        execute: (request) =>
          run((service) => service.semanticSearch.execute(request)),
      },
      findSimilarNotes: {
        execute: (request) =>
          run((service) => service.findSimilarNotes.execute(request)),
      },
      hybridSearch: {
        execute: (request) =>
          run((service) => service.hybridSearch.execute(request)),
      },
      searchByTags: {
        execute: (request) =>
          run((service) => service.searchByTags.execute(request)),
      },
      searchByDateRange: {
        execute: (request) =>
          run((service) => service.searchByDateRange.execute(request)),
      },
      getRelatedNotes: {
        execute: (request) =>
          run((service) => service.getRelatedNotes.execute(request)),
      },
    };
  });

  it('runs full-text and semantic retrieval', async () => {
    vi.mocked(engine.searchFullText).mockResolvedValue([
      { note: note(), relevance: 1, matchType: 'content' },
    ]);
    vi.mocked(index.findSimilarNotesByVector).mockResolvedValue([
      { noteId: 'note-2', title: 'Similar', similarity: 0.9 },
    ]);
    await expect(
      useCases.fullTextSearch.execute({ query: 'test', limit: 10 }),
    ).resolves.toMatchObject({ total: 1 });
    await expect(
      useCases.semanticSearch.execute({ query: 'test' }),
    ).resolves.toEqual({
      results: [{ noteId: 'note-2', title: 'Similar', distance: 0.9 }],
    });
  });

  it('finds similar notes or returns empty without a source vector', async () => {
    vi.mocked(index.getNoteVector)
      .mockResolvedValueOnce([0.1, 0.2])
      .mockResolvedValueOnce(null);
    vi.mocked(notes.findById).mockResolvedValue(note());
    vi.mocked(index.findSimilarNotesByVector).mockResolvedValue([
      { noteId: 'note-2', title: 'Similar', similarity: 0.8 },
    ]);
    await expect(
      useCases.findSimilarNotes.execute({ noteId: 'note-1' }),
    ).resolves.toMatchObject({ results: [{ noteId: 'note-2' }] });
    await expect(
      useCases.findSimilarNotes.execute({ noteId: 'note-1' }),
    ).resolves.toEqual({ results: [] });
  });

  it('merges and reranks chunk retrieval into note rows', async () => {
    const chunk = {
      id: 'note-1:0',
      noteId: 'note-1',
      workspaceId: 'ws-1',
      chunkIndex: 0,
      headingPath: ['Sessions'],
      text: 'Session management',
      contentHash: 'hash',
      tokenCount: 2,
      embedding: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(index.searchFullText).mockResolvedValue([{ chunk }]);
    vi.mocked(index.searchVector).mockResolvedValue([{ chunk }]);
    vi.mocked(reranker.rerank).mockResolvedValue([
      { id: chunk.id, score: 2 },
    ]);
    vi.mocked(notes.findById).mockResolvedValue(note());
    const result = await useCases.hybridSearch.execute({
      query: 'sessions',
    });
    expect(result.results[0]).toMatchObject({
      searchType: 'hybrid',
      note: { id: 'note-1' },
      chunks: [{ headingPath: ['Sessions'] }],
    });
  });

  it('filters date ranges and handles empty/tag searches', async () => {
    vi.mocked(notes.findAll).mockResolvedValue([
      note({ id: 'in', updatedAt: new Date('2024-01-15') }),
      note({ id: 'out', updatedAt: new Date('2024-02-15') }),
    ]);
    await expect(
      useCases.searchByDateRange.execute({
        startDate: new Date('2024-01-01').getTime(),
        endDate: new Date('2024-01-31').getTime(),
      }),
    ).resolves.toMatchObject({ total: 1, notes: [{ id: 'in' }] });
    await expect(
      useCases.searchByTags.execute({ tagIds: ['tag-1'] }),
    ).resolves.toEqual({ notes: [], total: 0 });
    await expect(
      useCases.hybridSearch.execute({ query: ' ' }),
    ).resolves.toMatchObject({ results: [], total: 0 });
  });
});
