import { Effect, Layer, Random } from 'effect';
import {
  AppConfigRepositoryPort,
  DOMAIN_EVENT_TYPES,
  EventPublisherPort,
  FileStoragePort,
  IdGeneratorPort,
  MarkdownProcessorPort,
  NoteEntity,
  NoteNotFoundError,
  NoteRepositoryPort,
  NoteUseCasesPort,
  PathServicePort,
  WorkspaceRepositoryPort,
  type INoteUseCases,
  type NoteProps,
} from '../../../domain';
import { stripFirstHeading } from '../../../domain/services';

export const NoteUseCasesLive = Layer.effect(
  NoteUseCasesPort,
  Effect.gen(function* () {
    const noteRepository = yield* NoteRepositoryPort;
    const workspaceRepository = yield* WorkspaceRepositoryPort;
    const fileStorage = yield* FileStoragePort;
    const markdownProcessor = yield* MarkdownProcessorPort;
    const appConfigRepository = yield* AppConfigRepositoryPort;
    const idGenerator = yield* IdGeneratorPort;
    const pathService = yield* PathServicePort;
    const eventPublisher = yield* EventPublisherPort;

    const publish = (
      type:
        | typeof DOMAIN_EVENT_TYPES.NOTE_CREATED
        | typeof DOMAIN_EVENT_TYPES.NOTE_UPDATED
        | typeof DOMAIN_EVENT_TYPES.NOTE_DELETED,
      id: string,
    ) =>
      Effect.clockWith((clock) => clock.currentTimeMillis).pipe(
        Effect.flatMap((now) =>
          eventPublisher.publish({
            type,
            timestamp: new Date(now),
            payload: { id },
          }),
        ),
      );

    const requireNote = (id: string): Effect.Effect<NoteProps, Error> =>
      noteRepository.findById(id).pipe(
        Effect.flatMap((note) =>
          note
            ? Effect.succeed(note)
            : Effect.fail(new NoteNotFoundError(id)),
        ),
      );

    const resolveWorkspace = (workspaceId?: string | null) =>
      workspaceId
        ? workspaceRepository.findById(workspaceId)
        : workspaceRepository.findActive();

    const service: INoteUseCases = {
      createNote: {
        execute: (request) =>
          Effect.gen(function* () {
            const id = request.id ?? (yield* idGenerator.generate());
            const workspace = yield* workspaceRepository.findActive();
            if (!workspace) return yield* Effect.fail(new Error('No active workspace'));
            const config = yield* appConfigRepository.get();
            const policy = config.notes.locationPolicy;
            const note = NoteEntity.create({
              id,
              title: request.title,
              notebookId: request.notebookId,
              workspaceId: request.workspaceId ?? workspace.id,
            });
            const folderPath =
              request.folderPath ?? policy.defaultNoteFolder;
            let filename: string;
            if (folderPath === policy.journalFolder && request.title) {
              filename = `${request.title}.md`;
            } else {
              const now = yield* Effect.clockWith(
                (clock) => clock.currentTimeMillis,
              );
              const random = yield* Random.nextIntBetween(0, 1000);
              const timestamp = new Date(now)
                .toISOString()
                .slice(0, 19)
                .replace(/[-:T]/g, '')
                .replace(/(\d{8})(\d{6})/, '$1-$2');
              filename = `${timestamp}-${String(random).padStart(3, '0')}.md`;
            }
            const relativePath = `${folderPath}/${filename}`;
            note.updateFilePath(relativePath);
            const absolutePath = yield* pathService.join(
              workspace.folderPath,
              relativePath,
            );
            yield* fileStorage.write(absolutePath, request.content ?? '');
            yield* noteRepository.save(note);
            yield* publish(DOMAIN_EVENT_TYPES.NOTE_CREATED, note.id);
            return { note: note.toPersistence() };
          }),
      },
      updateNote: {
        execute: (request) =>
          Effect.gen(function* () {
            const note = NoteEntity.fromPersistence(
              yield* requireNote(request.id),
            );
            if (request.title !== undefined) note.updateTitle(request.title);
            if (request.notebookId !== undefined) {
              note.moveToNotebook(request.notebookId);
            }
            if (request.isFavorite !== undefined) {
              note.setFavorite(request.isFavorite);
            }
            if (request.isPinned !== undefined) note.setPinned(request.isPinned);
            if (request.isArchived !== undefined) {
              note.setArchived(request.isArchived);
            }
            if (request.content !== undefined && note.filePath) {
              const workspace = yield* resolveWorkspace(note.workspaceId);
              if (!workspace) {
                return yield* Effect.fail(
                  new Error('Workspace not found for note'),
                );
              }
              const absolutePath = yield* pathService.join(
                workspace.folderPath,
                note.filePath,
              );
              yield* fileStorage.write(
                absolutePath,
                `# ${note.title}\n\n${request.content}`,
              );
            }
            yield* noteRepository.save(note);
            yield* publish(DOMAIN_EVENT_TYPES.NOTE_UPDATED, note.id);
            return { note: note.toPersistence() };
          }),
      },
      getNote: {
        execute: (request) =>
          Effect.gen(function* () {
            const note = yield* requireNote(request.id);
            let content: string | undefined;
            if (request.includeContent && note.filePath) {
              const workspace = yield* resolveWorkspace(note.workspaceId);
              if (workspace) {
                const absolutePath = yield* pathService.join(
                  workspace.folderPath,
                  note.filePath,
                );
                if (yield* fileStorage.exists(absolutePath)) {
                  content = (yield* fileStorage.read(absolutePath)) ?? undefined;
                }
              }
            }
            return { note, content };
          }),
      },
      listNotes: {
        execute: (request) =>
          Effect.gen(function* () {
            const workspaceId =
              request.workspaceId ??
              (yield* workspaceRepository.findActive())?.id;
            switch (request.filter ?? 'all') {
              case 'favorites': {
                const notes =
                  yield* noteRepository.findFavorites(workspaceId);
                return { notes, total: notes.length };
              }
              case 'pinned': {
                const notes = yield* noteRepository.findPinned(workspaceId);
                return { notes, total: notes.length };
              }
              case 'archived': {
                const notes =
                  yield* noteRepository.findArchived(workspaceId);
                return { notes, total: notes.length };
              }
              case 'trash': {
                const notes = yield* noteRepository.findDeleted(workspaceId);
                return { notes, total: notes.length };
              }
              default: {
                const query = {
                  workspaceId,
                  notebookId: request.notebookId,
                  isDeleted: false,
                  limit: request.limit,
                  offset: request.offset,
                  orderBy: request.orderBy,
                  orderDirection: request.orderDirection,
                };
                const [notes, total] = yield* Effect.all(
                  [
                    noteRepository.findAll(query),
                    noteRepository.count({
                      workspaceId,
                      notebookId: request.notebookId,
                      isDeleted: false,
                    }),
                  ],
                  { concurrency: 2 },
                );
                return { notes, total };
              }
            }
          }),
      },
      deleteNote: {
        execute: (request) =>
          Effect.gen(function* () {
            const noteProps = yield* requireNote(request.id);
            if (request.permanent) {
              if (noteProps.filePath) {
                const workspace =
                  yield* resolveWorkspace(noteProps.workspaceId);
                if (workspace) {
                  const absolutePath = yield* pathService.join(
                    workspace.folderPath,
                    noteProps.filePath,
                  );
                  if (yield* fileStorage.exists(absolutePath)) {
                    yield* fileStorage.delete(absolutePath);
                  }
                }
              }
              yield* noteRepository.delete(request.id);
            } else {
              const note = NoteEntity.fromPersistence(noteProps);
              note.delete();
              yield* noteRepository.save(note);
            }
            yield* publish(DOMAIN_EVENT_TYPES.NOTE_DELETED, request.id);
          }),
      },
      restoreNote: {
        execute: ({ id }) =>
          mutateNote(id, (note) => note.restore()).pipe(Effect.asVoid),
      },
      moveNote: {
        execute: ({ id, targetNotebookId }) =>
          mutateNote(id, (note) =>
            note.moveToNotebook(targetNotebookId),
          ).pipe(Effect.asVoid),
      },
      searchNotes: {
        execute: (request) =>
          Effect.gen(function* () {
            const workspaceId =
              request.workspaceId ??
              (yield* workspaceRepository.findActive())?.id;
            const notes = yield* noteRepository.searchByTitle({
              query: request.query,
              workspaceId,
              limit: request.limit,
            });
            return { notes, total: notes.length };
          }),
      },
      getNoteContent: {
        execute: ({ id }) =>
          Effect.gen(function* () {
            const note = yield* requireNote(id);
            if (!note.filePath) return { content: '' };
            const workspace = yield* resolveWorkspace(note.workspaceId);
            if (!workspace) return { content: '' };
            const absolutePath = yield* pathService.join(
              workspace.folderPath,
              note.filePath,
            );
            if (!(yield* fileStorage.exists(absolutePath))) {
              return { content: '' };
            }
            const markdown = yield* fileStorage.read(absolutePath);
            return { content: markdown ? stripFirstHeading(markdown) : '' };
          }),
      },
      saveNoteContent: {
        execute: ({ id, content }) =>
          Effect.gen(function* () {
            const note = yield* requireNote(id);
            if (!note.filePath) {
              return yield* Effect.fail(new Error('Note has no file path'));
            }
            const workspace = yield* resolveWorkspace(note.workspaceId);
            if (!workspace) {
              return yield* Effect.fail(
                new Error('Workspace not found for note'),
              );
            }
            const absolutePath = yield* pathService.join(
              workspace.folderPath,
              note.filePath,
            );
            yield* fileStorage.write(
              absolutePath,
              `# ${note.title}\n\n${content}`,
            );
          }),
      },
      getNoteByPath: {
        execute: (request) =>
          Effect.gen(function* () {
            const workspace = request.workspaceId
              ? yield* workspaceRepository.findById(request.workspaceId)
              : yield* workspaceRepository.findActive();
            const existing = yield* noteRepository.findByFilePath(
              request.filePath,
              workspace?.id,
            );
            if (existing) return { note: existing };
            if (!workspace) {
              return yield* Effect.fail(
                new NoteNotFoundError(`file:${request.filePath}`),
              );
            }
            const absolutePath = yield* pathService.join(
              workspace.folderPath,
              request.filePath,
            );
            if (!(yield* fileStorage.exists(absolutePath))) {
              return yield* Effect.fail(
                new NoteNotFoundError(
                  `file:${request.filePath} (workspace:${workspace.id})`,
                ),
              );
            }
            const [fileContent, filenameWithoutExt, config] =
              yield* Effect.all(
                [
                  fileStorage.read(absolutePath),
                  pathService.basename(request.filePath, '.md'),
                  appConfigRepository.get(),
                ],
                { concurrency: 3 },
              );
            const journalFolder =
              config.notes.locationPolicy.journalFolder;
            const isJournal = request.filePath.startsWith(
              `${journalFolder}/`,
            );
            const extractedTitle =
              !isJournal && fileContent
                ? yield* markdownProcessor.extractTitle(fileContent)
                : null;
            const note = NoteEntity.create({
              id: yield* idGenerator.generate(),
              title: isJournal
                ? filenameWithoutExt
                : extractedTitle || filenameWithoutExt,
              filePath: request.filePath,
              workspaceId: workspace.id,
            });
            yield* noteRepository.save(note);
            yield* publish(DOMAIN_EVENT_TYPES.NOTE_CREATED, note.id);
            return { note: note.toPersistence() };
          }),
      },
      toggleFavorite: {
        execute: ({ id }) => mutateNote(id, (note) => note.toggleFavorite()),
      },
      togglePin: {
        execute: ({ id }) => mutateNote(id, (note) => note.togglePinned()),
      },
      toggleArchive: {
        execute: ({ id }) =>
          mutateNote(id, (note, props) =>
            note.setArchived(!props.isArchived),
          ),
      },
    };

    function mutateNote(
      id: string,
      mutate: (note: NoteEntity, props: NoteProps) => void,
    ): Effect.Effect<{ note: NoteProps }, Error> {
      return Effect.gen(function* () {
        const props = yield* requireNote(id);
        const note = NoteEntity.fromPersistence(props);
        mutate(note, props);
        yield* noteRepository.save(note);
        yield* publish(DOMAIN_EVENT_TYPES.NOTE_UPDATED, id);
        return { note: note.toPersistence() };
      });
    }

    return service;
  }),
);
