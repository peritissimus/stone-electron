import { Effect, Layer } from 'effect';
import {
  FileStoragePort,
  NoteEntity,
  NoteRepositoryPort,
  PathServicePort,
  TaskExtractor,
  TaskUseCasesPort,
  WorkspaceRepositoryPort,
  type ITaskUseCases,
  type NoteProps,
  type TaskItem,
  type TaskState,
} from '../../../domain';

function taskItems(note: NoteProps, markdown: string): TaskItem[] {
  return TaskExtractor.extractTasks(markdown).map((task) => ({
    id: `${note.id}-${task.index}`,
    noteId: note.id,
    noteTitle: note.title,
    notePath: note.filePath,
    text: task.text,
    state: task.state,
    checked: task.checked,
    lineNumber: task.lineNumber,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  }));
}

export const TaskUseCasesLive = Layer.effect(
  TaskUseCasesPort,
  Effect.gen(function* () {
    const notes = yield* NoteRepositoryPort;
    const workspaces = yield* WorkspaceRepositoryPort;
    const files = yield* FileStoragePort;
    const paths = yield* PathServicePort;
    const requireNote = (id: string) =>
      notes.findById(id).pipe(
        Effect.flatMap((note) =>
          note
            ? Effect.succeed(note)
            : Effect.fail(new Error(`Note not found: ${id}`)),
        ),
      );
    const getNoteTasks = (noteId: string) =>
      Effect.gen(function* () {
        const note = yield* requireNote(noteId);
        if (!note.filePath || !note.workspaceId) return [];
        const workspace = yield* workspaces.findById(note.workspaceId);
        if (!workspace) {
          return yield* Effect.fail(
            new Error(`Workspace not found: ${note.workspaceId}`),
          );
        }
        const absolutePath = yield* paths.join(
          workspace.folderPath,
          note.filePath,
        );
        const markdown = yield* files.read(absolutePath);
        return markdown ? taskItems(note, markdown) : [];
      });
    const updateTaskState = (
      noteId: string,
      taskIndex: number,
      state: TaskState,
    ) =>
      Effect.gen(function* () {
        const note = yield* requireNote(noteId);
        if (!note.filePath || !note.workspaceId) {
          return yield* Effect.fail(new Error('Note has no file path'));
        }
        const workspace = yield* workspaces.findById(note.workspaceId);
        if (!workspace) {
          return yield* Effect.fail(
            new Error(`Workspace not found: ${note.workspaceId}`),
          );
        }
        const absolutePath = yield* paths.join(
          workspace.folderPath,
          note.filePath,
        );
        const markdown = yield* files.read(absolutePath);
        if (!markdown) {
          return yield* Effect.fail(
            new Error('Could not read note content'),
          );
        }
        const updated = TaskExtractor.replaceTaskState(
          markdown,
          taskIndex,
          state,
        );
        const content =
          `# ${note.title}\n\n` + updated.replace(/^#\s+.*\n\n?/, '');
        yield* files.write(absolutePath, content);
        yield* notes.save(NoteEntity.fromPersistence(note));
      });
    const service: ITaskUseCases = {
      getAllTasks: {
        execute: () =>
          Effect.gen(function* () {
            const workspace = yield* workspaces.findActive();
            if (!workspace) return [];
            const allNotes = yield* notes.findAll({
              workspaceId: workspace.id,
              isDeleted: false,
            });
            const nested = yield* Effect.forEach(
              allNotes,
              (note) => {
                if (!note.filePath || !note.workspaceId) {
                  return Effect.succeed([]);
                }
                return Effect.gen(function* () {
                  const owner = yield* workspaces.findById(note.workspaceId!);
                  if (!owner) return [];
                  const path = yield* paths.join(
                    owner.folderPath,
                    note.filePath!,
                  );
                  const markdown = yield* files.read(path);
                  return markdown ? taskItems(note, markdown) : [];
                }).pipe(Effect.catchAll(() => Effect.succeed([])));
              },
              { concurrency: 'unbounded' },
            );
            return nested.flat();
          }),
      },
      getNoteTasks: { execute: getNoteTasks },
      updateTaskState: { execute: updateTaskState },
      toggleTask: {
        execute: (noteId, taskIndex) =>
          Effect.gen(function* () {
            const tasks = yield* getNoteTasks(noteId);
            const task = tasks.find(
              (candidate) => candidate.id === `${noteId}-${taskIndex}`,
            );
            if (!task) {
              return yield* Effect.fail(
                new Error(`Task at index ${taskIndex} not found`),
              );
            }
            yield* updateTaskState(
              noteId,
              taskIndex,
              task.state === 'done' ? 'todo' : 'done',
            );
          }),
      },
    };
    return service;
  }),
);
