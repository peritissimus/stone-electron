import { Effect, Layer } from 'effect';
import {
  AppConfigRepositoryPort,
  DOMAIN_EVENT_TYPES,
  EmbedderPort,
  EventPublisherPort,
  IdGeneratorPort,
  IndexRepositoryPort,
  IndexUseCasesPort,
  NoteRepositoryPort,
  SimilarityCalculator,
  TopicClassifier,
  TopicEntity,
  TopicRepositoryPort,
  TopicSuggester,
  TopicUseCasesPort,
  WorkspaceRepositoryPort,
  type ClassifyResult,
  type ITopicUseCases,
  type NoteForTopic,
  type SuggestedTopic,
  type SuggesterChunk,
  type TopicCandidate,
  type TopicDTO,
} from '../../../domain';

const DEFAULT_COLOR = '#6366f1';

function decodeCentroid(centroid: Uint8Array): number[] {
  return Array.from(
    new Float32Array(
      centroid.buffer,
      centroid.byteOffset,
      centroid.byteLength / 4,
    ),
  );
}

export const TopicUseCasesLive = Layer.effect(
  TopicUseCasesPort,
  Effect.gen(function* () {
    const notes = yield* NoteRepositoryPort;
    const topics = yield* TopicRepositoryPort;
    const workspaces = yield* WorkspaceRepositoryPort;
    const configs = yield* AppConfigRepositoryPort;
    const embedder = yield* EmbedderPort;
    const ids = yield* IdGeneratorPort;
    const index = yield* IndexRepositoryPort;
    const indexUseCases = yield* IndexUseCasesPort;
    const publisher = yield* EventPublisherPort;

    const publish = (
      type: (typeof DOMAIN_EVENT_TYPES)[keyof typeof DOMAIN_EVENT_TYPES],
      payload: unknown,
    ) =>
      Effect.clockWith((clock) => clock.currentTimeMillis).pipe(
        Effect.flatMap((now) =>
          publisher.publish({ type, timestamp: new Date(now), payload } as never),
        ),
      );

    const toDTO = (
      topic: {
        id: string;
        name: string;
        description: string | null;
        color: string;
        isPredefined: boolean;
        createdAt: Date;
        updatedAt: Date;
      },
      noteCount: number,
    ): TopicDTO => ({
      id: topic.id,
      name: topic.name,
      description: topic.description,
      color: topic.color,
      isPredefined: topic.isPredefined,
      noteCount,
      createdAt: topic.createdAt,
      updatedAt: topic.updatedAt,
    });

    const createTopic: ITopicUseCases['createTopic']['execute'] = (data) =>
      Effect.gen(function* () {
        const topic = TopicEntity.create({
          id: yield* ids.generate(),
          name: data.name,
          description: data.description || '',
          color: data.color || DEFAULT_COLOR,
          isPredefined: false,
        });
        yield* topics.save(topic);
        yield* publish(DOMAIN_EVENT_TYPES.TOPIC_CREATED, {
          topic: topic.toPersistence(),
        });
        return toDTO(topic, 0);
      });

    const assignTopic: ITopicUseCases['assignTopicToNote']['execute'] = (
      noteId,
      topicId,
    ) =>
      topics
        .assignToNote(noteId, topicId, {
          confidence: 1,
          isManual: true,
        })
        .pipe(
          Effect.zipRight(
            publish(DOMAIN_EVENT_TYPES.NOTE_CLASSIFIED, {
              noteId,
              topicId,
              confidence: 1,
              isManual: true,
            }),
          ),
        );

    const recomputeCentroids: ITopicUseCases['recomputeCentroids']['execute'] =
      () =>
        topics.findAll().pipe(
          Effect.flatMap((allTopics) =>
            Effect.forEach(
              allTopics,
              (topic) =>
                topics.getNotesForTopic(topic.id).pipe(
                  Effect.flatMap((members) =>
                    Effect.forEach(
                      members,
                      ({ noteId }) => index.getNoteVector(noteId),
                      { concurrency: 'unbounded' },
                    ),
                  ),
                  Effect.flatMap((vectors) => {
                    const present = vectors.filter(
                      (vector): vector is number[] => vector !== null,
                    );
                    if (!present.length) return Effect.void;
                    const centroid =
                      SimilarityCalculator.calculateCentroid(present);
                    return topics.updateCentroid(
                      topic.id,
                      new Uint8Array(new Float32Array(centroid).buffer),
                    );
                  }),
                ),
              { concurrency: 1, discard: true },
            ),
          ),
        );

    const classifyNote: ITopicUseCases['classifyNote']['execute'] = (
      noteId,
      force = false,
    ) =>
      Effect.gen(function* () {
        const note = yield* notes.findById(noteId);
        if (!note) return yield* Effect.fail(new Error(`Note not found: ${noteId}`));
        if (!note.filePath || !note.workspaceId) {
          return { noteId, topics: [] };
        }
        const indexed = yield* indexUseCases.indexNote.execute({
          noteId,
          force,
        });
        if (indexed.status === 'failed' || indexed.status === 'missing') {
          return { noteId, topics: [] };
        }
        const embedding = yield* index.getNoteVector(noteId);
        if (!embedding) return { noteId, topics: [] };
        const allTopics = yield* topics.findAll();
        const candidates: TopicCandidate[] = allTopics
          .filter(
            (topic): topic is typeof topic & { centroid: Uint8Array } =>
              topic.centroid !== null,
          )
          .map((topic) => ({
            topicId: topic.id,
            topicName: topic.name,
            centroid: decodeCentroid(topic.centroid),
          }));
        const matched = TopicClassifier.classify(embedding, candidates);
        yield* topics.clearAutoTopicsForNote(noteId);
        yield* Effect.forEach(
          matched,
          (match) =>
            topics
              .assignToNote(noteId, match.topicId, {
                confidence: match.confidence,
              })
              .pipe(
                Effect.zipRight(
                  publish(DOMAIN_EVENT_TYPES.NOTE_CLASSIFIED, {
                    noteId,
                    topicId: match.topicId,
                    confidence: match.confidence,
                  }),
                ),
              ),
          { concurrency: 1, discard: true },
        );
        return { noteId, topics: matched } satisfies ClassifyResult;
      });

    const service: ITopicUseCases = {
      initialize: {
        execute: () =>
          embedder.initialize().pipe(
            Effect.flatMap(() => embedder.isReady()),
            Effect.tap((ready) =>
              ready
                ? topics.findAll().pipe(
                    Effect.flatMap((allTopics) => {
                      const seedable = allTopics.filter(
                        (topic) => topic.centroid === null,
                      );
                      if (!seedable.length) return Effect.void;
                      return embedder
                        .generateEmbeddings(
                          seedable.map((topic) =>
                            topic.description
                              ? `${topic.name}. ${topic.description}`
                              : topic.name,
                          ),
                        )
                        .pipe(
                          Effect.flatMap((embeddings) =>
                            Effect.forEach(
                              seedable,
                              (topic, position) => {
                                const embedding = embeddings[position];
                                const buffer = embedding.buffer.slice(
                                  embedding.byteOffset,
                                  embedding.byteOffset + embedding.byteLength,
                                );
                                return topics.updateCentroid(
                                  topic.id,
                                  new Uint8Array(buffer),
                                );
                              },
                              { concurrency: 1, discard: true },
                            ),
                          ),
                        );
                    }),
                  )
                : Effect.void,
            ),
            Effect.map((ready) => ({ success: true, ready })),
            Effect.catchAll(() =>
              Effect.succeed({ success: false, ready: false }),
            ),
          ),
      },
      getAllTopics: {
        execute: () =>
          topics.findAllWithCounts().pipe(
            Effect.map((items) =>
              items.map((topic) => toDTO(topic, topic.noteCount)),
            ),
          ),
      },
      getTopicById: {
        execute: (id) =>
          topics.findById(id).pipe(
            Effect.flatMap((topic) =>
              topic
                ? topics
                    .getNotesForTopic(id)
                    .pipe(
                      Effect.map((members) => toDTO(topic, members.length)),
                    )
                : Effect.succeed(null),
            ),
          ),
      },
      createTopic: { execute: createTopic },
      updateTopic: {
        execute: (id, data) =>
          topics.findById(id).pipe(
            Effect.flatMap((props) =>
              props
                ? Effect.sync(() => {
                    const topic = TopicEntity.fromPersistence(props);
                    if (data.name) topic.rename(data.name);
                    if (data.description !== undefined) {
                      topic.updateDescription(data.description);
                    }
                    if (data.color) topic.changeColor(data.color);
                    return topic;
                  })
                : Effect.fail(new Error(`Topic not found: ${id}`)),
            ),
            Effect.tap((topic) => topics.save(topic)),
            Effect.tap((topic) =>
              publish(DOMAIN_EVENT_TYPES.TOPIC_UPDATED, {
                topic: topic.toPersistence(),
              }),
            ),
            Effect.flatMap((topic) =>
              topics
                .getNotesForTopic(id)
                .pipe(
                  Effect.map((members) => toDTO(topic, members.length)),
                ),
            ),
          ),
      },
      deleteTopic: {
        execute: (id) =>
          topics.findById(id).pipe(
            Effect.flatMap((topic) => {
              if (!topic) return Effect.fail(new Error(`Topic not found: ${id}`));
              if (topic.isPredefined) {
                return Effect.fail(new Error('Cannot delete predefined topics'));
              }
              return topics
                .delete(id)
                .pipe(
                  Effect.zipRight(
                    publish(DOMAIN_EVENT_TYPES.TOPIC_DELETED, { id }),
                  ),
                );
            }),
          ),
      },
      classifyNote: { execute: classifyNote },
      classifyAllNotes: {
        execute: (options) =>
          Effect.gen(function* () {
            const workspace = yield* workspaces.findActive();
            if (!workspace) return { processed: 0, total: 0, failed: 0 };
            const allNotes = yield* notes.findAll({
              workspaceId: workspace.id,
              isDeleted: false,
            });
            let selected = allNotes;
            if (options?.excludeJournal) {
              const config = yield* configs.get();
              const prefix = `${config.notes.locationPolicy.journalFolder}/`;
              const isJournal = (path: string | null | undefined) =>
                path?.startsWith(prefix) ?? false;
              selected = allNotes.filter((note) => !isJournal(note.filePath));
              yield* Effect.forEach(
                allNotes.filter((note) => isJournal(note.filePath)),
                (note) => topics.clearTopicsForNote(note.id),
                { concurrency: 1, discard: true },
              );
            }
            let processed = 0;
            let failed = 0;
            for (const note of selected) {
              const succeeded = yield* classifyNote(
                note.id,
                options?.force || false,
              ).pipe(
                Effect.as(true),
                Effect.catchAll(() => Effect.succeed(false)),
              );
              if (succeeded) {
                processed += 1;
                yield* publish(DOMAIN_EVENT_TYPES.EMBEDDING_PROGRESS, {
                  current: processed,
                  total: selected.length,
                  failed,
                });
              } else {
                failed += 1;
              }
            }
            return { processed, total: selected.length, failed };
          }),
      },
      assignTopicToNote: { execute: assignTopic },
      removeTopicFromNote: {
        execute: (noteId, topicId) =>
          topics
            .removeFromNote(noteId, topicId)
            .pipe(
              Effect.zipRight(
                publish(DOMAIN_EVENT_TYPES.NOTE_CLASSIFIED, {
                  noteId,
                  topicId: null,
                  removed: true,
                }),
              ),
            ),
      },
      getSimilarNotes: {
        execute: (noteId, limit = 10) =>
          notes.findById(noteId).pipe(
            Effect.flatMap((note) =>
              note
                ? index.getNoteVector(noteId).pipe(
                    Effect.flatMap((vector) =>
                      vector
                        ? index.findSimilarNotesByVector(vector, {
                            limit,
                            workspaceId: note.workspaceId || undefined,
                            excludeNoteId: noteId,
                          })
                        : Effect.succeed([]),
                    ),
                  )
                : Effect.succeed([]),
            ),
            Effect.map((similar) =>
              similar.map((item) => ({
                noteId: item.noteId,
                title: item.title,
                distance: item.similarity,
              })),
            ),
          ),
      },
      semanticSearch: {
        execute: (query, limit = 10) =>
          workspaces.findActive().pipe(
            Effect.flatMap((workspace) =>
              workspace
                ? embedder.generateEmbedding(query).pipe(
                    Effect.flatMap((vector) =>
                      index.findSimilarNotesByVector(Array.from(vector), {
                        limit,
                        workspaceId: workspace.id,
                      }),
                    ),
                  )
                : Effect.succeed([]),
            ),
            Effect.map((similar) =>
              similar.map((item) => ({
                noteId: item.noteId,
                title: item.title,
                distance: item.similarity,
              })),
            ),
          ),
      },
      recomputeCentroids: { execute: recomputeCentroids },
      getEmbeddingStatus: {
        execute: () =>
          workspaces.findActive().pipe(
            Effect.flatMap((workspace) =>
              Effect.all(
                [
                  embedder.isReady(),
                  workspace
                    ? index.getWorkspaceStats(workspace.id)
                    : Effect.succeed({
                        totalNotes: 0,
                        indexedNotes: 0,
                        pendingNotes: 0,
                      }),
                ],
                { concurrency: 'unbounded' },
              ),
            ),
            Effect.map(([ready, stats]) => ({
              ready,
              totalNotes: stats.totalNotes,
              embeddedNotes: stats.indexedNotes,
              pendingNotes: stats.pendingNotes,
            })),
          ),
      },
      getNotesForTopic: {
        execute: (topicId, options) =>
          topics.getNotesForTopic(topicId, options).pipe(
            Effect.flatMap((assignments) =>
              Effect.forEach(
                assignments,
                (assignment) =>
                  notes.findById(assignment.noteId).pipe(
                    Effect.map(
                      (note): NoteForTopic | null =>
                        note
                          ? {
                              id: assignment.noteId,
                              title: note.title || 'Untitled',
                              confidence: assignment.confidence,
                              isManual: assignment.isManual,
                            }
                          : null,
                    ),
                  ),
                { concurrency: 'unbounded' },
              ),
            ),
            Effect.map((items) =>
              items.filter((item): item is NoteForTopic => item !== null),
            ),
          ),
      },
      getTopicsForNote: {
        execute: (noteId) => topics.getTopicsForNote(noteId),
      },
      suggestTopics: {
        execute: (request = {}) =>
          (request.workspaceId
            ? workspaces.findById(request.workspaceId)
            : workspaces.findActive()
          ).pipe(
            Effect.flatMap((workspace) =>
              workspace
                ? index.getChunksForWorkspace(workspace.id)
                : Effect.succeed([]),
            ),
            Effect.flatMap((chunks) => {
              if (!chunks.length) return Effect.succeed([]);
              const noteIds = [...new Set(chunks.map((chunk) => chunk.noteId))];
              return Effect.forEach(
                noteIds,
                (noteId) => notes.findById(noteId),
                { concurrency: 'unbounded' },
              ).pipe(
                Effect.map((hydrated) => {
                  const titleById = new Map(
                    hydrated
                      .filter((note) => note !== null)
                      .map((note) => [note.id, note.title || 'Untitled']),
                  );
                  const candidates: SuggesterChunk[] = chunks
                    .filter(
                      (chunk) =>
                        chunk.embedding && chunk.embedding.length > 0,
                    )
                    .map((chunk) => ({
                      chunkId: chunk.id,
                      noteId: chunk.noteId,
                      noteTitle:
                        titleById.get(chunk.noteId) ?? 'Untitled',
                      headingPath: chunk.headingPath,
                      text: chunk.text,
                      embedding: chunk.embedding!,
                    }));
                  return TopicSuggester.suggest(candidates).map(
                    (cluster): SuggestedTopic => ({
                      id: cluster.id,
                      label: cluster.label,
                      altLabels: cluster.altLabels,
                      noteIds: cluster.noteIds,
                      chunkIds: cluster.chunkIds,
                      noteCount: cluster.noteCount,
                      chunkCount: cluster.chunkCount,
                      cohesion: cluster.cohesion,
                      representatives: cluster.representatives,
                    }),
                  );
                }),
              );
            }),
          ),
      },
      adoptSuggestedTopic: {
        execute: (request) =>
          Effect.gen(function* () {
            const name = request.name.trim();
            if (!name) {
              return yield* Effect.fail(
                new Error('Adopt suggested topic: name is required'),
              );
            }
            if (!request.noteIds.length) {
              return yield* Effect.fail(
                new Error(
                  'Adopt suggested topic: at least one note is required',
                ),
              );
            }
            const topic = yield* createTopic({
              name,
              color: request.color ?? DEFAULT_COLOR,
            });
            yield* Effect.forEach(
              request.noteIds,
              (noteId) => assignTopic(noteId, topic.id),
              { concurrency: 1, discard: true },
            );
            yield* recomputeCentroids();
            return {
              topicId: topic.id,
              assignedNoteCount: request.noteIds.length,
            };
          }),
      },
    };
    return service;
  }),
);
