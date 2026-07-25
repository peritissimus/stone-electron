import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Cause, Effect, Exit, Layer, ManagedRuntime } from 'effect';
import { DatabaseUseCasesLive } from '../../../../src/main/application/usecases/database';
import {
  DatabaseManagerPort,
  DatabaseUseCasesPort,
  NotebookRepositoryPort,
  NoteRepositoryPort,
  TagRepositoryPort,
  type IDatabaseUseCases,
} from '../../../../src/main/domain';
import type { IDatabaseManager } from '../../../../src/main/domain/ports/out/IDatabaseManager';
import type { INoteRepository } from '../../../../src/main/domain/ports/out/INoteRepository';
import type { INotebookRepository } from '../../../../src/main/domain/ports/out/INotebookRepository';
import type { ITagRepository } from '../../../../src/main/domain/ports/out/ITagRepository';
import { adapterLayer } from '../../../helpers/adapterLayer';

type PromiseFacade<T> = T extends (
  ...args: infer Args
) => Effect.Effect<infer Success, unknown, unknown>
  ? (...args: Args) => Promise<Success>
  : T extends object
    ? { [Key in keyof T]: PromiseFacade<T[Key]> }
    : T;

describe('DatabaseUseCases', () => {
  let database: IDatabaseManager;
  let notes: INoteRepository;
  let notebooks: INotebookRepository;
  let tags: ITagRepository;
  let useCases: PromiseFacade<IDatabaseUseCases>;

  beforeEach(() => {
    database = {
      getStatus: vi.fn(),
      vacuum: vi.fn(),
      checkIntegrity: vi.fn(),
    };
    notes = { count: vi.fn(async () => 0) } as unknown as INoteRepository;
    notebooks = {
      count: vi.fn(async () => 0),
    } as unknown as INotebookRepository;
    tags = {
      findAll: vi.fn(async () => []),
    } as unknown as ITagRepository;
    const runtime = ManagedRuntime.make(
      DatabaseUseCasesLive.pipe(
        Layer.provide(
          Layer.mergeAll(
            adapterLayer(DatabaseManagerPort, database),
            adapterLayer(NoteRepositoryPort, notes),
            adapterLayer(NotebookRepositoryPort, notebooks),
            adapterLayer(TagRepositoryPort, tags),
          ),
        ),
      ),
    );
    const run = <A, E>(
      use: (service: IDatabaseUseCases) => Effect.Effect<A, E>,
    ) =>
      runtime
        .runPromiseExit(
          DatabaseUseCasesPort.pipe(
            Effect.flatMap((service) => use(service)),
          ),
        )
        .then((exit) => {
          if (Exit.isSuccess(exit)) return exit.value;
          throw Cause.squash(exit.cause);
        });
    useCases = {
      getStatus: {
        execute: () => run((service) => service.getStatus.execute()),
      },
      vacuum: {
        execute: () => run((service) => service.vacuum.execute()),
      },
      checkIntegrity: {
        execute: () => run((service) => service.checkIntegrity.execute()),
      },
    };
  });

  it('returns database status enriched with entity counts', async () => {
    vi.mocked(database.getStatus).mockResolvedValue({
      path: '/path/to/db.sqlite',
      size: 1_024_000,
      isOpen: true,
    });
    vi.mocked(notes.count).mockResolvedValue(42);
    vi.mocked(notebooks.count).mockResolvedValue(7);
    vi.mocked(tags.findAll).mockResolvedValue([
      { id: 't1' },
      { id: 't2' },
      { id: 't3' },
    ] as never);

    await expect(useCases.getStatus.execute()).resolves.toEqual({
      path: '/path/to/db.sqlite',
      databaseSize: 1_024_000,
      isOpen: true,
      noteCount: 42,
      notebookCount: 7,
      tagCount: 3,
    });
  });

  it('reports a closed database', async () => {
    vi.mocked(database.getStatus).mockResolvedValue({
      path: '/path/to/db.sqlite',
      size: 0,
      isOpen: false,
    });
    await expect(useCases.getStatus.execute()).resolves.toMatchObject({
      isOpen: false,
    });
  });

  it('vacuums the database and reports freed bytes', async () => {
    vi.mocked(database.getStatus)
      .mockResolvedValueOnce({ path: '/db', size: 2_048_000, isOpen: true })
      .mockResolvedValueOnce({ path: '/db', size: 1_024_000, isOpen: true });
    await expect(useCases.vacuum.execute()).resolves.toEqual({
      size_before: 2_048_000,
      size_after: 1_024_000,
      freed_bytes: 1_024_000,
    });
    expect(database.vacuum).toHaveBeenCalled();
  });

  it('returns database integrity failures unchanged', async () => {
    const errors = [
      'Table notes has orphaned rows',
      'Index idx_notes corrupted',
    ];
    vi.mocked(database.checkIntegrity).mockResolvedValue({
      ok: false,
      errors,
    });
    await expect(useCases.checkIntegrity.execute()).resolves.toEqual({
      ok: false,
      errors,
    });
  });
});
