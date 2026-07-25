import { Effect, Layer } from 'effect';
import {
  DOMAIN_EVENT_TYPES,
  EventPublisherPort,
  IdGeneratorPort,
  NotebookEntity,
  NotebookNotFoundError,
  NotebookRepositoryPort,
  NotebookUseCasesPort,
  type IEventPublisher,
  type INotebookUseCases,
} from '../../../domain';

export const NotebookUseCasesLive = Layer.effect(
  NotebookUseCasesPort,
  Effect.gen(function* () {
    const repository = yield* NotebookRepositoryPort;
    const idGenerator = yield* IdGeneratorPort;
    const publisher = yield* EventPublisherPort;
    const publish = (
      type: string,
      payload: Record<string, unknown>,
    ) =>
      Effect.clockWith((clock) => clock.currentTimeMillis).pipe(
        Effect.flatMap((now) =>
          publisher.publish({
            type,
            timestamp: new Date(now),
            payload,
          } as Parameters<IEventPublisher['publish']>[0]),
        ),
      );
    const requireNotebook = (id: string) =>
      repository.findById(id).pipe(
        Effect.flatMap((notebook) =>
          notebook
            ? Effect.succeed(notebook)
            : Effect.fail(new NotebookNotFoundError(id)),
        ),
      );
    const service: INotebookUseCases = {
      createNotebook: {
        execute: (request) =>
          Effect.gen(function* () {
            const notebook = NotebookEntity.create({
              id: yield* idGenerator.generate(),
              name: request.name,
              parentId: request.parentId,
              workspaceId: request.workspaceId,
              folderPath: request.folderPath,
              icon: request.icon,
              color: request.color,
            });
            yield* repository.save(notebook);
            yield* publish(DOMAIN_EVENT_TYPES.NOTEBOOK_CREATED, {
              notebook: notebook.toPersistence(),
            });
            return { notebook: notebook.toPersistence() };
          }),
      },
      updateNotebook: {
        execute: (request) =>
          Effect.gen(function* () {
            const notebook = NotebookEntity.fromPersistence(
              yield* requireNotebook(request.id),
            );
            if (request.name !== undefined) notebook.rename(request.name);
            if (request.parentId !== undefined) notebook.moveTo(request.parentId);
            if (request.icon !== undefined) notebook.changeIcon(request.icon);
            if (request.color !== undefined) notebook.changeColor(request.color);
            yield* repository.save(notebook);
            yield* publish(DOMAIN_EVENT_TYPES.NOTEBOOK_UPDATED, {
              notebook: notebook.toPersistence(),
            });
            return { notebook: notebook.toPersistence() };
          }),
      },
      getNotebook: {
        execute: ({ id }) =>
          requireNotebook(id).pipe(
            Effect.map((notebook) => ({ notebook })),
          ),
      },
      listNotebooks: {
        execute: (request) => {
          if (request.includeNoteCount) {
            return repository
              .findAllWithCounts(request.workspaceId)
              .pipe(Effect.map((notebooks) => ({ notebooks })));
          }
          const load =
            request.parentId !== undefined
              ? repository.findByParentId(
                  request.parentId,
                  request.workspaceId,
                )
              : request.workspaceId
                ? repository.findByWorkspaceId(request.workspaceId)
                : repository.findAll();
          return load.pipe(Effect.map((notebooks) => ({ notebooks })));
        },
      },
      deleteNotebook: {
        execute: ({ id }) =>
          repository.exists(id).pipe(
            Effect.flatMap((exists) =>
              exists
                ? repository.delete(id)
                : Effect.fail(new NotebookNotFoundError(id)),
            ),
            Effect.tap(() =>
              publish(DOMAIN_EVENT_TYPES.NOTEBOOK_DELETED, { id }),
            ),
          ),
      },
      moveNotebook: {
        execute: ({ id, targetParentId }) =>
          Effect.gen(function* () {
            const notebook = NotebookEntity.fromPersistence(
              yield* requireNotebook(id),
            );
            notebook.moveTo(targetParentId);
            yield* repository.save(notebook);
            yield* publish(DOMAIN_EVENT_TYPES.NOTEBOOK_UPDATED, {
              notebook: notebook.toPersistence(),
            });
          }),
      },
    };
    return service;
  }),
);
