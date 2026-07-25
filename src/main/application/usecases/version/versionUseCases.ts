import { Effect, Layer } from 'effect';
import {
  FileStoragePort,
  NoteEntity,
  NoteRepositoryPort,
  PathServicePort,
  VersionDiffer,
  VersionEntity,
  VersionRepositoryPort,
  VersionUseCasesPort,
  WorkspaceRepositoryPort,
  type IVersionUseCases,
} from '../../../domain';

const noteMissing = (id: string) => new Error(`Note not found: ${id}`);
const workspaceMissing = (id: string) =>
  new Error(`Workspace not found: ${id}`);

export const VersionUseCasesLive = Layer.effect(
  VersionUseCasesPort,
  Effect.gen(function* () {
    const notes = yield* NoteRepositoryPort;
    const versions = yield* VersionRepositoryPort;
    const workspaces = yield* WorkspaceRepositoryPort;
    const files = yield* FileStoragePort;
    const paths = yield* PathServicePort;
    const requireNote = (id: string) =>
      notes.findById(id).pipe(
        Effect.flatMap((note) =>
          note ? Effect.succeed(note) : Effect.fail(noteMissing(id)),
        ),
      );
    const service: IVersionUseCases = {
      getVersions: {
        execute: (noteId) =>
          Effect.gen(function* () {
            yield* requireNote(noteId);
            return (yield* versions.findByNoteId(noteId)).map(
              VersionDiffer.toSnapshot,
            );
          }),
      },
      createVersion: {
        execute: (noteId) =>
          Effect.gen(function* () {
            const note = yield* requireNote(noteId);
            if (!note.filePath || !note.workspaceId) {
              return yield* Effect.fail(new Error('Note has no file path'));
            }
            const workspace = yield* workspaces.findById(note.workspaceId);
            if (!workspace) {
              return yield* Effect.fail(workspaceMissing(note.workspaceId));
            }
            const absolutePath = yield* paths.join(
              workspace.folderPath,
              note.filePath,
            );
            const [content, versionNumber] = yield* Effect.all(
              [
                files.read(absolutePath),
                versions.getNextVersionNumber(noteId),
              ],
              { concurrency: 'unbounded' },
            );
            const version = VersionEntity.create({
              id: VersionDiffer.buildVersionId(noteId, versionNumber),
              noteId,
              versionNumber,
              content: content || '',
              title: note.title || 'Untitled',
            });
            yield* versions.save(version);
            return VersionDiffer.toSnapshot(version);
          }),
      },
      restoreVersion: {
        execute: (noteId, versionId) =>
          Effect.gen(function* () {
            const note = yield* requireNote(noteId);
            const version = yield* versions.findById(versionId);
            if (!version || !VersionDiffer.belongsToNote(version, noteId)) {
              return yield* Effect.fail(
                new Error(`Version not found: ${versionId}`),
              );
            }
            if (!note.filePath || !note.workspaceId) {
              return yield* Effect.fail(new Error('Note has no file path'));
            }
            const workspace = yield* workspaces.findById(note.workspaceId);
            if (!workspace) {
              return yield* Effect.fail(workspaceMissing(note.workspaceId));
            }
            const absolutePath = yield* paths.join(
              workspace.folderPath,
              note.filePath,
            );
            yield* files.write(absolutePath, version.content);
            const entity = NoteEntity.fromPersistence(note);
            entity.updateTitle(version.title);
            yield* notes.save(entity);
          }),
      },
      getVersion: {
        execute: (versionId) =>
          versions.findById(versionId).pipe(
            Effect.map((version) =>
              version ? VersionDiffer.toSnapshot(version) : null,
            ),
          ),
      },
    };
    return service;
  }),
);
