import { Effect, Layer } from 'effect';
import {
  EmbedderPort,
  FileStoragePort,
  IndexRepositoryPort,
  IndexUseCasesPort,
  NoteRepositoryPort,
  PathServicePort,
  WorkspaceRepositoryPort,
  type IIndexUseCases,
  type IndexNoteRequest,
  type IndexNoteResponse,
  type NoteChunkRecord,
} from '../../../domain';
import { NoteChunker } from '../../../domain/services/NoteChunker';
import { hashText } from '../../../domain/services/hashText';

const EMBED_MODEL_NAME = 'Xenova/bge-small-en-v1.5';
const REBUILD_CONCURRENCY = 4;
const EMPTY_STATS = {
  workspaceId: '',
  totalNotes: 0,
  indexedNotes: 0,
  pendingNotes: 0,
  failedNotes: 0,
  chunkCount: 0,
} as const;

export const IndexUseCasesLive = Layer.effect(
  IndexUseCasesPort,
  Effect.gen(function* () {
    const noteRepository = yield* NoteRepositoryPort;
    const workspaceRepository = yield* WorkspaceRepositoryPort;
    const fileStorage = yield* FileStoragePort;
    const embedder = yield* EmbedderPort;
    const indexRepository = yield* IndexRepositoryPort;
    const pathService = yield* PathServicePort;

    const markFailed = (
      noteId: string,
      workspaceId: string,
      contentHash: string,
      error: string,
    ) =>
      indexRepository.upsertStatus({
        noteId,
        workspaceId,
        contentHash,
        chunkCount: 0,
        indexedAt: null,
        model: EMBED_MODEL_NAME,
        dimensions: null,
        status: 'failed',
        error,
      });

    const failResult = (
      request: IndexNoteRequest,
      workspaceId: string,
      contentHash: string,
      error: string,
    ): Effect.Effect<IndexNoteResponse, Error> =>
      markFailed(request.noteId, workspaceId, contentHash, error).pipe(
        Effect.as({
          noteId: request.noteId,
          status: 'failed' as const,
          chunkCount: 0,
          error,
        }),
      );

    const indexNote = (
      request: IndexNoteRequest,
    ): Effect.Effect<IndexNoteResponse, Error> =>
      Effect.gen(function* () {
        const note = yield* noteRepository.findById(request.noteId);
        if (!note || note.isDeleted || !note.filePath || !note.workspaceId) {
          return {
            noteId: request.noteId,
            status: 'missing' as const,
            chunkCount: 0,
          };
        }

        const workspace = yield* workspaceRepository.findById(note.workspaceId);
        if (!workspace) {
          return {
            noteId: request.noteId,
            status: 'missing' as const,
            chunkCount: 0,
          };
        }

        const absolutePath = yield* pathService.join(
          workspace.folderPath,
          note.filePath,
        );
        const markdown = yield* fileStorage.read(absolutePath);
        if (markdown === null) {
          yield* markFailed(
            note.id,
            workspace.id,
            '',
            'file missing on disk',
          );
          return {
            noteId: note.id,
            status: 'failed' as const,
            chunkCount: 0,
            error: 'file missing',
          };
        }

        const contentHash = hashText(markdown);
        const existing = yield* indexRepository.getStatus(note.id);
        if (
          !request.force &&
          existing?.status === 'indexed' &&
          existing.contentHash === contentHash
        ) {
          return {
            noteId: note.id,
            status: 'skipped' as const,
            chunkCount: existing.chunkCount,
          };
        }

        const chunks = NoteChunker.chunk(note.id, markdown);
        const nowMillis = yield* Effect.clockWith(
          (clock) => clock.currentTimeMillis,
        );
        const now = new Date(nowMillis);
        if (chunks.length === 0) {
          yield* indexRepository.replaceChunks(
            note.id,
            workspace.id,
            note.title ?? 'Untitled',
            [],
          );
          yield* indexRepository.upsertStatus({
            noteId: note.id,
            workspaceId: workspace.id,
            contentHash,
            chunkCount: 0,
            indexedAt: now,
            model: EMBED_MODEL_NAME,
            dimensions: null,
            status: 'indexed',
            error: null,
          });
          return {
            noteId: note.id,
            status: 'indexed' as const,
            chunkCount: 0,
          };
        }

        const ready = yield* embedder.isReady();
        if (!ready) {
          const initialized = yield* embedder.initialize().pipe(
            Effect.as(true),
            Effect.catchAll((error) =>
              failResult(
                request,
                workspace.id,
                contentHash,
                error.message || 'embedder failed to initialize',
              ).pipe(Effect.map(() => false)),
            ),
          );
          if (!initialized) {
            const status = yield* indexRepository.getStatus(note.id);
            return {
              noteId: note.id,
              status: 'failed' as const,
              chunkCount: 0,
              error:
                status?.error ?? 'embedder failed to initialize',
            };
          }
        }

        const vectorsOrError = yield* embedder
          .generateEmbeddings(chunks.map((chunk) => chunk.text))
          .pipe(Effect.either);
        if (vectorsOrError._tag === 'Left') {
          return yield* failResult(
            request,
            workspace.id,
            contentHash,
            vectorsOrError.left.message || 'embedding failed',
          );
        }
        const vectors = vectorsOrError.right;
        if (vectors.length !== chunks.length) {
          return yield* failResult(
            request,
            workspace.id,
            contentHash,
            `embedding count mismatch (${vectors.length} vs ${chunks.length})`,
          );
        }

        const records: NoteChunkRecord[] = chunks.map((chunk, index) => ({
          id: chunk.id,
          noteId: note.id,
          workspaceId: workspace.id,
          chunkIndex: chunk.index,
          headingPath: chunk.headingPath,
          text: chunk.text,
          contentHash: hashText(chunk.text),
          tokenCount: chunk.tokenCount,
          embedding: Array.from(vectors[index]),
          createdAt: now,
          updatedAt: now,
        }));
        yield* indexRepository.replaceChunks(
          note.id,
          workspace.id,
          note.title ?? 'Untitled',
          records,
        );
        yield* indexRepository.upsertStatus({
          noteId: note.id,
          workspaceId: workspace.id,
          contentHash,
          chunkCount: records.length,
          indexedAt: now,
          model: EMBED_MODEL_NAME,
          dimensions: vectors[0]?.length ?? null,
          status: 'indexed',
          error: null,
        });
        return {
          noteId: note.id,
          status: 'indexed' as const,
          chunkCount: records.length,
        };
      });

    const service: IIndexUseCases = {
      indexNote: { execute: indexNote },
      rebuildAll: {
        execute: (request = {}) =>
          Effect.gen(function* () {
            const workspace = request.workspaceId
              ? yield* workspaceRepository.findById(request.workspaceId)
              : yield* workspaceRepository.findActive();
            if (!workspace) {
              return {
                workspaceId: '',
                total: 0,
                indexed: 0,
                skipped: 0,
                failed: 0,
                missing: 0,
              };
            }
            const notes = yield* noteRepository.findAll({
              workspaceId: workspace.id,
              isDeleted: false,
            });
            const outcomes = yield* Effect.forEach(
              notes,
              (note) =>
                indexNote({
                  noteId: note.id,
                  force: request.force ?? false,
                }).pipe(
                  Effect.map((result) => result.status),
                  Effect.catchAll(() => Effect.succeed('failed' as const)),
                ),
              { concurrency: REBUILD_CONCURRENCY },
            );
            return {
              workspaceId: workspace.id,
              total: notes.length,
              indexed: outcomes.filter((status) => status === 'indexed').length,
              skipped: outcomes.filter((status) => status === 'skipped').length,
              failed: outcomes.filter((status) => status === 'failed').length,
              missing: outcomes.filter((status) => status === 'missing').length,
            };
          }),
      },
      getStats: {
        execute: (request) =>
          Effect.gen(function* () {
            const workspaceId =
              request?.workspaceId ??
              (yield* workspaceRepository.findActive())?.id;
            if (!workspaceId) return EMPTY_STATS;
            const stats =
              yield* indexRepository.getWorkspaceStats(workspaceId);
            return { workspaceId, ...stats };
          }),
      },
    };
    return service;
  }),
);
