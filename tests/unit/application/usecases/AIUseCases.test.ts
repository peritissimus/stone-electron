import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Cause, Effect, Exit, Layer, ManagedRuntime } from 'effect';
import { AIUseCasesLive } from '../../../../src/main/application/usecases/ai';
import {
  AIUseCasesPort,
  AppConfigRepositoryPort,
  IndexRepositoryPort,
  JournalReaderPort,
  MarkdownProcessorPort,
  NoteRepositoryPort,
  SearchUseCasesPort,
  TextGeneratorPort,
  WorkspaceRepositoryPort,
  type IAIUseCases,
  type ISearchUseCases,
  type NoteProps,
} from '../../../../src/main/domain';
import { adapterLayer } from '../../../helpers/adapterLayer';
import { effectifyUseCases } from '../../../helpers/effectUseCases';

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
    title: 'AI Roadmap',
    filePath: 'roadmap.md',
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
  let notes: any;
  let search: any;
  let generator: any;
  let index: any;
  let useCases: PromiseFacade<IAIUseCases>;

  beforeEach(() => {
    notes = {
      findById: vi.fn(),
      getContentById: vi.fn(),
    };
    search = {
      hybridSearch: {
        execute: vi.fn(async () => ({
          results: [],
          total: 0,
          queryTimeMs: 0,
        })),
      },
    };
    generator = {
      planQuery: vi.fn(async ({ query }: { query: string }) => ({
        searchQuery: query,
        dateStart: null,
        dateEnd: null,
      })),
      generateAnswer: vi.fn(async (request: any) => ({
        text: 'Answer',
        usedSources: request.sources,
      })),
    };
    index = {
      getNoteVector: vi.fn(),
      findSimilarNotesByVector: vi.fn(async () => []),
    };
    const runtime = ManagedRuntime.make(
      AIUseCasesLive.pipe(
        Layer.provide(
          Layer.mergeAll(
            Layer.succeed(
              SearchUseCasesPort,
              effectifyUseCases(search) as ISearchUseCases,
            ),
            adapterLayer(NoteRepositoryPort, notes),
            adapterLayer(TextGeneratorPort, generator),
            adapterLayer(JournalReaderPort, {
              findRecent: vi.fn(async () => []),
            }),
            adapterLayer(WorkspaceRepositoryPort, {
              findById: vi.fn(),
              findActive: vi.fn(),
            }),
            adapterLayer(AppConfigRepositoryPort, {
              get: vi.fn(async () => ({
                notes: { locationPolicy: { journalFolder: 'Journal' } },
              })),
            }),
            adapterLayer(MarkdownProcessorPort, {
              extractPlainText: vi.fn((value: string) =>
                value.replace(/[#*_`]/g, ''),
              ),
            }),
            adapterLayer(IndexRepositoryPort, index),
          ),
        ),
      ),
    );
    const run = <A, E>(
      use: (service: IAIUseCases) => Effect.Effect<A, E>,
    ) =>
      runtime
        .runPromiseExit(
          AIUseCasesPort.pipe(
            Effect.flatMap((service) => use(service)),
          ),
        )
        .then((exit) => {
          if (Exit.isSuccess(exit)) return exit.value;
          throw Cause.squash(exit.cause);
        });
    useCases = {
      askNotes: {
        execute: (request) =>
          run((service) => service.askNotes.execute(request)),
      },
      summarizeNote: {
        execute: (request) =>
          run((service) => service.summarizeNote.execute(request)),
      },
      suggestLinks: {
        execute: (request) =>
          run((service) => service.suggestLinks.execute(request)),
      },
    };
  });

  it('builds chunk citations from hybrid search', async () => {
    const source = note();
    vi.mocked(search.hybridSearch.execute).mockResolvedValue({
      results: [
        {
          note: source,
          score: 0.8,
          searchType: 'hybrid',
          chunks: [
            {
              chunkId: 'note-1:0',
              noteId: 'note-1',
              headingPath: ['Constraints'],
              excerpt: 'Cite sources.',
              score: 0.8,
              sources: ['fts', 'semantic'],
            },
          ],
        },
      ],
      total: 1,
      queryTimeMs: 1,
    });
    const result = await useCases.askNotes.execute({
      query: 'How?',
      workspaceId: 'ws-1',
    });
    expect(result.sources).toEqual([
      expect.objectContaining({
        chunkId: 'note-1:0',
        excerpt: 'Cite sources.',
      }),
    ]);
  });

  it('summarizes note content and preserves missing-note errors', async () => {
    vi.mocked(notes.findById)
      .mockResolvedValueOnce(note())
      .mockResolvedValueOnce(null);
    vi.mocked(notes.getContentById).mockResolvedValue('# Body');
    await expect(
      useCases.summarizeNote.execute({ noteId: 'note-1' }),
    ).resolves.toMatchObject({ summary: 'Answer' });
    await expect(
      useCases.summarizeNote.execute({ noteId: 'missing' }),
    ).rejects.toThrow('Note not found: missing');
  });

  it('suggests links from the indexed note vector', async () => {
    vi.mocked(index.getNoteVector).mockResolvedValue([0.1, 0.2]);
    vi.mocked(notes.findById).mockResolvedValue(note());
    vi.mocked(index.findSimilarNotesByVector).mockResolvedValue([
      { noteId: 'target', title: 'Target', similarity: 0.82 },
    ]);
    await expect(
      useCases.suggestLinks.execute({ noteId: 'note-1' }),
    ).resolves.toEqual({
      links: [
        {
          noteId: 'target',
          title: 'Target',
          reason: 'Semantically similar note',
          score: 0.82,
        },
      ],
    });
  });
});
