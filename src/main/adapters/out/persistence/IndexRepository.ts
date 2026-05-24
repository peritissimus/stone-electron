/**
 * IndexRepository — chunk-level retrieval persistence backed by SQLite.
 *
 * Drizzle owns the typed access for note_chunks + note_index_records. The
 * note_chunks_fts virtual table isn't expressible in Drizzle, so FTS sync
 * uses raw SQL via the libsql client directly. Atomicity for "replace all
 * chunks for a note" is provided by wrapping delete + insert + FTS sync in
 * an immediate transaction.
 *
 * Embedding BLOB convention matches notes.embedding: Float32Array packed as
 * a Node Buffer (4 bytes per dim). Drizzle hands back a Buffer, raw libsql
 * hands back an ArrayBuffer — decode() accepts both for resilience.
 */

import { and, eq, inArray, sql } from 'drizzle-orm';
import { noteChunks, noteIndexRecords, notes, type Database } from '../../../shared';
import type {
  IIndexRepository,
  IndexedNoteStatus,
  NoteChunkRecord,
  ChunkSearchResult,
  SearchIndexOptions,
  SimilarNoteResult,
  WorkspaceIndexStats,
} from '../../../domain';
import { handleOperation } from '../../../shared/utils';

export interface IndexRepositoryDeps {
  db: Database;
}

export class IndexRepository implements IIndexRepository {
  constructor(private readonly deps: IndexRepositoryDeps) {}

  private handle<T>(operation: string, fn: () => Promise<T>, context?: Record<string, unknown>) {
    return handleOperation(fn, { adapter: 'IndexRepository', operation, context });
  }

  async getStatus(noteId: string): Promise<IndexedNoteStatus | null> {
    return this.handle(
      'getStatus',
      async () => {
        const rows = await this.deps.db
          .select()
          .from(noteIndexRecords)
          .where(eq(noteIndexRecords.noteId, noteId))
          .limit(1);
        const row = rows[0];
        if (!row) return null;
        return toStatus(row);
      },
      { noteId },
    );
  }

  async upsertStatus(status: IndexedNoteStatus): Promise<void> {
    return this.handle(
      'upsertStatus',
      async () => {
        await this.deps.db
          .insert(noteIndexRecords)
          .values({
            noteId: status.noteId,
            workspaceId: status.workspaceId,
            contentHash: status.contentHash,
            chunkCount: status.chunkCount,
            indexedAt: status.indexedAt ?? null,
            model: status.model ?? null,
            dimensions: status.dimensions ?? null,
            status: status.status,
            error: status.error ?? null,
          })
          .onConflictDoUpdate({
            target: noteIndexRecords.noteId,
            set: {
              workspaceId: status.workspaceId,
              contentHash: status.contentHash,
              chunkCount: status.chunkCount,
              indexedAt: status.indexedAt ?? null,
              model: status.model ?? null,
              dimensions: status.dimensions ?? null,
              status: status.status,
              error: status.error ?? null,
            },
          });
      },
      { noteId: status.noteId, status: status.status, chunkCount: status.chunkCount },
    );
  }

  async getWorkspaceStats(workspaceId: string): Promise<WorkspaceIndexStats> {
    return this.handle(
      'getWorkspaceStats',
      async () => {
        const totalRow = await this.deps.db
          .select({ c: sql<number>`count(*)` })
          .from(notes)
          .where(and(eq(notes.workspaceId, workspaceId), eq(notes.isDeleted, false)));
        const total = Number(totalRow[0]?.c ?? 0);

        const statusRows = await this.deps.db
          .select({
            status: noteIndexRecords.status,
            count: sql<number>`count(*)`,
            chunks: sql<number>`coalesce(sum(${noteIndexRecords.chunkCount}), 0)`,
          })
          .from(noteIndexRecords)
          .where(eq(noteIndexRecords.workspaceId, workspaceId))
          .groupBy(noteIndexRecords.status);

        let indexed = 0;
        let failed = 0;
        let chunks = 0;
        for (const row of statusRows) {
          const c = Number(row.count ?? 0);
          chunks += Number(row.chunks ?? 0);
          if (row.status === 'indexed') indexed += c;
          else if (row.status === 'failed') failed += c;
        }

        return {
          totalNotes: total,
          indexedNotes: indexed,
          pendingNotes: Math.max(0, total - indexed - failed),
          failedNotes: failed,
          chunkCount: chunks,
        };
      },
      { workspaceId },
    );
  }

  async replaceChunks(
    noteId: string,
    workspaceId: string,
    title: string,
    chunks: NoteChunkRecord[],
  ): Promise<void> {
    return this.handle(
      'replaceChunks',
      async () => {
        // libsql exposes batch (atomic) — use it so the FTS index never sees
        // a half-deleted state if something throws midway.
        const statements: { sql: string; args: unknown[] }[] = [];

        statements.push({
          sql: `DELETE FROM note_chunks WHERE note_id = ?`,
          args: [noteId],
        });
        statements.push({
          sql: `DELETE FROM note_chunks_fts WHERE note_id = ?`,
          args: [noteId],
        });

        for (const chunk of chunks) {
          const embeddingBlob = chunk.embedding
            ? Buffer.from(new Float32Array(chunk.embedding).buffer)
            : null;
          statements.push({
            sql: `INSERT INTO note_chunks (
                    id, note_id, workspace_id, chunk_index, heading_path,
                    text, content_hash, token_count, embedding, created_at, updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              chunk.id,
              chunk.noteId,
              chunk.workspaceId,
              chunk.chunkIndex,
              JSON.stringify(chunk.headingPath),
              chunk.text,
              chunk.contentHash,
              chunk.tokenCount,
              embeddingBlob,
              Math.floor(chunk.createdAt.getTime() / 1000),
              Math.floor(chunk.updatedAt.getTime() / 1000),
            ],
          });
          statements.push({
            sql: `INSERT INTO note_chunks_fts (
                    chunk_id, note_id, workspace_id, title, heading_path, text
                  ) VALUES (?, ?, ?, ?, ?, ?)`,
            args: [
              chunk.id,
              chunk.noteId,
              chunk.workspaceId,
              title,
              chunk.headingPath.join(' › '),
              chunk.text,
            ],
          });
        }

        const client = getLibsqlClient(this.deps.db);
        if (statements.length > 0) {
          await client.batch(statements, 'write');
        }
      },
      { noteId, chunkCount: chunks.length },
    );
  }

  async deleteByNoteId(noteId: string): Promise<void> {
    return this.handle(
      'deleteByNoteId',
      async () => {
        const client = getLibsqlClient(this.deps.db);
        await client.batch(
          [
            { sql: `DELETE FROM note_chunks_fts WHERE note_id = ?`, args: [noteId] },
            { sql: `DELETE FROM note_chunks WHERE note_id = ?`, args: [noteId] },
            { sql: `DELETE FROM note_index_records WHERE note_id = ?`, args: [noteId] },
          ],
          'write',
        );
      },
      { noteId },
    );
  }

  async searchFullText(query: string, options: SearchIndexOptions): Promise<ChunkSearchResult[]> {
    return this.handle(
      'searchFullText',
      async () => {
        const trimmed = query.trim();
        if (!trimmed) return [];

        const ftsQuery = toFtsQuery(trimmed);
        const conditions: string[] = ['note_chunks_fts MATCH ?'];
        const args: unknown[] = [ftsQuery];

        if (options.workspaceId) {
          conditions.push('workspace_id = ?');
          args.push(options.workspaceId);
        }
        if (options.noteIds && options.noteIds.length > 0) {
          conditions.push(
            `note_id IN (${options.noteIds.map(() => '?').join(', ')})`,
          );
          args.push(...options.noteIds);
        }

        const client = getLibsqlClient(this.deps.db);
        const rs = await client.execute({
          sql: `SELECT chunk_id, rank
                FROM note_chunks_fts
                WHERE ${conditions.join(' AND ')}
                ORDER BY rank
                LIMIT ?`,
          args: [...args, options.limit],
        });

        const ids: string[] = [];
        const rankByChunkId = new Map<string, number>();
        for (const row of rs.rows as Array<Record<string, unknown>>) {
          const id = String(row.chunk_id);
          ids.push(id);
          rankByChunkId.set(id, Number(row.rank ?? 0));
        }

        if (ids.length === 0) return [];

        const chunkRows = await this.deps.db
          .select()
          .from(noteChunks)
          .where(inArray(noteChunks.id, ids));

        const results: ChunkSearchResult[] = [];
        for (const row of chunkRows) {
          const ftsScore = rankByChunkId.get(row.id);
          results.push({
            chunk: toChunkRecord(row),
            ftsScore,
            combinedScore: ftsScore !== undefined ? normalizeFtsScore(ftsScore) : 0,
          });
        }

        // Preserve FTS rank order (Drizzle inArray returns arbitrary order).
        results.sort((a, b) => {
          const ai = ids.indexOf(a.chunk.id);
          const bi = ids.indexOf(b.chunk.id);
          return ai - bi;
        });
        return results;
      },
      { query, limit: options.limit, workspaceId: options.workspaceId },
    );
  }

  async searchVector(
    embedding: number[],
    options: SearchIndexOptions,
  ): Promise<ChunkSearchResult[]> {
    return this.handle(
      'searchVector',
      async () => {
        if (embedding.length === 0) return [];

        const conditions = [sql`${noteChunks.embedding} IS NOT NULL`];
        if (options.workspaceId) {
          conditions.push(eq(noteChunks.workspaceId, options.workspaceId));
        }
        if (options.noteIds && options.noteIds.length > 0) {
          conditions.push(inArray(noteChunks.noteId, options.noteIds));
        }

        const rows = await this.deps.db
          .select()
          .from(noteChunks)
          .where(and(...conditions));

        const results: ChunkSearchResult[] = [];
        for (const row of rows) {
          const vec = decodeEmbedding(row.embedding);
          if (!vec) continue;
          const sim = cosineSimilarity(embedding, vec);
          results.push({
            chunk: toChunkRecord(row),
            semanticScore: sim,
            combinedScore: (sim + 1) / 2, // map [-1,1] → [0,1]
          });
        }

        results.sort((a, b) => b.combinedScore - a.combinedScore);
        return results.slice(0, options.limit);
      },
      { dims: embedding.length, limit: options.limit, workspaceId: options.workspaceId },
    );
  }

  async getNoteVector(noteId: string): Promise<number[] | null> {
    return this.handle(
      'getNoteVector',
      async () => {
        const rows = await this.deps.db
          .select({ embedding: noteChunks.embedding })
          .from(noteChunks)
          .where(and(eq(noteChunks.noteId, noteId), sql`${noteChunks.embedding} IS NOT NULL`));
        if (rows.length === 0) return null;

        let dims = 0;
        const sum: number[] = [];
        let used = 0;
        for (const row of rows) {
          const vec = decodeEmbedding(row.embedding);
          if (!vec) continue;
          if (dims === 0) {
            dims = vec.length;
            for (let i = 0; i < dims; i += 1) sum.push(vec[i]);
            used = 1;
            continue;
          }
          if (vec.length !== dims) continue;
          for (let i = 0; i < dims; i += 1) sum[i] += vec[i];
          used += 1;
        }
        if (used === 0) return null;
        for (let i = 0; i < dims; i += 1) sum[i] /= used;
        return sum;
      },
      { noteId },
    );
  }

  async findSimilarNotesByVector(
    embedding: number[],
    options: SearchIndexOptions & { excludeNoteId?: string },
  ): Promise<SimilarNoteResult[]> {
    return this.handle(
      'findSimilarNotesByVector',
      async () => {
        if (embedding.length === 0) return [];

        const conditions = [sql`${noteChunks.embedding} IS NOT NULL`];
        if (options.workspaceId) {
          conditions.push(eq(noteChunks.workspaceId, options.workspaceId));
        }
        if (options.noteIds && options.noteIds.length > 0) {
          conditions.push(inArray(noteChunks.noteId, options.noteIds));
        }

        const rows = await this.deps.db
          .select({
            noteId: noteChunks.noteId,
            embedding: noteChunks.embedding,
            title: notes.title,
          })
          .from(noteChunks)
          .leftJoin(notes, eq(notes.id, noteChunks.noteId))
          .where(and(...conditions));

        // Aggregate per note: take the best chunk similarity (max-pooled),
        // count how many chunks contributed. Mirrors how AskNotes ranks notes
        // by their strongest chunk, not their average.
        const bestByNote = new Map<
          string,
          { title: string; best: number; matched: number }
        >();
        for (const row of rows) {
          const vec = decodeEmbedding(row.embedding);
          if (!vec) continue;
          if (options.excludeNoteId && row.noteId === options.excludeNoteId) continue;
          const sim = cosineSimilarity(embedding, vec);
          const existing = bestByNote.get(row.noteId);
          if (!existing) {
            bestByNote.set(row.noteId, {
              title: row.title ?? 'Untitled',
              best: sim,
              matched: 1,
            });
          } else {
            if (sim > existing.best) existing.best = sim;
            existing.matched += 1;
          }
        }

        const out: SimilarNoteResult[] = [];
        for (const [noteId, bucket] of bestByNote) {
          out.push({
            noteId,
            title: bucket.title,
            similarity: bucket.best,
            matchedChunks: bucket.matched,
          });
        }
        out.sort((a, b) => b.similarity - a.similarity);
        return out.slice(0, options.limit);
      },
      {
        dims: embedding.length,
        limit: options.limit,
        workspaceId: options.workspaceId,
        excludeNoteId: options.excludeNoteId,
      },
    );
  }

  async getChunksForWorkspace(workspaceId: string): Promise<NoteChunkRecord[]> {
    return this.handle(
      'getChunksForWorkspace',
      async () => {
        const rows = await this.deps.db
          .select()
          .from(noteChunks)
          .where(
            and(eq(noteChunks.workspaceId, workspaceId), sql`${noteChunks.embedding} IS NOT NULL`),
          );
        return rows.map(toChunkRecord);
      },
      { workspaceId },
    );
  }
}

/* ---------- helpers ---------- */

interface LibsqlBatchClient {
  batch(
    statements: Array<{ sql: string; args: unknown[] }>,
    mode: 'write' | 'read' | 'deferred',
  ): Promise<unknown>;
  execute(stmt: { sql: string; args: unknown[] }): Promise<{ rows: unknown[] }>;
}

/**
 * Drizzle wraps the libsql client; we reach down for raw FTS5 access since
 * Drizzle has no FTS5 syntax support. Verified shape, no behavioral surprises.
 */
function getLibsqlClient(db: Database): LibsqlBatchClient {
  const raw = (db as unknown as { session?: { client?: LibsqlBatchClient } }).session?.client;
  if (raw && typeof raw.batch === 'function' && typeof raw.execute === 'function') {
    return raw;
  }
  // Fallback path — newer drizzle versions expose `.$client`.
  const alt = (db as unknown as { $client?: LibsqlBatchClient }).$client;
  if (alt && typeof alt.batch === 'function') {
    return alt;
  }
  throw new Error('IndexRepository: could not access underlying libsql client');
}

function toStatus(row: typeof noteIndexRecords.$inferSelect): IndexedNoteStatus {
  return {
    noteId: row.noteId,
    workspaceId: row.workspaceId,
    contentHash: row.contentHash,
    chunkCount: row.chunkCount ?? 0,
    indexedAt: row.indexedAt ?? null,
    model: row.model ?? null,
    dimensions: row.dimensions ?? null,
    status: row.status as IndexedNoteStatus['status'],
    error: row.error ?? null,
  };
}

function toChunkRecord(row: typeof noteChunks.$inferSelect): NoteChunkRecord {
  return {
    id: row.id,
    noteId: row.noteId,
    workspaceId: row.workspaceId,
    chunkIndex: row.chunkIndex,
    headingPath: safeParseHeadingPath(row.headingPath),
    text: row.text,
    contentHash: row.contentHash,
    tokenCount: row.tokenCount ?? 0,
    embedding: row.embedding ? Array.from(decodeEmbedding(row.embedding) ?? []) : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function safeParseHeadingPath(value: string): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
  } catch {
    return [];
  }
}

function decodeEmbedding(raw: unknown): Float32Array | null {
  if (!raw) return null;
  if (raw instanceof Float32Array) return raw;
  if (raw instanceof ArrayBuffer) return new Float32Array(raw);
  if (raw instanceof Uint8Array) {
    return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
  }
  // Node Buffer extends Uint8Array — also handled by the branch above.
  return null;
}

function cosineSimilarity(a: number[] | Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = b.length;
  for (let i = 0; i < len; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i];
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * FTS5 rank is a negative number (lower = better). Map to a 0..1 score so it
 * composes with cosine similarity. -10 → ~0.91, -1 → ~0.5, 0 → 0.
 */
function normalizeFtsScore(rank: number): number {
  if (rank >= 0) return 0;
  return 1 - 1 / (1 - rank);
}

/**
 * Sanitize a user query for FTS5 MATCH. We strip quotes and special tokens,
 * then OR-join the remaining words so partial matches still hit. Phrases with
 * fewer than 2 chars are dropped — FTS5 will choke on lone punctuation.
 */
function toFtsQuery(query: string): string {
  const tokens = query
    .replace(/["()*:^]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  if (tokens.length === 0) return '""';
  return tokens.map((t) => `"${t.replace(/"/g, '')}"`).join(' OR ');
}
