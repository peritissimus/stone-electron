import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Cause, Effect, Exit, Layer, ManagedRuntime } from 'effect';
import { NoteUseCasesLive } from '../../../../src/main/application/usecases/note';
import {
  AppConfigRepositoryPort,
  EventPublisherPort,
  FileStoragePort,
  IdGeneratorPort,
  MarkdownProcessorPort,
  NoteNotFoundError,
  NoteRepositoryPort,
  NoteUseCasesPort,
  PathServicePort,
  WorkspaceRepositoryPort,
  type INoteUseCases,
  type NoteProps,
} from '../../../../src/main/domain';
import type { IAppConfigRepository } from '../../../../src/main/domain/ports/out/IAppConfigRepository';
import type { IEventPublisher } from '../../../../src/main/domain/ports/out/IEventPublisher';
import type { IFileStorage } from '../../../../src/main/domain/ports/out/IFileStorage';
import type { IMarkdownProcessor } from '../../../../src/main/domain/ports/out/IMarkdownProcessor';
import type { INoteRepository } from '../../../../src/main/domain/ports/out/INoteRepository';
import type { IWorkspaceRepository } from '../../../../src/main/domain/ports/out/IWorkspaceRepository';
import { adapterLayer } from '../../../helpers/adapterLayer';
import { DEFAULT_APP_CONFIG } from '../../../../src/shared/types/settings';
import { createMockIdGenerator, createMockPathService } from './testDoubles';

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
    filePath: 'Personal/test.md',
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

function makeFacade(
  runtime: ManagedRuntime.ManagedRuntime<INoteUseCases, never>,
): PromiseFacade<INoteUseCases> {
  const at = (path: PropertyKey[]): unknown =>
    new Proxy(() => undefined, {
      get: (_target, property) => at([...path, property]),
      apply: (_target, _thisArg, args: unknown[]) =>
        runtime
          .runPromiseExit(
            NoteUseCasesPort.pipe(
              Effect.flatMap((service) => {
                let value: unknown = service;
                let owner: unknown = service;
                for (const part of path) {
                  owner = value;
                  value = (value as Record<PropertyKey, unknown>)[part];
                }
                return (
                  value as (
                    this: unknown,
                    ...methodArgs: unknown[]
                  ) => Effect.Effect<unknown, Error>
                ).apply(owner, args);
              }),
            ),
          )
          .then((exit) => {
            if (Exit.isSuccess(exit)) return exit.value;
            throw Cause.squash(exit.cause);
          }),
    });
  return at([]) as PromiseFacade<INoteUseCases>;
}

describe('NoteUseCases', () => {
  let noteRepository: INoteRepository;
  let workspaceRepository: IWorkspaceRepository;
  let fileStorage: IFileStorage;
  let markdownProcessor: IMarkdownProcessor;
  let eventPublisher: IEventPublisher;
  let appConfigRepository: IAppConfigRepository;
  let useCases: PromiseFacade<INoteUseCases>;

  beforeEach(() => {
    noteRepository = {
      findById: vi.fn(),
      findAll: vi.fn(async () => []),
      findByFilePath: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      searchByTitle: vi.fn(async () => []),
      count: vi.fn(async () => 0),
      findFavorites: vi.fn(async () => []),
      findPinned: vi.fn(async () => []),
      findArchived: vi.fn(async () => []),
      findDeleted: vi.fn(async () => []),
    } as unknown as INoteRepository;
    workspaceRepository = {
      findById: vi.fn(),
      findActive: vi.fn(),
    } as unknown as IWorkspaceRepository;
    fileStorage = {
      read: vi.fn(),
      write: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
    } as unknown as IFileStorage;
    markdownProcessor = {
      extractTitle: vi.fn(),
    } as unknown as IMarkdownProcessor;
    eventPublisher = {
      publish: vi.fn(),
    } as unknown as IEventPublisher;
    appConfigRepository = {
      get: vi.fn(async () => DEFAULT_APP_CONFIG),
    } as unknown as IAppConfigRepository;
    const dependencies = Layer.mergeAll(
      adapterLayer(NoteRepositoryPort, noteRepository),
      adapterLayer(WorkspaceRepositoryPort, workspaceRepository),
      adapterLayer(FileStoragePort, fileStorage),
      adapterLayer(MarkdownProcessorPort, markdownProcessor),
      adapterLayer(AppConfigRepositoryPort, appConfigRepository),
      adapterLayer(IdGeneratorPort, createMockIdGenerator()),
      adapterLayer(PathServicePort, createMockPathService()),
      adapterLayer(EventPublisherPort, eventPublisher),
    );
    useCases = makeFacade(
      ManagedRuntime.make(
        NoteUseCasesLive.pipe(Layer.provide(dependencies)),
      ),
    );
  });

  it('creates a note through storage, repository, and event ports', async () => {
    vi.mocked(workspaceRepository.findActive).mockResolvedValue({
      id: 'ws-1',
      folderPath: '/workspace',
    } as never);
    const result = await useCases.createNote.execute({
      title: 'New Note',
      content: 'Body',
    });
    expect(result.note.title).toBe('New Note');
    expect(result.note.workspaceId).toBe('ws-1');
    expect(fileStorage.write).toHaveBeenCalledWith(
      expect.stringContaining('/workspace/'),
      'Body',
    );
    expect(noteRepository.save).toHaveBeenCalled();
    expect(eventPublisher.publish).toHaveBeenCalled();
  });

  it('fails creation when no workspace is active', async () => {
    vi.mocked(workspaceRepository.findActive).mockResolvedValue(null);
    await expect(
      useCases.createNote.execute({ title: 'New Note' }),
    ).rejects.toThrow('No active workspace');
  });

  it('gets a note with optional raw content', async () => {
    vi.mocked(noteRepository.findById).mockResolvedValue(note());
    vi.mocked(workspaceRepository.findById).mockResolvedValue({
      id: 'ws-1',
      folderPath: '/workspace',
    } as never);
    vi.mocked(fileStorage.exists).mockResolvedValue(true);
    vi.mocked(fileStorage.read).mockResolvedValue('# Test\n\nBody');
    await expect(
      useCases.getNote.execute({ id: 'note-1', includeContent: true }),
    ).resolves.toMatchObject({ content: '# Test\n\nBody' });
  });

  it('updates metadata and writes titled markdown content', async () => {
    vi.mocked(noteRepository.findById).mockResolvedValue(note());
    vi.mocked(workspaceRepository.findById).mockResolvedValue({
      id: 'ws-1',
      folderPath: '/workspace',
    } as never);
    const result = await useCases.updateNote.execute({
      id: 'note-1',
      title: 'Updated',
      content: 'Body',
      isFavorite: true,
    });
    expect(result.note).toMatchObject({ title: 'Updated', isFavorite: true });
    expect(fileStorage.write).toHaveBeenCalledWith(
      '/workspace/Personal/test.md',
      '# Updated\n\nBody',
    );
  });

  it('loads and saves editor-body content', async () => {
    vi.mocked(noteRepository.findById).mockResolvedValue(note());
    vi.mocked(workspaceRepository.findById).mockResolvedValue({
      id: 'ws-1',
      folderPath: '/workspace',
    } as never);
    vi.mocked(fileStorage.exists).mockResolvedValue(true);
    vi.mocked(fileStorage.read).mockResolvedValue('# Test Note\n\nBody text');
    await expect(
      useCases.getNoteContent.execute({ id: 'note-1' }),
    ).resolves.toEqual({ content: 'Body text' });
    await useCases.saveNoteContent.execute({
      id: 'note-1',
      content: 'Changed',
    });
    expect(fileStorage.write).toHaveBeenLastCalledWith(
      '/workspace/Personal/test.md',
      '# Test Note\n\nChanged',
    );
  });

  it('lists filters and searches in the active workspace', async () => {
    const favorite = note({ isFavorite: true });
    vi.mocked(workspaceRepository.findActive).mockResolvedValue({
      id: 'ws-1',
    } as never);
    vi.mocked(noteRepository.findFavorites).mockResolvedValue([favorite]);
    vi.mocked(noteRepository.searchByTitle).mockResolvedValue([favorite]);
    await expect(
      useCases.listNotes.execute({ filter: 'favorites' }),
    ).resolves.toEqual({ notes: [favorite], total: 1 });
    await expect(
      useCases.searchNotes.execute({ query: 'Test' }),
    ).resolves.toEqual({ notes: [favorite], total: 1 });
  });

  it('soft deletes, restores, moves, and toggles note flags', async () => {
    vi.mocked(noteRepository.findById).mockResolvedValue(note());
    await useCases.deleteNote.execute({ id: 'note-1' });
    await useCases.restoreNote.execute({ id: 'note-1' });
    await useCases.moveNote.execute({
      id: 'note-1',
      targetNotebookId: 'nb-2',
    });
    await expect(
      useCases.toggleFavorite.execute({ id: 'note-1' }),
    ).resolves.toMatchObject({ note: { isFavorite: true } });
    await expect(
      useCases.togglePin.execute({ id: 'note-1' }),
    ).resolves.toMatchObject({ note: { isPinned: true } });
    await expect(
      useCases.toggleArchive.execute({ id: 'note-1' }),
    ).resolves.toMatchObject({ note: { isArchived: true } });
    expect(noteRepository.save).toHaveBeenCalledTimes(6);
  });

  it('permanently deletes the backing file and repository row', async () => {
    vi.mocked(noteRepository.findById).mockResolvedValue(note());
    vi.mocked(workspaceRepository.findById).mockResolvedValue({
      id: 'ws-1',
      folderPath: '/workspace',
    } as never);
    vi.mocked(fileStorage.exists).mockResolvedValue(true);
    await useCases.deleteNote.execute({ id: 'note-1', permanent: true });
    expect(fileStorage.delete).toHaveBeenCalledWith(
      '/workspace/Personal/test.md',
    );
    expect(noteRepository.delete).toHaveBeenCalledWith('note-1');
  });

  it('returns an indexed path or creates its note from disk', async () => {
    vi.mocked(workspaceRepository.findActive).mockResolvedValue({
      id: 'ws-1',
      folderPath: '/workspace',
    } as never);
    vi.mocked(noteRepository.findByFilePath)
      .mockResolvedValueOnce(note())
      .mockResolvedValueOnce(null);
    await expect(
      useCases.getNoteByPath.execute({ filePath: 'Personal/test.md' }),
    ).resolves.toEqual({ note: note() });
    vi.mocked(fileStorage.exists).mockResolvedValue(true);
    vi.mocked(fileStorage.read).mockResolvedValue('# Disk title\n\nBody');
    vi.mocked(markdownProcessor.extractTitle).mockReturnValue('Disk title');
    const created = await useCases.getNoteByPath.execute({
      filePath: 'Personal/disk.md',
    });
    expect(created.note).toMatchObject({
      title: 'Disk title',
      filePath: 'Personal/disk.md',
    });
  });

  it('uses the journal filename as its title', async () => {
    vi.mocked(workspaceRepository.findActive).mockResolvedValue({
      id: 'ws-1',
      folderPath: '/workspace',
    } as never);
    vi.mocked(noteRepository.findByFilePath).mockResolvedValue(null);
    vi.mocked(fileStorage.exists).mockResolvedValue(true);
    vi.mocked(fileStorage.read).mockResolvedValue('# Human title');
    const result = await useCases.getNoteByPath.execute({
      filePath: 'Journal/2026-01-11.md',
    });
    expect(result.note.title).toBe('2026-01-11');
    expect(markdownProcessor.extractTitle).not.toHaveBeenCalled();
  });

  it('preserves typed not-found failures', async () => {
    vi.mocked(noteRepository.findById).mockResolvedValue(null);
    await expect(
      useCases.getNote.execute({ id: 'missing' }),
    ).rejects.toBeInstanceOf(NoteNotFoundError);
  });
});
