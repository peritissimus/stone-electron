import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Cause, Effect, Exit, Layer, ManagedRuntime } from 'effect';
import { WorkspaceUseCasesLive } from '../../../../src/main/application/usecases/workspace';
import {
  AppConfigRepositoryPort,
  EventPublisherPort,
  FileStoragePort,
  IdGeneratorPort,
  IndexUseCasesPort,
  MarkdownProcessorPort,
  NoteRepositoryPort,
  PathServicePort,
  SystemBridgePort,
  WorkspaceActivationPort,
  WorkspaceNotFoundError,
  WorkspaceRepositoryPort,
  WorkspaceUseCasesPort,
  type IWorkspaceUseCases,
  type IndexNoteRequest,
  type IndexNoteResponse,
  type WorkspaceProps,
} from '../../../../src/main/domain';
import type { IAppConfigRepository } from '../../../../src/main/domain/ports/out/IAppConfigRepository';
import type { IEventPublisher } from '../../../../src/main/domain/ports/out/IEventPublisher';
import type { IFileStorage } from '../../../../src/main/domain/ports/out/IFileStorage';
import type { IMarkdownProcessor } from '../../../../src/main/domain/ports/out/IMarkdownProcessor';
import type { INoteRepository } from '../../../../src/main/domain/ports/out/INoteRepository';
import type { ISystemBridge } from '../../../../src/main/domain/ports/out/ISystemBridge';
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

function workspace(overrides: Partial<WorkspaceProps> = {}): WorkspaceProps {
  return {
    id: 'ws-1',
    name: 'Workspace',
    folderPath: '/workspace',
    isActive: false,
    createdAt: new Date('2024-01-01'),
    lastAccessedAt: new Date('2024-01-02'),
    ...overrides,
  };
}

function facade(
  runtime: ManagedRuntime.ManagedRuntime<IWorkspaceUseCases, never>,
): PromiseFacade<IWorkspaceUseCases> {
  const at = (path: PropertyKey[]): unknown =>
    new Proxy(() => undefined, {
      get: (_target, property) => at([...path, property]),
      apply: (_target, _thisArg, args: unknown[]) =>
        runtime
          .runPromiseExit(
            WorkspaceUseCasesPort.pipe(
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
  return at([]) as PromiseFacade<IWorkspaceUseCases>;
}

describe('WorkspaceUseCases', () => {
  let workspaceRepository: IWorkspaceRepository;
  let noteRepository: INoteRepository;
  let fileStorage: IFileStorage;
  let systemBridge: ISystemBridge;
  let markdownProcessor: IMarkdownProcessor;
  let eventPublisher: IEventPublisher;
  let appConfigRepository: IAppConfigRepository;
  let afterActivated: (id: string) => void;
  let indexNote: (
    request: IndexNoteRequest,
  ) => Effect.Effect<IndexNoteResponse, Error>;
  let useCases: PromiseFacade<IWorkspaceUseCases>;

  beforeEach(() => {
    workspaceRepository = {
      findById: vi.fn(),
      findAll: vi.fn(async () => []),
      findActive: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
    } as unknown as IWorkspaceRepository;
    noteRepository = {
      findAll: vi.fn(async () => []),
      save: vi.fn(),
    } as unknown as INoteRepository;
    fileStorage = {
      read: vi.fn(),
      exists: vi.fn(),
      rename: vi.fn(),
      createDirectory: vi.fn(),
      deleteDirectory: vi.fn(),
      listFiles: vi.fn(async () => []),
      glob: vi.fn(async () => []),
      getFileInfo: vi.fn(),
    } as unknown as IFileStorage;
    systemBridge = {
      selectFolder: vi.fn(),
      validatePath: vi.fn(),
      getDefaultWorkspaceDir: vi.fn((path?: string) => path ?? '/default'),
    } as unknown as ISystemBridge;
    markdownProcessor = {
      extractTitle: vi.fn(),
    } as unknown as IMarkdownProcessor;
    eventPublisher = { publish: vi.fn() } as unknown as IEventPublisher;
    appConfigRepository = {
      get: vi.fn(async () => DEFAULT_APP_CONFIG),
    } as unknown as IAppConfigRepository;
    afterActivated = vi.fn<(id: string) => void>();
    indexNote = vi.fn<(request: IndexNoteRequest) => Effect.Effect<IndexNoteResponse, Error>>(() =>
      Effect.succeed({
        noteId: 'note-1',
        status: 'indexed' as const,
        chunkCount: 1,
      }),
    );
    const dependencies = Layer.mergeAll(
      adapterLayer(WorkspaceRepositoryPort, workspaceRepository),
      adapterLayer(NoteRepositoryPort, noteRepository),
      adapterLayer(FileStoragePort, fileStorage),
      adapterLayer(SystemBridgePort, systemBridge),
      adapterLayer(MarkdownProcessorPort, markdownProcessor),
      adapterLayer(AppConfigRepositoryPort, appConfigRepository),
      adapterLayer(IdGeneratorPort, createMockIdGenerator()),
      adapterLayer(PathServicePort, createMockPathService()),
      adapterLayer(EventPublisherPort, eventPublisher),
      Layer.succeed(WorkspaceActivationPort, {
        afterActivated: (id: string) =>
          Effect.sync(() => afterActivated(id)),
      }),
      Layer.succeed(IndexUseCasesPort, {
        indexNote: { execute: indexNote },
        rebuildAll: {
          execute: () =>
            Effect.succeed({
              workspaceId: '',
              total: 0,
              indexed: 0,
              skipped: 0,
              failed: 0,
              missing: 0,
            }),
        },
        getStats: {
          execute: () =>
            Effect.succeed({
              workspaceId: '',
              totalNotes: 0,
              indexedNotes: 0,
              pendingNotes: 0,
              failedNotes: 0,
              chunkCount: 0,
            }),
        },
      }),
    );
    useCases = facade(
      ManagedRuntime.make(
        WorkspaceUseCasesLive.pipe(Layer.provide(dependencies)),
      ),
    );
  });

  it('creates and scaffolds a workspace idempotently', async () => {
    const result = await useCases.createWorkspace.execute({
      name: 'New',
      folderPath: '/new',
    });
    expect(result.workspace).toMatchObject({
      name: 'New',
      folderPath: '/new',
      isActive: false,
    });
    expect(fileStorage.createDirectory).toHaveBeenCalledWith('/new');
    expect(fileStorage.createDirectory).toHaveBeenCalledWith('/new/Journal');
    expect(workspaceRepository.save).toHaveBeenCalled();

    vi.mocked(workspaceRepository.findAll).mockResolvedValue([
      workspace({ folderPath: '/new' }),
    ]);
    await expect(
      useCases.createWorkspace.execute({ name: 'Again', folderPath: '/new' }),
    ).resolves.toEqual({ workspace: workspace({ folderPath: '/new' }) });
  });

  it('gets, lists, updates, and deletes workspaces', async () => {
    vi.mocked(workspaceRepository.findById).mockResolvedValue(workspace());
    vi.mocked(workspaceRepository.findAll).mockResolvedValue([workspace()]);
    vi.mocked(workspaceRepository.exists).mockResolvedValue(true);
    await expect(
      useCases.getWorkspace.execute({ id: 'ws-1' }),
    ).resolves.toEqual({ workspace: workspace() });
    await expect(useCases.listWorkspaces.execute()).resolves.toEqual({
      workspaces: [workspace()],
    });
    await expect(
      useCases.updateWorkspace.execute({ id: 'ws-1', name: 'Renamed' }),
    ).resolves.toMatchObject({ workspace: { name: 'Renamed' } });
    await useCases.deleteWorkspace.execute({ id: 'ws-1' });
    expect(workspaceRepository.delete).toHaveBeenCalledWith('ws-1');
  });

  it('preserves typed workspace-not-found failures', async () => {
    vi.mocked(workspaceRepository.findById).mockResolvedValue(null);
    await expect(
      useCases.getWorkspace.execute({ id: 'missing' }),
    ).rejects.toBeInstanceOf(WorkspaceNotFoundError);
  });

  it('activates one workspace and invokes the post-activation port', async () => {
    vi.mocked(workspaceRepository.findById).mockResolvedValue(workspace());
    vi.mocked(workspaceRepository.findAll).mockResolvedValue([
      workspace({ id: 'old', isActive: true }),
    ]);
    const result = await useCases.setActiveWorkspace.execute({ id: 'ws-1' });
    expect(result.workspace.isActive).toBe(true);
    expect(workspaceRepository.save).toHaveBeenCalledTimes(2);
    expect(afterActivated).toHaveBeenCalledWith('ws-1');
  });

  it('delegates folder selection, defaulting, and path validation', async () => {
    vi.mocked(systemBridge.selectFolder).mockResolvedValue('/chosen');
    vi.mocked(systemBridge.validatePath).mockResolvedValue(false);
    await expect(useCases.selectFolder.execute()).resolves.toEqual({
      canceled: false,
      folderPath: '/chosen',
    });
    await expect(useCases.getDefaultWorkspacePath.execute()).resolves.toEqual({
      path: DEFAULT_APP_CONFIG.workspace.defaultWorkspacePath,
    });
    await expect(
      useCases.validatePath.execute({ folderPath: '/missing' }),
    ).resolves.toMatchObject({ valid: false });
  });

  it('creates, renames, moves, and deletes folders relative to the workspace', async () => {
    vi.mocked(workspaceRepository.findActive).mockResolvedValue(workspace());
    vi.mocked(fileStorage.exists).mockResolvedValue(true);
    await expect(
      useCases.createFolder.execute({ name: 'Child', parentPath: 'Parent' }),
    ).resolves.toEqual({ path: 'Parent/Child' });
    await expect(
      useCases.renameFolder.execute({ path: 'Parent/Child', name: 'Renamed' }),
    ).resolves.toEqual({
      oldPath: 'Parent/Child',
      newPath: 'Parent/Renamed',
    });
    await expect(
      useCases.moveFolder.execute({
        sourcePath: 'Parent/Renamed',
        destinationPath: 'Archive',
      }),
    ).resolves.toEqual({
      oldPath: 'Parent/Renamed',
      newPath: 'Archive/Renamed',
    });
    await useCases.deleteFolder.execute({ path: 'Archive/Renamed' });
    expect(fileStorage.deleteDirectory).toHaveBeenCalledWith(
      '/workspace/Archive/Renamed',
    );
  });

  it('scans markdown files into a normalized tree and counts', async () => {
    vi.mocked(workspaceRepository.findById).mockResolvedValue(workspace());
    vi.mocked(fileStorage.glob).mockResolvedValue([
      'Root.md',
      'Folder/Nested.md',
    ]);
    vi.mocked(fileStorage.listFiles).mockImplementation(async (path) =>
      path === '/workspace'
        ? [
            {
              name: 'Folder',
              path: '/workspace/Folder',
              isDirectory: true,
              size: 0,
              createdAt: new Date(),
              modifiedAt: new Date(),
            },
          ]
        : [
            {
              name: 'Nested.md',
              path: '/workspace/Folder/Nested.md',
              isDirectory: false,
              size: 1,
              createdAt: new Date(),
              modifiedAt: new Date(),
            },
          ],
    );
    const result = await useCases.scanWorkspace.execute({
      workspaceId: 'ws-1',
    });
    expect(result.total).toBe(2);
    expect(result.counts).toEqual({ __root__: 2, Folder: 1 });
    expect(result.structure[0]).toMatchObject({
      type: 'folder',
      children: [{ type: 'file' }],
    });
  });

  it('syncs added files, publishes them, and indexes inline', async () => {
    vi.mocked(workspaceRepository.findById).mockResolvedValue(workspace());
    vi.mocked(fileStorage.glob).mockResolvedValue(['Inbox.md']);
    vi.mocked(fileStorage.getFileInfo).mockResolvedValue({
      path: '/workspace/Inbox.md',
      name: 'Inbox.md',
      isDirectory: false,
      size: 10,
      createdAt: new Date(),
      modifiedAt: new Date(),
    });
    vi.mocked(fileStorage.read).mockResolvedValue('# Inbox');
    vi.mocked(markdownProcessor.extractTitle).mockReturnValue('Inbox');
    const result = await useCases.syncWorkspace.execute({
      workspaceId: 'ws-1',
    });
    expect(result.notes).toEqual({
      created: 1,
      updated: 0,
      deleted: 0,
      embedded: 1,
      errors: [],
    });
    expect(indexNote).toHaveBeenCalled();
  });
});
