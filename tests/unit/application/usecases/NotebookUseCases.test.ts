import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Cause, Effect, Exit, Layer, ManagedRuntime } from 'effect';
import { NotebookUseCasesLive } from '../../../../src/main/application/usecases/notebook';
import {
  EventPublisherPort,
  IdGeneratorPort,
  NotebookNotFoundError,
  NotebookRepositoryPort,
  NotebookUseCasesPort,
  type INotebookUseCases,
  type NotebookProps,
} from '../../../../src/main/domain';
import type { IEventPublisher } from '../../../../src/main/domain/ports/out/IEventPublisher';
import type { INotebookRepository } from '../../../../src/main/domain/ports/out/INotebookRepository';
import { adapterLayer } from '../../../helpers/adapterLayer';
import { createMockIdGenerator } from './testDoubles';

type PromiseFacade<T> = T extends (
  ...args: infer Args
) => Effect.Effect<infer Success, unknown, unknown>
  ? (...args: Args) => Promise<Success>
  : T extends object
    ? { [Key in keyof T]: PromiseFacade<T[Key]> }
    : T;

function notebook(overrides: Partial<NotebookProps> = {}): NotebookProps {
  return {
    id: 'nb-1',
    name: 'Notebook',
    parentId: null,
    workspaceId: 'ws-1',
    folderPath: null,
    icon: '📁',
    color: '#3b82f6',
    position: 0,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-02'),
    ...overrides,
  };
}

describe('NotebookUseCases', () => {
  let repository: INotebookRepository;
  let publisher: IEventPublisher;
  let useCases: PromiseFacade<INotebookUseCases>;

  beforeEach(() => {
    repository = {
      findById: vi.fn(),
      findAll: vi.fn(async () => []),
      findAllWithCounts: vi.fn(async () => []),
      findByWorkspaceId: vi.fn(async () => []),
      findByParentId: vi.fn(async () => []),
      save: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
    } as unknown as INotebookRepository;
    publisher = { publish: vi.fn() } as unknown as IEventPublisher;
    const runtime = ManagedRuntime.make(
      NotebookUseCasesLive.pipe(
        Layer.provide(
          Layer.mergeAll(
            adapterLayer(NotebookRepositoryPort, repository),
            adapterLayer(IdGeneratorPort, createMockIdGenerator()),
            adapterLayer(EventPublisherPort, publisher),
          ),
        ),
      ),
    );
    const run = <A, E>(
      use: (service: INotebookUseCases) => Effect.Effect<A, E>,
    ) =>
      runtime
        .runPromiseExit(
          NotebookUseCasesPort.pipe(
            Effect.flatMap((service) => use(service)),
          ),
        )
        .then((exit) => {
          if (Exit.isSuccess(exit)) return exit.value;
          throw Cause.squash(exit.cause);
        });
    useCases = {
      createNotebook: {
        execute: (request) =>
          run((service) => service.createNotebook.execute(request)),
      },
      updateNotebook: {
        execute: (request) =>
          run((service) => service.updateNotebook.execute(request)),
      },
      getNotebook: {
        execute: (request) =>
          run((service) => service.getNotebook.execute(request)),
      },
      listNotebooks: {
        execute: (request) =>
          run((service) => service.listNotebooks.execute(request)),
      },
      deleteNotebook: {
        execute: (request) =>
          run((service) => service.deleteNotebook.execute(request)),
      },
      moveNotebook: {
        execute: (request) =>
          run((service) => service.moveNotebook.execute(request)),
      },
    };
  });

  it('creates a notebook with all optional fields and publishes it', async () => {
    const result = await useCases.createNotebook.execute({
      name: 'Projects',
      parentId: 'root',
      workspaceId: 'ws-1',
      folderPath: 'Projects',
      icon: 'folder',
      color: 'blue',
    });
    expect(result.notebook).toMatchObject({
      name: 'Projects',
      parentId: 'root',
      workspaceId: 'ws-1',
      folderPath: 'Projects',
      icon: 'folder',
      color: 'blue',
    });
    expect(repository.save).toHaveBeenCalled();
    expect(publisher.publish).toHaveBeenCalled();
  });

  it('updates notebook properties and moves it', async () => {
    vi.mocked(repository.findById).mockResolvedValue(notebook());
    const updated = await useCases.updateNotebook.execute({
      id: 'nb-1',
      name: 'Renamed',
      icon: 'book',
      color: '#ff0000',
      parentId: 'parent',
    });
    expect(updated.notebook).toMatchObject({
      name: 'Renamed',
      icon: 'book',
      color: '#ff0000',
      parentId: 'parent',
    });
    await useCases.moveNotebook.execute({
      id: 'nb-1',
      targetParentId: null,
    });
    expect(repository.save).toHaveBeenCalledTimes(2);
  });

  it('loads a notebook and preserves typed missing failures', async () => {
    vi.mocked(repository.findById)
      .mockResolvedValueOnce(notebook())
      .mockResolvedValueOnce(null);
    await expect(
      useCases.getNotebook.execute({ id: 'nb-1' }),
    ).resolves.toEqual({ notebook: notebook() });
    await expect(
      useCases.getNotebook.execute({ id: 'missing' }),
    ).rejects.toBeInstanceOf(NotebookNotFoundError);
  });

  it('selects list repository methods from the requested shape', async () => {
    vi.mocked(repository.findByParentId).mockResolvedValue([notebook()]);
    await expect(
      useCases.listNotebooks.execute({
        parentId: null,
        workspaceId: 'ws-1',
      }),
    ).resolves.toEqual({ notebooks: [notebook()] });
    expect(repository.findByParentId).toHaveBeenCalledWith(null, 'ws-1');

    await useCases.listNotebooks.execute({
      workspaceId: 'ws-1',
      includeNoteCount: true,
    });
    expect(repository.findAllWithCounts).toHaveBeenCalledWith('ws-1');
  });

  it('deletes existing notebooks and rejects missing ones', async () => {
    vi.mocked(repository.exists)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    await useCases.deleteNotebook.execute({ id: 'nb-1' });
    expect(repository.delete).toHaveBeenCalledWith('nb-1');
    await expect(
      useCases.deleteNotebook.execute({ id: 'missing' }),
    ).rejects.toBeInstanceOf(NotebookNotFoundError);
  });
});
