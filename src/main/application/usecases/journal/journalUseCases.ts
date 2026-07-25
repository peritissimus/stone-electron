import { Effect, Layer } from 'effect';
import {
  AppConfigRepositoryPort,
  DOMAIN_EVENT_TYPES,
  EventPublisherPort,
  FileStoragePort,
  IdGeneratorPort,
  JournalReaderPort,
  JournalUseCasesPort,
  NoteEntity,
  NoteRepositoryPort,
  PathServicePort,
  WorkspaceRepositoryPort,
  addCalendarDays,
  formatJournalDate,
  parseJournalDate,
  stripFirstHeading,
  type IEventPublisher,
  type IJournalUseCases,
} from '../../../domain';

const MAX_LIMIT = 31;

export const JournalUseCasesLive = Layer.effect(
  JournalUseCasesPort,
  Effect.gen(function* () {
    const notes = yield* NoteRepositoryPort;
    const reader = yield* JournalReaderPort;
    const workspaces = yield* WorkspaceRepositoryPort;
    const files = yield* FileStoragePort;
    const configRepository = yield* AppConfigRepositoryPort;
    const ids = yield* IdGeneratorPort;
    const paths = yield* PathServicePort;
    const publisher = yield* EventPublisherPort;
    const resolveWorkspace = (workspaceId?: string) =>
      (workspaceId
        ? workspaces.findById(workspaceId)
        : workspaces.findActive()
      ).pipe(
        Effect.flatMap((workspace) =>
          workspace
            ? Effect.succeed(workspace)
            : Effect.fail(new Error('No active workspace')),
        ),
      );
    const service: IJournalUseCases = {
      openOrCreateForDate: (request) =>
        Effect.gen(function* () {
          const workspace = yield* resolveWorkspace(request.workspaceId);
          const config = yield* configRepository.get();
          const folder = config.notes.locationPolicy.journalFolder;
          const date = yield* Effect.try({
            try: () => parseJournalDate(request.date),
            catch: (error) =>
              error instanceof Error ? error : new Error(String(error)),
          });
          const dateString = formatJournalDate(date);
          const relativePath = `${folder}/${dateString}.md`;
          const existing = yield* notes.findByFilePath(
            relativePath,
            workspace.id,
          );
          if (existing) {
            return { noteId: existing.id, created: false };
          }
          const absolutePath = yield* paths.join(
            workspace.folderPath,
            relativePath,
          );
          const fileExists = yield* files.exists(absolutePath);
          if (!fileExists) {
            const directory = yield* paths.join(
              workspace.folderPath,
              folder,
            );
            yield* files.createDirectory(directory);
            yield* files.write(absolutePath, `# ${dateString}\n\n`);
          }
          const note = NoteEntity.create({
            id: yield* ids.generate(),
            title: dateString,
            workspaceId: workspace.id,
          });
          note.updateFilePath(relativePath);
          yield* notes.save(note);
          const now = yield* Effect.clockWith(
            (clock) => clock.currentTimeMillis,
          );
          yield* publisher.publish({
            type: DOMAIN_EVENT_TYPES.NOTE_CREATED,
            timestamp: new Date(now),
            payload: { id: note.id, journalDate: dateString },
          } as Parameters<IEventPublisher['publish']>[0]);
          return { noteId: note.id, created: !fileExists };
        }),
      listRange: (request) =>
        Effect.gen(function* () {
          const workspace = yield* resolveWorkspace(request.workspaceId);
          const config = yield* configRepository.get();
          const folder = config.notes.locationPolicy.journalFolder;
          const limit = Math.min(Math.max(request.limit, 1), MAX_LIMIT);
          const now = yield* Effect.clockWith(
            (clock) => clock.currentTimeMillis,
          );
          const today = new Date(now);
          const dates = Array.from({ length: limit }, (_, offset) =>
            formatJournalDate(addCalendarDays(today, -offset)),
          );
          const records = yield* reader.findRecent({
            workspaceId: workspace.id,
            workspaceFolderPath: workspace.folderPath,
            journalFolder: folder,
            oldestDate: dates[dates.length - 1],
            newestDate: dates[0],
          });
          const byDate = new Map(
            records.map((record) => [record.date, record]),
          );
          const entries = yield* Effect.forEach(
            dates,
            (date) =>
              Effect.gen(function* () {
                const record = byDate.get(date);
                const relativePath = `${folder}/${date}.md`;
                const absolutePath = yield* paths.join(
                  workspace.folderPath,
                  relativePath,
                );
                const exists =
                  Boolean(record) || (yield* files.exists(absolutePath));
                const diskContent =
                  record?.content ??
                  (exists ? yield* files.read(absolutePath) : null);
                return {
                  date,
                  noteId: record?.noteId ?? null,
                  exists,
                  content:
                    diskContent != null
                      ? stripFirstHeading(diskContent)
                      : null,
                };
              }),
            { concurrency: 'unbounded' },
          );
          return { entries };
        }),
    };
    return service;
  }),
);
