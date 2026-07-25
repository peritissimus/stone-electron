import { Effect, Layer } from 'effect';
import {
  AppConfigRepositoryPort,
  EmbedderPort,
  IndexRepositoryPort,
  NoteLinkRepositoryPort,
  NoteRepositoryPort,
  RelatedNotesScorer,
  RerankerPort,
  SearchEnginePort,
  SearchUseCasesPort,
  TagRepositoryPort,
  type ChunkSearchResult,
  type HybridSearchChunkHit,
  type HybridSearchResultRow,
  type ISearchUseCases,
  type RelatedNoteMatch,
} from '../../../domain';

const RRF_K = 60;
const SNIPPET_CHARS = 240;
const DISTINCTIVE_TERMS = 12;
const LEXICAL_CHUNK_LIMIT = 60;
const LEXICAL_SHORTLIST = 5;

interface MergedChunk {
  chunkId: string;
  noteId: string;
  headingPath: string[];
  text: string;
  ftsRank?: number;
  semanticRank?: number;
  score: number;
}

function mergeChunks(
  fullText: ChunkSearchResult[],
  semantic: ChunkSearchResult[],
): MergedChunk[] {
  const chunks = new Map<string, MergedChunk>();
  const add = (
    hits: ChunkSearchResult[],
    rank: 'ftsRank' | 'semanticRank',
  ) =>
    hits.forEach(({ chunk }, index) => {
      const merged = chunks.get(chunk.id) ?? {
        chunkId: chunk.id,
        noteId: chunk.noteId,
        headingPath: chunk.headingPath,
        text: chunk.text,
        score: 0,
      };
      merged[rank] = index;
      merged.score += 1 / (RRF_K + index + 1);
      chunks.set(chunk.id, merged);
    });
  add(fullText, 'ftsRank');
  add(semantic, 'semanticRank');
  return [...chunks.values()].sort((a, b) => b.score - a.score);
}

function excerpt(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length <= SNIPPET_CHARS
    ? normalized
    : `${normalized.slice(0, SNIPPET_CHARS).trim()}…`;
}

export const SearchUseCasesLive = Layer.effect(
  SearchUseCasesPort,
  Effect.gen(function* () {
    const notes = yield* NoteRepositoryPort;
    const engine = yield* SearchEnginePort;
    const embedder = yield* EmbedderPort;
    const index = yield* IndexRepositoryPort;
    const tags = yield* TagRepositoryPort;
    const links = yield* NoteLinkRepositoryPort;
    const configs = yield* AppConfigRepositoryPort;
    const reranker = yield* RerankerPort;

    const hybrid: ISearchUseCases['hybridSearch']['execute'] = (request) =>
      Effect.gen(function* () {
        const started = yield* Effect.clockWith(
          (clock) => clock.currentTimeMillis,
        );
        const query = request.query.trim();
        if (!query) return { results: [], total: 0, queryTimeMs: 0 };
        const limit = request.limit && request.limit > 0 ? request.limit : 20;
        const candidateLimit = Math.max(40, limit * 4);
        const semanticSearch = embedder.isReady().pipe(
          Effect.flatMap((ready) =>
            ready
              ? embedder.generateEmbedding(query).pipe(
                  Effect.flatMap((vector) =>
                    index.searchVector(Array.from(vector), {
                      limit: candidateLimit,
                      workspaceId: request.workspaceId,
                    }),
                  ),
                )
              : Effect.succeed([]),
          ),
          Effect.catchAll(() => Effect.succeed([])),
        );
        const [fullText, semantic] = yield* Effect.all(
          [
            index.searchFullText(query, {
              limit: candidateLimit,
              workspaceId: request.workspaceId,
            }),
            semanticSearch,
          ],
          { concurrency: 'unbounded' },
        );
        const merged = mergeChunks(fullText, semantic);
        const pool = merged.slice(0, 30);
        if (pool.length > 0) {
          yield* reranker
            .rerank({
              query,
              documents: pool.map((chunk) => ({
                id: chunk.chunkId,
                text: chunk.text,
              })),
            })
            .pipe(
              Effect.tap((scores) =>
                Effect.sync(() => {
                  const byId = new Map(
                    scores.map((item) => [item.id, item.score]),
                  );
                  pool.forEach((chunk) => {
                    const score = byId.get(chunk.chunkId);
                    if (score !== undefined) {
                      chunk.score = 1 / (1 + Math.exp(-score));
                    }
                  });
                  merged.sort((a, b) => b.score - a.score);
                }),
              ),
              Effect.catchAll(() => Effect.void),
            );
        }
        const buckets = new Map<
          string,
          {
            chunks: MergedChunk[];
            score: number;
            fts: boolean;
            semantic: boolean;
          }
        >();
        merged.forEach((chunk) => {
          const bucket = buckets.get(chunk.noteId) ?? {
            chunks: [],
            score: 0,
            fts: false,
            semantic: false,
          };
          bucket.chunks.push(chunk);
          bucket.fts ||= chunk.ftsRank !== undefined;
          bucket.semantic ||= chunk.semanticRank !== undefined;
          buckets.set(chunk.noteId, bucket);
        });
        const ranked = [...buckets.entries()]
          .map(([noteId, bucket]) => {
            bucket.chunks = bucket.chunks
              .sort((a, b) => b.score - a.score)
              .slice(0, 3);
            bucket.score = bucket.chunks.reduce(
              (sum, chunk) => sum + chunk.score,
              0,
            );
            return { noteId, ...bucket };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
        const hydrated = yield* Effect.forEach(
          ranked,
          (row) =>
            notes.findById(row.noteId).pipe(
              Effect.map((note): HybridSearchResultRow | null => {
                if (!note) return null;
                const chunks: HybridSearchChunkHit[] = row.chunks.map(
                  (chunk) => ({
                    chunkId: chunk.chunkId,
                    noteId: chunk.noteId,
                    headingPath: chunk.headingPath,
                    excerpt: excerpt(chunk.text),
                    score: chunk.score,
                    sources: [
                      ...(chunk.ftsRank !== undefined
                        ? (['fts'] as const)
                        : []),
                      ...(chunk.semanticRank !== undefined
                        ? (['semantic'] as const)
                        : []),
                    ],
                  }),
                );
                return {
                  note,
                  score: row.score,
                  searchType:
                    row.fts && row.semantic
                      ? 'hybrid'
                      : row.fts
                        ? 'fts'
                        : 'semantic',
                  chunks,
                };
              }),
            ),
          { concurrency: 'unbounded' },
        );
        const results = hydrated.filter(
          (row): row is HybridSearchResultRow => row !== null,
        );
        const ended = yield* Effect.clockWith(
          (clock) => clock.currentTimeMillis,
        );
        return {
          results,
          total: results.length,
          queryTimeMs: ended - started,
        };
      });

    const related: ISearchUseCases['getRelatedNotes']['execute'] = (
      request,
    ) =>
      Effect.gen(function* () {
        const limit = request.limit ?? 5;
        const note = yield* notes.findById(request.noteId);
        const workspaceId =
          request.workspaceId ?? note?.workspaceId ?? undefined;
        if (!note || !workspaceId || limit <= 0) return { results: [] };
        const allChunks = yield* index.getChunksForWorkspace(workspaceId);
        const embedded = allChunks.filter(
          (chunk) => chunk.embedding && chunk.embedding.length > 0,
        );
        const source = embedded.filter(
          (chunk) => chunk.noteId === request.noteId,
        );
        const candidates = embedded.filter(
          (chunk) => chunk.noteId !== request.noteId,
        );
        if (!source.length || !candidates.length) return { results: [] };
        const semantic = RelatedNotesScorer.scoreCandidates(
          source,
          candidates,
        );
        const semanticByNote = new Map(
          semantic.map((candidate) => [candidate.noteId, candidate]),
        );
        const corpus = new Map<string, string[]>();
        candidates.forEach((chunk) => {
          const texts = corpus.get(chunk.noteId) ?? [];
          texts.push(chunk.text);
          corpus.set(chunk.noteId, texts);
        });
        const distinctiveTerms = RelatedNotesScorer.distinctiveTerms(
          source.map((chunk) => chunk.text),
          [...corpus.values()].map((texts) => texts.join(' ')),
          DISTINCTIVE_TERMS,
        );
        const lexicalStrength = yield* (
          distinctiveTerms.length
            ? index
                .searchFullText(distinctiveTerms.join(' '), {
                  limit: LEXICAL_CHUNK_LIMIT,
                  workspaceId,
                })
                .pipe(
                  Effect.map((hits) => {
                    const noteOrder: string[] = [];
                    hits.forEach(({ chunk }) => {
                      if (
                        chunk.noteId !== request.noteId &&
                        !noteOrder.includes(chunk.noteId)
                      ) {
                        noteOrder.push(chunk.noteId);
                      }
                    });
                    return new Map(
                      noteOrder.map((id, position) => [
                        id,
                        1 - position / noteOrder.length,
                      ]),
                    );
                  }),
                  Effect.catchAll(() =>
                    Effect.succeed(new Map<string, number>()),
                  ),
                )
            : Effect.succeed(new Map<string, number>())
        );
        const shortlistIds = new Set(
          semantic
            .filter((candidate) => candidate.semanticScore >= 0.15)
            .slice(0, Math.max(limit * 3, 12))
            .map((candidate) => candidate.noteId),
        );
        [...lexicalStrength.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, LEXICAL_SHORTLIST)
          .forEach(([id]) => {
            if (semanticByNote.has(id)) shortlistIds.add(id);
          });
        const shortlist = [...shortlistIds].map(
          (id) => semanticByNote.get(id)!,
        );
        const ids = [...shortlistIds];
        if (!ids.length) return { results: [] };
        const [tagsByNote, allLinks, candidateNotes, config] =
          yield* Effect.all(
            [
              tags.getTagsForNotes([request.noteId, ...ids]),
              links.findAll(),
              Effect.forEach(ids, (id) => notes.findById(id), {
                concurrency: 'unbounded',
              }),
              configs.get(),
            ],
            { concurrency: 'unbounded' },
          );
        const noteById = new Map(
          candidateNotes
            .filter((candidate) => candidate !== null)
            .map((candidate) => [candidate.id, candidate]),
        );
        const neighbors = new Map<string, Set<string>>();
        const adjacent = (id: string) => {
          const set = neighbors.get(id) ?? new Set<string>();
          neighbors.set(id, set);
          return set;
        };
        allLinks.forEach((link) => {
          adjacent(link.sourceNoteId).add(link.targetNoteId);
          adjacent(link.targetNoteId).add(link.sourceNoteId);
        });
        const sourceNeighbors =
          neighbors.get(request.noteId) ?? new Set<string>();
        const sourceTags = new Set(
          (tagsByNote.get(request.noteId) ?? []).map((tag) => tag.id),
        );
        const journalPrefix =
          `${config.notes.locationPolicy.journalFolder}/`;
        const results: RelatedNoteMatch[] = shortlist
          .flatMap((candidate) => {
            const target = noteById.get(candidate.noteId);
            if (!target) return [];
            const targetTags = new Set(
              (tagsByNote.get(candidate.noteId) ?? []).map((tag) => tag.id),
            );
            const score = RelatedNotesScorer.finalScore(
              candidate.semanticScore,
              {
                tagJaccard: RelatedNotesScorer.tagJaccard(
                  sourceTags,
                  targetTags,
                ),
                graphOverlap: RelatedNotesScorer.graphOverlap(
                  sourceNeighbors,
                  neighbors.get(candidate.noteId) ?? new Set<string>(),
                  (id) => neighbors.get(id)?.size ?? 0,
                  sourceNeighbors.has(candidate.noteId),
                ),
                lexicalStrength: lexicalStrength.get(candidate.noteId) ?? 0,
                sameNotebook:
                  note.notebookId !== null &&
                  note.notebookId === target.notebookId,
                isJournal:
                  target.filePath?.startsWith(journalPrefix) ?? false,
              },
            );
            return score >= 0.35
              ? [
                  {
                    noteId: candidate.noteId,
                    title: target.title || 'Untitled',
                    similarity: score,
                    matchedChunks: Math.max(1, candidate.strongChunks),
                    bestChunk: {
                      chunkId: candidate.bestChunk.id,
                      headingPath: candidate.bestChunk.headingPath,
                      excerpt: excerpt(candidate.bestChunk.text),
                    },
                  },
                ]
              : [];
          })
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, limit);
        return { results };
      });

    const service: ISearchUseCases = {
      fullTextSearch: {
        execute: (request) =>
          engine
            .searchFullText(request.query, {
              workspaceId: request.workspaceId,
              limit: request.limit || 50,
            })
            .pipe(
              Effect.map((results) => ({
                results,
                total: results.length,
              })),
            ),
      },
      semanticSearch: {
        execute: (request) =>
          embedder.generateEmbedding(request.query).pipe(
            Effect.flatMap((vector) =>
              vector
                ? index.findSimilarNotesByVector(Array.from(vector), {
                    limit: request.limit || 10,
                    workspaceId: request.workspaceId,
                  })
                : Effect.succeed([]),
            ),
            Effect.map((results) => ({
              results: results.map((item) => ({
                noteId: item.noteId,
                title: item.title,
                similarity: item.similarity,
              })),
            })),
          ),
      },
      findSimilarNotes: {
        execute: (request) =>
          index.getNoteVector(request.noteId).pipe(
            Effect.flatMap((vector) =>
              vector
                ? notes.findById(request.noteId).pipe(
                    Effect.flatMap((note) =>
                      note
                        ? index.findSimilarNotesByVector(vector, {
                            limit: request.limit || 5,
                            workspaceId: note.workspaceId || undefined,
                            excludeNoteId: request.noteId,
                          })
                        : Effect.succeed([]),
                    ),
                  )
                : Effect.succeed([]),
            ),
            Effect.map((results) => ({
              results: results.map((item) => ({
                noteId: item.noteId,
                title: item.title,
                similarity: item.similarity,
              })),
            })),
          ),
      },
      hybridSearch: { execute: hybrid },
      searchByTags: {
        execute: () => Effect.succeed({ notes: [], total: 0 }),
      },
      searchByDateRange: {
        execute: (request) =>
          notes
            .findAll({
              workspaceId: request.workspaceId,
              isDeleted: false,
              orderBy:
                request.field === 'created' ? 'createdAt' : 'updatedAt',
              orderDirection: 'desc',
            })
            .pipe(
              Effect.map((all) => {
                const field =
                  request.field === 'created'
                    ? 'createdAt'
                    : 'updatedAt';
                const start = new Date(request.startDate);
                const end = new Date(request.endDate);
                const filtered = all.filter(
                  (note) =>
                    note[field] >= start && note[field] <= end,
                );
                return {
                  notes: request.limit
                    ? filtered.slice(0, request.limit)
                    : filtered,
                  total: filtered.length,
                };
              }),
            ),
      },
      getRelatedNotes: { execute: related },
    };
    return service;
  }),
);
