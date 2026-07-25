import { Effect, Layer } from 'effect';
import {
  DOMAIN_EVENT_TYPES,
  EventPublisherPort,
  IdGeneratorPort,
  TagEntity,
  TagNotFoundError,
  TagRepositoryPort,
  TagUseCasesPort,
  type IEventPublisher,
  type ITagUseCases,
} from '../../../domain';

export const TagUseCasesLive = Layer.effect(
  TagUseCasesPort,
  Effect.gen(function* () {
    const repository = yield* TagRepositoryPort;
    const idGenerator = yield* IdGeneratorPort;
    const publisher = yield* EventPublisherPort;
    const publish = (type: string, payload: Record<string, unknown>) =>
      Effect.clockWith((clock) => clock.currentTimeMillis).pipe(
        Effect.flatMap((now) =>
          publisher.publish({
            type,
            timestamp: new Date(now),
            payload,
          } as Parameters<IEventPublisher['publish']>[0]),
        ),
      );
    const requireTag = (id: string) =>
      repository.findById(id).pipe(
        Effect.flatMap((tag) =>
          tag ? Effect.succeed(tag) : Effect.fail(new TagNotFoundError(id)),
        ),
      );
    const service: ITagUseCases = {
      createTag: {
        execute: (request) =>
          Effect.gen(function* () {
            const normalized = TagEntity.normalizeName(request.name);
            const existing = (yield* repository.findAll()).find(
              (tag) => tag.name === normalized,
            );
            if (existing) return { tag: existing };
            const tag = TagEntity.create({
              id: yield* idGenerator.generate(),
              name: request.name,
              color: request.color,
            });
            yield* repository.save(tag);
            yield* publish(DOMAIN_EVENT_TYPES.TAG_CREATED, {
              tag: tag.toPersistence(),
            });
            return { tag: tag.toPersistence() };
          }),
      },
      updateTag: {
        execute: (request) =>
          Effect.gen(function* () {
            const tag = TagEntity.fromPersistence(yield* requireTag(request.id));
            if (request.name !== undefined) tag.rename(request.name);
            if (request.color !== undefined) tag.changeColor(request.color);
            yield* repository.save(tag);
            yield* publish(DOMAIN_EVENT_TYPES.TAG_UPDATED, {
              tag: tag.toPersistence(),
            });
            return { tag: tag.toPersistence() };
          }),
      },
      getTag: {
        execute: ({ id }) =>
          requireTag(id).pipe(Effect.map((tag) => ({ tag }))),
      },
      listTags: {
        execute: (request) =>
          (request?.includeNoteCount
            ? repository.findAllWithCounts()
            : repository.findAll()
          ).pipe(Effect.map((tags) => ({ tags }))),
      },
      deleteTag: {
        execute: ({ id }) =>
          repository.exists(id).pipe(
            Effect.flatMap((exists) =>
              exists
                ? repository.delete(id)
                : Effect.fail(new TagNotFoundError(id)),
            ),
            Effect.tap(() =>
              publish(DOMAIN_EVENT_TYPES.TAG_DELETED, { id }),
            ),
          ),
      },
      addTagToNote: {
        execute: ({ noteId, tagId }) =>
          repository.addTagToNote(noteId, tagId),
      },
      removeTagFromNote: {
        execute: ({ noteId, tagId }) =>
          repository.removeTagFromNote(noteId, tagId),
      },
      getNoteTags: {
        execute: ({ noteId }) =>
          repository
            .findByNoteId(noteId)
            .pipe(Effect.map((tags) => ({ tags }))),
      },
    };
    return service;
  }),
);
