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
  TopicCurator,
  TopicSuggester,
  TopicUseCasesPort,
  WorkspaceRepositoryPort,
  type ClassifyResult,
  type ITopicUseCases,
  type NoteForTopic,
  type OrganizeTopicsResult,
  type SuggestedCluster,
  type SuggesterChunk,
  type TopicCandidate,
  type TopicDTO,
} from '../../../domain';

const DEFAULT_COLOR = '#6366f1';

/**
 * Clustering is O(n²) over chunk vectors, and the organize pass runs
 * unattended — cap the work so a large workspace costs a bounded amount of
 * CPU per pass instead of stalling the app.
 */
const CLUSTER_CHUNK_LIMIT = 1_500;
/** Untopiced notes filed per pass; the rest are picked up by the next one. */
const CLASSIFY_BATCH_LIMIT = 200;

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

    /** Journal entries are a diary, not material for topical clustering. */
    const journalFilter = () =>
      configs.get().pipe(
        Effect.map((config) => {
          const prefix = `${config.notes.locationPolicy.journalFolder}/`;
          return (path: string | null | undefined) =>
            path?.startsWith(prefix) ?? false;
        }),
      );

    const clusterWorkspace = (
      workspaceId: string,
    ): Effect.Effect<SuggestedCluster[], Error> =>
      index.getChunksForWorkspace(workspaceId).pipe(
        Effect.flatMap((chunks) => {
          const embedded = chunks
            .filter((chunk) => chunk.embedding && chunk.embedding.length > 0)
            .slice(0, CLUSTER_CHUNK_LIMIT);
          if (!embedded.length) return Effect.succeed([]);
          const noteIds = [...new Set(embedded.map((chunk) => chunk.noteId))];
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
              const candidates: SuggesterChunk[] = embedded.map((chunk) => ({
                chunkId: chunk.id,
                noteId: chunk.noteId,
                noteTitle: titleById.get(chunk.noteId) ?? 'Untitled',
                headingPath: chunk.headingPath,
                text: chunk.text,
                embedding: chunk.embedding!,
              }));
              return TopicSuggester.suggest(candidates);
            }),
          );
        }),
      );

    /** Files notes that belong to no topic yet against the existing centroids. */
    const classifyUntopiced = (workspaceId: string) =>
      Effect.gen(function* () {
        const allTopics = yield* topics.findAll();
        if (!allTopics.length) return 0;
        const assigned = new Set<string>();
        yield* Effect.forEach(
          allTopics,
          (topic) =>
            topics.getNotesForTopic(topic.id).pipe(
              Effect.map((members) => {
                for (const member of members) assigned.add(member.noteId);
              }),
            ),
          { concurrency: 1, discard: true },
        );
        const isJournal = yield* journalFilter();
        const all = yield* notes.findAll({ workspaceId, isDeleted: false });
        const pending = all
          .filter((note) => !assigned.has(note.id) && !isJournal(note.filePath))
          .slice(0, CLASSIFY_BATCH_LIMIT);
        let classified = 0;
        for (const note of pending) {
          const result = yield* classifyNote(note.id).pipe(
            Effect.catchAll(() => Effect.succeed(null)),
          );
          if (result && result.topics.length > 0) classified += 1;
        }
        return classified;
      });

    const organizeTopics: ITopicUseCases['organizeTopics']['execute'] = (
      request = {},
    ) =>
      Effect.gen(function* () {
        const idle: OrganizeTopicsResult = {
          ran: false,
          topicsCreated: 0,
          notesAssigned: 0,
          notesClassified: 0,
        };
        // Clustering reads vectors that are already stored, so a pass costs
        // nothing extra when the embedder has not been loaded this session.
        const workspace = yield* (request.workspaceId
          ? workspaces.findById(request.workspaceId)
          : workspaces.findActive());
        if (!workspace) return idle;

        const clusters = yield* clusterWorkspace(workspace.id);
        const existing = yield* topics.findAll();
        const curated = TopicCurator.curate(
          clusters.map((cluster) => ({
            label: cluster.label,
            altLabels: cluster.altLabels,
            noteIds: cluster.noteIds,
            noteCount: cluster.noteCount,
            cohesion: cluster.cohesion,
          })),
          existing.map((topic) => ({ name: topic.name })),
        );

        let notesAssigned = 0;
        for (const plan of curated) {
          const topic = yield* createTopic({
            name: plan.name,
            color: plan.color,
          });
          yield* Effect.forEach(
            plan.noteIds,
            (noteId) =>
              topics
                .assignToNote(noteId, topic.id, { confidence: plan.confidence })
                .pipe(
                  Effect.zipRight(
                    publish(DOMAIN_EVENT_TYPES.NOTE_CLASSIFIED, {
                      noteId,
                      topicId: topic.id,
                      confidence: plan.confidence,
                    }),
                  ),
                ),
            { concurrency: 1, discard: true },
          );
          notesAssigned += plan.noteIds.length;
        }
        if (curated.length) yield* recomputeCentroids();

        const notesClassified = yield* classifyUntopiced(workspace.id);
        return {
          ran: true,
          topicsCreated: curated.length,
          notesAssigned,
          notesClassified,
        };
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
              const isJournal = yield* journalFilter();
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
                similarity: item.similarity,
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
                similarity: item.similarity,
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
      organizeTopics: { execute: organizeTopics },
    };
    return service;
  }),
);
