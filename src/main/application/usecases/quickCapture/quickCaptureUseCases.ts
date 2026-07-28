import { Effect, Layer } from 'effect';
import {
  AppConfigRepositoryPort,
  DOMAIN_EVENT_TYPES,
  EventPublisherPort,
  FileStoragePort,
  IdGeneratorPort,
  NoteEntity,
  NoteRepositoryPort,
  NoteValidationError,
  PathServicePort,
  QuickCaptureUseCasesPort,
  TranscriberPort,
  WorkspaceNotFoundError,
  WorkspaceRepositoryPort,
  type IEventPublisher,
  type IQuickCaptureUseCases,
} from '../../../domain';

const CAPTURES_DIR = '.stone/recordings';

function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export const QuickCaptureUseCasesLive = Layer.effect(
  QuickCaptureUseCasesPort,
  Effect.gen(function* () {
    const notes = yield* NoteRepositoryPort;
    const workspaces = yield* WorkspaceRepositoryPort;
    const files = yield* FileStoragePort;
    const configRepository = yield* AppConfigRepositoryPort;
    const ids = yield* IdGeneratorPort;
    const paths = yield* PathServicePort;
    const transcriber = yield* TranscriberPort;
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
    const publish = (
      type: string,
      timestamp: Date,
      id: string,
      journalDate: string,
    ) =>
      publisher.publish({
        type,
        timestamp,
        payload: { id, journalDate },
      } as Parameters<IEventPublisher['publish']>[0]);
    const service: IQuickCaptureUseCases = {
      appendToJournal: (content, workspaceId) =>
        Effect.gen(function* () {
          // A journal entry has to say something. Without this an empty or
          // whitespace-only capture wrote a bare "[10:42]" into the day's note
          // — and a capture endpoint reachable from a phone will be called by
          // stray taps and retries, so the guard belongs here rather than in
          // whichever UI happens to be in front of it.
          const entryText = content.trim();
          if (!entryText) {
            return yield* Effect.fail(
              new NoteValidationError('Cannot capture an empty entry.'),
            );
          }

          const workspace = yield* resolveWorkspace(workspaceId);
          const config = yield* configRepository.get();
          const folder = config.notes.locationPolicy.journalFolder;
          const millis = yield* Effect.clockWith(
            (clock) => clock.currentTimeMillis,
          );
          const now = new Date(millis);
          const date = localDate(now);
          const relativePath = `${folder}/${date}.md`;
          const existing = yield* notes.findByFilePath(
            relativePath,
            workspace.id,
          );
          const timestamp = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
          const entry = `\n\n[${timestamp}] ${entryText}`;
          const absolutePath = yield* paths.join(
            workspace.folderPath,
            relativePath,
          );
          if (existing) {
            // The index can outlive the file it points at: a branch switch, a
            // pull, or a manual delete removes the markdown while the note row
            // survives. Reading blind turned that into a 500 and dropped the
            // capture. Markdown is the source of truth, so rebuild the day's
            // file around the entry rather than refusing to record it.
            const present = yield* files.exists(absolutePath);
            const current = present ? (yield* files.read(absolutePath)) || '' : `# ${date}`;
            yield* files.write(absolutePath, current + entry);
            yield* notes.save(NoteEntity.fromPersistence(existing));
            yield* publish(
              DOMAIN_EVENT_TYPES.NOTE_UPDATED,
              now,
              existing.id,
              date,
            );
            return { noteId: existing.id, appended: true };
          }
          const fileExists = yield* files.exists(absolutePath);
          const note = NoteEntity.create({
            id: yield* ids.generate(),
            title: date,
            workspaceId: workspace.id,
          });
          if (fileExists) {
            const current = (yield* files.read(absolutePath)) || '';
            yield* files.write(absolutePath, current + entry);
          } else {
            const directory = yield* paths.join(
              workspace.folderPath,
              folder,
            );
            yield* files.createDirectory(directory);
            yield* files.write(absolutePath, `# ${date}${entry}`);
          }
          note.updateFilePath(relativePath);
          yield* notes.save(note);
          yield* publish(
            fileExists
              ? DOMAIN_EVENT_TYPES.NOTE_UPDATED
              : DOMAIN_EVENT_TYPES.NOTE_CREATED,
            now,
            note.id,
            date,
          );
          return { noteId: note.id, appended: Boolean(fileExists) };
        }),
      transcribeVoiceCapture: (request) =>
        Effect.gen(function* () {
          const workspace = yield* (
            request.workspaceId
              ? workspaces.findById(request.workspaceId)
              : workspaces.findActive()
          );
          if (!workspace) {
            return yield* Effect.fail(
              new WorkspaceNotFoundError(
                request.workspaceId ?? 'active',
              ),
            );
          }
          const directory = yield* paths.join(
            workspace.folderPath,
            CAPTURES_DIR,
          );
          const audioPath = yield* paths.join(
            directory,
            `capture-${yield* ids.generate()}.wav`,
          );
          yield* files.createDirectory(directory);
          yield* files.writeBytes(audioPath, request.wav);
          return yield* transcriber
            .transcribe({ audioPath })
            .pipe(
              Effect.map((result) => ({
                text: result.text.trim(),
                durationMs: result.durationMs,
              })),
              Effect.ensuring(
                files.delete(audioPath).pipe(Effect.catchAll(() => Effect.void)),
              ),
            );
        }),
    };
    return service;
  }),
);
