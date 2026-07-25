import { Effect, Layer } from 'effect';
import {
  DatabaseManagerPort,
  DatabaseUseCasesPort,
  NotebookRepositoryPort,
  NoteRepositoryPort,
  TagRepositoryPort,
  type IDatabaseUseCases,
} from '../../../domain';

export const DatabaseUseCasesLive = Layer.effect(
  DatabaseUseCasesPort,
  Effect.gen(function* () {
    const database = yield* DatabaseManagerPort;
    const notes = yield* NoteRepositoryPort;
    const notebooks = yield* NotebookRepositoryPort;
    const tags = yield* TagRepositoryPort;
    const service: IDatabaseUseCases = {
      getStatus: {
        execute: () =>
          Effect.all(
            {
              raw: database.getStatus(),
              noteCount: notes.count(),
              notebookCount: notebooks.count(),
              allTags: tags.findAll(),
            },
            { concurrency: 'unbounded' },
          ).pipe(
            Effect.map(({ raw, noteCount, notebookCount, allTags }) => ({
              path: raw.path,
              databaseSize: raw.size,
              isOpen: raw.isOpen,
              noteCount,
              notebookCount,
              tagCount: allTags.length,
            })),
          ),
      },
      vacuum: {
        execute: () =>
          Effect.gen(function* () {
            const before = yield* database.getStatus();
            yield* database.vacuum();
            const after = yield* database.getStatus();
            return {
              size_before: before.size,
              size_after: after.size,
              freed_bytes: Math.max(0, before.size - after.size),
            };
          }),
      },
      checkIntegrity: {
        execute: () => database.checkIntegrity(),
      },
    };
    return service;
  }),
);
