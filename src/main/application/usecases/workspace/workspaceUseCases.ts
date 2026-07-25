import { Effect, Layer } from 'effect';
import {
  AppConfigRepositoryPort,
  DOMAIN_EVENT_TYPES,
  EventPublisherPort,
  FileStoragePort,
  IdGeneratorPort,
  IndexUseCasesPort,
  MarkdownProcessorPort,
  NoteEntity,
  NoteRepositoryPort,
  PathServicePort,
  SystemBridgePort,
  WorkspaceEntity,
  WorkspaceNotFoundError,
  WorkspaceRepositoryPort,
  WorkspaceActivationPort,
  WorkspaceUseCasesPort,
  type IWorkspaceUseCases,
  type IEventPublisher,
  type ScanWorkspaceFolderStructure,
  type ScanWorkspaceResponse,
} from '../../../domain';
import {
  WorkspaceDiffer,
  type DbEntry,
  type FsEntry,
} from '../../../domain/services/WorkspaceDiffer';

const SYNC_CONCURRENCY = 4;
type PhaseResult = {
  created: number;
  updated: number;
  deleted: number;
  embedded: number;
  error?: string;
};
const emptyPhase = (): PhaseResult => ({
  created: 0,
  updated: 0,
  deleted: 0,
  embedded: 0,
});

export const WorkspaceUseCasesLive = Layer.effect(
  WorkspaceUseCasesPort,
  Effect.gen(function* () {
    const workspaceRepository = yield* WorkspaceRepositoryPort;
    const noteRepository = yield* NoteRepositoryPort;
    const fileStorage = yield* FileStoragePort;
    const systemBridge = yield* SystemBridgePort;
    const markdownProcessor = yield* MarkdownProcessorPort;
    const appConfigRepository = yield* AppConfigRepositoryPort;
    const idGenerator = yield* IdGeneratorPort;
    const pathService = yield* PathServicePort;
    const indexUseCases = yield* IndexUseCasesPort;
    const eventPublisher = yield* EventPublisherPort;
    const workspaceActivation = yield* WorkspaceActivationPort;

    const publish = (
      type: string,
      payload: Record<string, unknown>,
    ) =>
      Effect.clockWith((clock) => clock.currentTimeMillis).pipe(
        Effect.flatMap((now) =>
          eventPublisher.publish({
            type,
            timestamp: new Date(now),
            payload,
          } as Parameters<IEventPublisher['publish']>[0]),
        ),
      );

    const activeWorkspace = () =>
      workspaceRepository.findActive().pipe(
        Effect.flatMap((workspace) =>
          workspace
            ? Effect.succeed(workspace)
            : Effect.fail(new Error('No active workspace')),
        ),
      );

    const buildStructure = (
      basePath: string,
      relativePath: string,
    ): Effect.Effect<ScanWorkspaceResponse['structure'], Error> =>
      Effect.gen(function* () {
        const currentPath = relativePath
          ? yield* pathService.join(basePath, relativePath)
          : basePath;
        const items = yield* fileStorage.listFiles(currentPath);
        const visible = items.filter((item) => !item.name.startsWith('.'));
        const entries: Array<ScanWorkspaceFolderStructure | null> =
          yield* Effect.forEach(
          visible,
          (item): Effect.Effect<
            ScanWorkspaceFolderStructure | null,
            Error
          > => {
            const itemRelativePath = relativePath
              ? `${relativePath}/${item.name}`
              : item.name;
            if (item.isDirectory) {
              return Effect.suspend(() =>
                buildStructure(basePath, itemRelativePath),
              ).pipe(
                Effect.map((children) => ({
                  name: item.name,
                  path: item.path,
                  relativePath: itemRelativePath.replaceAll('\\', '/'),
                  type: 'folder' as const,
                  children,
                })),
              );
            }
            return item.name.endsWith('.md')
              ? Effect.succeed({
                  name: item.name,
                  path: item.path,
                  relativePath: itemRelativePath.replaceAll('\\', '/'),
                  type: 'file' as const,
                })
              : Effect.succeed(null);
          },
          { concurrency: 1 },
        );
        return entries.filter(
          (entry): entry is NonNullable<typeof entry> => entry !== null,
        );
      });

    const syncWorkspace: IWorkspaceUseCases['syncWorkspace']['execute'] = (
      request,
    ) =>
      Effect.gen(function* () {
        const workspace = request?.workspaceId
          ? yield* workspaceRepository.findById(request.workspaceId)
          : yield* workspaceRepository.findActive();
        if (!workspace) {
          return yield* Effect.fail(
            request?.workspaceId
              ? new WorkspaceNotFoundError(request.workspaceId)
              : new Error('No active workspace'),
          );
        }
        const markdownFiles = yield* fileStorage.glob(
          '**/*.md',
          workspace.folderPath,
        );
        const fsEntries = (
          yield* Effect.forEach(
            markdownFiles,
            (relativePath) =>
              Effect.gen(function* () {
                const absolutePath = yield* pathService.join(
                  workspace.folderPath,
                  relativePath,
                );
                const info = yield* fileStorage.getFileInfo(absolutePath);
                return info
                  ? ({ relativePath, modifiedAt: info.modifiedAt } satisfies FsEntry)
                  : null;
              }),
            { concurrency: SYNC_CONCURRENCY },
          )
        ).filter((entry): entry is FsEntry => entry !== null);
        const existingNotes = yield* noteRepository.findAll({
          workspaceId: workspace.id,
        });
        const existingById = new Map(
          existingNotes.map((note) => [note.id, note]),
        );
        const dbEntries: DbEntry[] = existingNotes.map((note) => ({
          id: note.id,
          filePath: note.filePath,
          updatedAt: note.updatedAt,
          isDeleted: note.isDeleted,
        }));
        const plan = WorkspaceDiffer.diff(fsEntries, dbEntries);

        const added = yield* Effect.forEach(
          plan.added,
          (entry) =>
            Effect.gen(function* () {
              const absolutePath = yield* pathService.join(
                workspace.folderPath,
                entry.relativePath,
              );
              const content = yield* fileStorage.read(absolutePath);
              const extracted = content
                ? yield* markdownProcessor.extractTitle(content)
                : null;
              const title =
                extracted ??
                (yield* pathService.basename(entry.relativePath, '.md'));
              const note = NoteEntity.create({
                id: yield* idGenerator.generate(),
                title,
                filePath: entry.relativePath,
                workspaceId: workspace.id,
              });
              yield* noteRepository.save(note);
              yield* publish(DOMAIN_EVENT_TYPES.NOTE_CREATED, {
                id: note.id,
              });
              const indexed = yield* indexUseCases.indexNote
                .execute({ noteId: note.id })
                .pipe(Effect.either);
              if (
                indexed._tag === 'Left' ||
                indexed.right.status === 'failed'
              ) {
                const message =
                  indexed._tag === 'Left'
                    ? indexed.left.message
                    : indexed.right.error ?? 'unknown error';
                return {
                  ...emptyPhase(),
                  created: 1,
                  error: `Index failed for ${entry.relativePath}: ${message}`,
                };
              }
              return {
                ...emptyPhase(),
                created: 1,
                embedded:
                  indexed.right.status === 'indexed' &&
                  indexed.right.chunkCount > 0
                    ? 1
                    : 0,
              };
            }).pipe(
              Effect.catchAll((error) =>
                Effect.succeed({
                  ...emptyPhase(),
                  error: `Add failed for ${entry.relativePath}: ${error.message}`,
                }),
              ),
            ),
          { concurrency: SYNC_CONCURRENCY },
        );

        const modified = yield* Effect.forEach(
          plan.modified,
          (entry) => {
            const existing = existingById.get(entry.dbId);
            if (!existing) return Effect.succeed(emptyPhase());
            return Effect.gen(function* () {
              const absolutePath = yield* pathService.join(
                workspace.folderPath,
                entry.relativePath,
              );
              const entity = NoteEntity.fromPersistence(existing);
              const content = yield* fileStorage.read(absolutePath);
              if (content) {
                const title = yield* markdownProcessor.extractTitle(content);
                if (title && title !== existing.title) entity.updateTitle(title);
              }
              if (existing.filePath) entity.updateFilePath(existing.filePath);
              yield* noteRepository.save(entity);
              yield* publish(DOMAIN_EVENT_TYPES.NOTE_UPDATED, {
                id: existing.id,
              });
              const indexed = yield* indexUseCases.indexNote
                .execute({ noteId: existing.id })
                .pipe(Effect.either);
              return indexed._tag === 'Left'
                ? {
                    ...emptyPhase(),
                    updated: 1,
                    error: `Reindex failed for ${entry.relativePath}: ${indexed.left.message}`,
                  }
                : { ...emptyPhase(), updated: 1 };
            }).pipe(
              Effect.catchAll((error) =>
                Effect.succeed({
                  ...emptyPhase(),
                  error: `Modify failed for ${entry.relativePath}: ${error.message}`,
                }),
              ),
            );
          },
          { concurrency: SYNC_CONCURRENCY },
        );

        const removed = yield* Effect.forEach(
          plan.removed,
          (entry) => {
            const existing = existingById.get(entry.dbId);
            if (!existing) return Effect.succeed(emptyPhase());
            return Effect.gen(function* () {
              const entity = NoteEntity.fromPersistence(existing);
              entity.delete();
              yield* noteRepository.save(entity);
              yield* publish(DOMAIN_EVENT_TYPES.NOTE_DELETED, {
                id: existing.id,
              });
              return { ...emptyPhase(), deleted: 1 };
            }).pipe(
              Effect.catchAll((error) =>
                Effect.succeed({
                  ...emptyPhase(),
                  error: `Delete failed for ${
                    existing.filePath ?? entry.dbId
                  }: ${error.message}`,
                }),
              ),
            );
          },
          { concurrency: SYNC_CONCURRENCY },
        );
        const results = [...added, ...modified, ...removed];
        return {
          workspaceId: workspace.id,
          notebooks: { created: 0, updated: 0, errors: [] },
          notes: {
            created: results.reduce((sum, item) => sum + item.created, 0),
            updated: results.reduce((sum, item) => sum + item.updated, 0),
            deleted: results.reduce((sum, item) => sum + item.deleted, 0),
            embedded: results.reduce((sum, item) => sum + item.embedded, 0),
            errors: results.flatMap((item) =>
              item.error ? [item.error] : [],
            ),
          },
        };
      });

    const service: IWorkspaceUseCases = {
      createWorkspace: {
        execute: (request) =>
          Effect.gen(function* () {
            yield* fileStorage.createDirectory(request.folderPath);
            const config = yield* appConfigRepository.get();
            const policy = config.notes.locationPolicy;
            const folders = new Set(
              [
                policy.journalFolder,
                policy.defaultNoteFolder,
                ...Object.values(policy.quickNoteSlotFolders),
              ].filter(Boolean),
            );
            yield* Effect.forEach(
              folders,
              (folder) =>
                pathService
                  .join(request.folderPath, folder)
                  .pipe(Effect.flatMap(fileStorage.createDirectory)),
              { concurrency: 4, discard: true },
            );
            const existing = (yield* workspaceRepository.findAll()).find(
              (candidate) =>
                candidate.folderPath === request.folderPath,
            );
            if (existing) return { workspace: existing };
            const workspace = WorkspaceEntity.create({
              id: yield* idGenerator.generate(),
              name: request.name,
              folderPath: request.folderPath,
              isActive: false,
            });
            yield* workspaceRepository.save(workspace);
            yield* publish(DOMAIN_EVENT_TYPES.WORKSPACE_CREATED, {
              workspace: workspace.toPersistence(),
            });
            return { workspace: workspace.toPersistence() };
          }),
      },
      getWorkspace: {
        execute: ({ id }) =>
          workspaceRepository.findById(id).pipe(
            Effect.flatMap((workspace) =>
              workspace
                ? Effect.succeed({ workspace })
                : Effect.fail(new WorkspaceNotFoundError(id)),
            ),
          ),
      },
      listWorkspaces: {
        execute: () =>
          workspaceRepository
            .findAll()
            .pipe(Effect.map((workspaces) => ({ workspaces }))),
      },
      getActiveWorkspace: {
        execute: () =>
          workspaceRepository
            .findActive()
            .pipe(Effect.map((workspace) => ({ workspace }))),
      },
      setActiveWorkspace: {
        execute: ({ id }) =>
          Effect.gen(function* () {
            const props = yield* workspaceRepository.findById(id);
            if (!props) {
              return yield* Effect.fail(new WorkspaceNotFoundError(id));
            }
            const all = yield* workspaceRepository.findAll();
            yield* Effect.forEach(
              all.filter((workspace) => workspace.isActive && workspace.id !== id),
              (workspace) => {
                const entity = WorkspaceEntity.fromPersistence(workspace);
                entity.deactivate();
                return workspaceRepository.save(entity);
              },
              { concurrency: 1, discard: true },
            );
            const workspace = WorkspaceEntity.fromPersistence(props);
            workspace.activate();
            yield* workspaceRepository.save(workspace);
            yield* publish(DOMAIN_EVENT_TYPES.WORKSPACE_ACTIVATED, {
              workspace: workspace.toPersistence(),
            });
            yield* workspaceActivation
              .afterActivated(workspace.id)
              .pipe(Effect.catchAll(() => Effect.void));
            return { workspace: workspace.toPersistence() };
          }),
      },
      deleteWorkspace: {
        execute: ({ id }) =>
          workspaceRepository.exists(id).pipe(
            Effect.flatMap((exists) =>
              exists
                ? workspaceRepository.delete(id)
                : Effect.fail(new WorkspaceNotFoundError(id)),
            ),
            Effect.tap(() =>
              publish(DOMAIN_EVENT_TYPES.WORKSPACE_DELETED, { id }),
            ),
          ),
      },
      updateWorkspace: {
        execute: ({ id, name }) =>
          Effect.gen(function* () {
            const props = yield* workspaceRepository.findById(id);
            if (!props) {
              return yield* Effect.fail(new WorkspaceNotFoundError(id));
            }
            const workspace = WorkspaceEntity.fromPersistence(props);
            if (name) workspace.rename(name);
            yield* workspaceRepository.save(workspace);
            yield* publish(DOMAIN_EVENT_TYPES.WORKSPACE_UPDATED, {
              workspace: workspace.toPersistence(),
            });
            return { workspace: workspace.toPersistence() };
          }),
      },
      getDefaultWorkspacePath: {
        execute: () =>
          appConfigRepository.get().pipe(
            Effect.flatMap((config) =>
              systemBridge.getDefaultWorkspaceDir(
                config.workspace.defaultWorkspacePath,
              ),
            ),
            Effect.map((path) => ({ path })),
          ),
      },
      selectFolder: {
        execute: (request) =>
          appConfigRepository.get().pipe(
            Effect.flatMap((config) =>
              systemBridge.selectFolder({
                title: request?.title ?? 'Select Workspace Folder',
                defaultPath:
                  request?.defaultPath ??
                  config.workspace.defaultWorkspacePath,
                buttonLabel: 'Select Folder',
              }),
            ),
            Effect.map((folderPath) =>
              folderPath
                ? { canceled: false as const, folderPath }
                : { canceled: true as const },
            ),
          ),
      },
      validatePath: {
        execute: ({ folderPath }) =>
          systemBridge.validatePath(folderPath).pipe(
            Effect.map((valid) =>
              valid
                ? { valid: true }
                : {
                    valid: false,
                    error: 'Path does not exist or is not accessible',
                  },
            ),
          ),
      },
      createFolder: {
        execute: ({ name, parentPath }) =>
          Effect.gen(function* () {
            const workspace = yield* activeWorkspace();
            const base = parentPath
              ? yield* pathService.join(workspace.folderPath, parentPath)
              : workspace.folderPath;
            const folder = yield* pathService.join(base, name);
            yield* fileStorage.createDirectory(folder);
            return {
              path: yield* pathService.relative(
                workspace.folderPath,
                folder,
              ),
            };
          }),
      },
      renameFolder: {
        execute: ({ path, name }) =>
          Effect.gen(function* () {
            const workspace = yield* activeWorkspace();
            if (!name.trim()) return yield* Effect.fail(new Error('Folder name is required'));
            const absolute = yield* pathService.join(workspace.folderPath, path);
            if (!(yield* fileStorage.exists(absolute))) {
              return yield* Effect.fail(new Error(`Folder does not exist: ${path}`));
            }
            const parent = yield* pathService.dirname(absolute);
            const renamed = yield* pathService.join(parent, name);
            yield* fileStorage.rename(absolute, renamed);
            return {
              oldPath: path,
              newPath: yield* pathService.relative(
                workspace.folderPath,
                renamed,
              ),
            };
          }),
      },
      deleteFolder: {
        execute: ({ path }) =>
          Effect.gen(function* () {
            const workspace = yield* activeWorkspace();
            if (!path.trim()) return yield* Effect.fail(new Error('Folder path is required'));
            const absolute = yield* pathService.join(workspace.folderPath, path);
            if (!(yield* fileStorage.exists(absolute))) {
              return yield* Effect.fail(new Error(`Folder does not exist: ${path}`));
            }
            yield* fileStorage.deleteDirectory(absolute);
          }),
      },
      moveFolder: {
        execute: ({ sourcePath, destinationPath }) =>
          Effect.gen(function* () {
            const workspace = yield* activeWorkspace();
            if (!sourcePath.trim()) return yield* Effect.fail(new Error('Source path is required'));
            const source = yield* pathService.join(
              workspace.folderPath,
              sourcePath,
            );
            if (!(yield* fileStorage.exists(source))) {
              return yield* Effect.fail(
                new Error(`Folder does not exist: ${sourcePath}`),
              );
            }
            const folderName = yield* pathService.basename(sourcePath);
            const parent = destinationPath
              ? yield* pathService.join(
                  workspace.folderPath,
                  destinationPath,
                )
              : workspace.folderPath;
            const destination = yield* pathService.join(parent, folderName);
            if (destination.startsWith(source + pathService.separator)) {
              return yield* Effect.fail(
                new Error('Cannot move a folder into itself'),
              );
            }
            yield* fileStorage.rename(source, destination);
            return {
              oldPath: sourcePath,
              newPath: yield* pathService.relative(
                workspace.folderPath,
                destination,
              ),
            };
          }),
      },
      scanWorkspace: {
        execute: ({ workspaceId }) =>
          Effect.gen(function* () {
            const workspace =
              yield* workspaceRepository.findById(workspaceId);
            if (!workspace) {
              return yield* Effect.fail(
                new WorkspaceNotFoundError(workspaceId),
              );
            }
            const paths = yield* fileStorage.glob(
              '**/*.md',
              workspace.folderPath,
            );
            const files = yield* Effect.forEach(
              paths,
              (relativePath) =>
                pathService
                  .join(workspace.folderPath, relativePath)
                  .pipe(
                    Effect.map((path) => ({
                      relativePath: relativePath.replaceAll('\\', '/'),
                      path,
                    })),
                  ),
              { concurrency: 4 },
            );
            const structure = yield* buildStructure(
              workspace.folderPath,
              '',
            );
            const counts: Record<string, number> = {
              __root__: files.length,
            };
            for (const file of files) {
              const parts = file.relativePath.split('/');
              let current = '';
              for (const part of parts.slice(0, -1)) {
                current = current ? `${current}/${part}` : part;
                counts[current] = (counts[current] ?? 0) + 1;
              }
            }
            return { files, structure, total: files.length, counts };
          }),
      },
      syncWorkspace: { execute: syncWorkspace },
    };
    return service;
  }),
);
