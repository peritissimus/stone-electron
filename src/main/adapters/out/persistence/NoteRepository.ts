/**
 * Note Repository Adapter
 *
 * Implements INoteRepository port using SQLite via Drizzle ORM.
 */

import { eq, and, desc, asc, isNull, like, sql } from 'drizzle-orm';
import { notes, type Database } from '../../../shared';
import type {
  NoteEntity,
  NoteProps,
  INoteRepository,
  NoteFindOptions,
  NoteSearchOptions,
  IFileStorage,
  IMarkdownProcessor,
} from '../../../domain';
import { handleOperation } from '../../../shared/utils';

export interface NoteRepositoryDeps {
  db: Database;
  fileStorage: IFileStorage;
  markdownProcessor: IMarkdownProcessor;
  getWorkspacePath: () => string | null;
}

export class NoteRepository implements INoteRepository {
  constructor(private readonly deps: NoteRepositoryDeps) {}

  private handle<T>(operation: string, fn: () => Promise<T>, context?: Record<string, unknown>) {
    return handleOperation(fn, { adapter: 'NoteRepository', operation, context });
  }

  async findById(id: string): Promise<NoteProps | null> {
    return this.handle(
      'findById',
      async () => {
        const result = await this.deps.db.select().from(notes).where(eq(notes.id, id)).limit(1);
        return result[0] ? this.toNoteProps(result[0]) : null;
      },
      { noteId: id },
    );
  }

  async findAll(options?: NoteFindOptions): Promise<NoteProps[]> {
    return this.handle(
      'findAll',
      async () => {
        const conditions: any[] = [];

        if (options?.workspaceId) {
          conditions.push(eq(notes.workspaceId, options.workspaceId));
        }
        if (options?.notebookId !== undefined) {
          if (options.notebookId === null) {
            conditions.push(isNull(notes.notebookId));
          } else {
            conditions.push(eq(notes.notebookId, options.notebookId));
          }
        }
        if (options?.isFavorite !== undefined) {
          conditions.push(eq(notes.isFavorite, options.isFavorite));
        }
        if (options?.isPinned !== undefined) {
          conditions.push(eq(notes.isPinned, options.isPinned));
        }
        if (options?.isArchived !== undefined) {
          conditions.push(eq(notes.isArchived, options.isArchived));
        }
        if (options?.isDeleted !== undefined) {
          conditions.push(eq(notes.isDeleted, options.isDeleted));
        }

        const orderColumn = this.getOrderColumn(options?.orderBy || 'updatedAt');
        const orderFn = options?.orderDirection === 'asc' ? asc : desc;

        const baseQuery = this.deps.db
          .select()
          .from(notes)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(orderFn(orderColumn));

        const result =
          options?.limit && options?.offset
            ? await baseQuery.limit(options.limit).offset(options.offset)
            : options?.limit
              ? await baseQuery.limit(options.limit)
              : await baseQuery;

        return result.map((row) => this.toNoteProps(row));
      },
      { workspaceId: options?.workspaceId, notebookId: options?.notebookId, limit: options?.limit },
    );
  }

  async findByNotebookId(notebookId: string | null, workspaceId?: string): Promise<NoteProps[]> {
    return this.handle(
      'findByNotebookId',
      async () => {
        const conditions: any[] = [eq(notes.isDeleted, false)];

        if (notebookId === null) {
          conditions.push(isNull(notes.notebookId));
        } else {
          conditions.push(eq(notes.notebookId, notebookId));
        }

        if (workspaceId) {
          conditions.push(eq(notes.workspaceId, workspaceId));
        }

        const result = await this.deps.db
          .select()
          .from(notes)
          .where(and(...conditions))
          .orderBy(desc(notes.updatedAt));

        return result.map((row) => this.toNoteProps(row));
      },
      { notebookId, workspaceId },
    );
  }

  async findByWorkspaceId(workspaceId: string): Promise<NoteProps[]> {
    return this.handle(
      'findByWorkspaceId',
      async () => {
        const result = await this.deps.db
          .select()
          .from(notes)
          .where(and(eq(notes.workspaceId, workspaceId), eq(notes.isDeleted, false)))
          .orderBy(desc(notes.updatedAt));

        return result.map((row) => this.toNoteProps(row));
      },
      { workspaceId },
    );
  }

  async findByFilePath(filePath: string, workspaceId?: string): Promise<NoteProps | null> {
    return this.handle(
      'findByFilePath',
      async () => {
        const conditions = [eq(notes.filePath, filePath)];
        if (workspaceId) {
          conditions.push(eq(notes.workspaceId, workspaceId));
        }

        const result = await this.deps.db
          .select()
          .from(notes)
          .where(and(...conditions))
          .limit(1);

        return result[0] ? this.toNoteProps(result[0]) : null;
      },
      { filePath, workspaceId },
    );
  }

  async save(note: NoteEntity): Promise<void> {
    const props = note.toPersistence();
    return this.handle(
      'save',
      async () => {
        const existing = await this.deps.db
          .select({ id: notes.id })
          .from(notes)
          .where(eq(notes.id, props.id))
          .limit(1);

        if (existing.length > 0) {
          await this.deps.db
            .update(notes)
            .set({
              title: props.title,
              notebookId: props.notebookId,
              workspaceId: props.workspaceId,
              filePath: props.filePath,
              isFavorite: props.isFavorite,
              isPinned: props.isPinned,
              isArchived: props.isArchived,
              isDeleted: props.isDeleted,
              deletedAt: props.deletedAt,
              updatedAt: props.updatedAt,
            })
            .where(eq(notes.id, props.id));
        } else {
          await this.deps.db.insert(notes).values({
            id: props.id,
            title: props.title,
            notebookId: props.notebookId,
            workspaceId: props.workspaceId,
            filePath: props.filePath,
            isFavorite: props.isFavorite,
            isPinned: props.isPinned,
            isArchived: props.isArchived,
            isDeleted: props.isDeleted,
            deletedAt: props.deletedAt,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt,
          });
        }
      },
      { noteId: props.id, isUpdate: props.id ? true : false },
    );
  }

  async delete(id: string): Promise<void> {
    return this.handle(
      'delete',
      async () => {
        await this.deps.db.delete(notes).where(eq(notes.id, id));
      },
      { noteId: id },
    );
  }

  async searchByTitle(options: NoteSearchOptions): Promise<NoteProps[]> {
    return this.handle(
      'searchByTitle',
      async () => {
        const conditions: any[] = [
          eq(notes.isDeleted, false),
          like(notes.title, `%${options.query}%`),
        ];

        if (options.workspaceId) {
          conditions.push(eq(notes.workspaceId, options.workspaceId));
        }

        const baseQuery = this.deps.db
          .select()
          .from(notes)
          .where(and(...conditions))
          .orderBy(desc(notes.updatedAt));

        const result = options.limit ? await baseQuery.limit(options.limit) : await baseQuery;

        return result.map((row) => this.toNoteProps(row));
      },
      { query: options.query, workspaceId: options.workspaceId, limit: options.limit },
    );
  }

  async count(options?: NoteFindOptions): Promise<number> {
    return this.handle(
      'count',
      async () => {
        const conditions: any[] = [];

        if (options?.workspaceId) {
          conditions.push(eq(notes.workspaceId, options.workspaceId));
        }
        if (options?.notebookId !== undefined) {
          if (options.notebookId === null) {
            conditions.push(isNull(notes.notebookId));
          } else {
            conditions.push(eq(notes.notebookId, options.notebookId));
          }
        }
        if (options?.isDeleted !== undefined) {
          conditions.push(eq(notes.isDeleted, options.isDeleted));
        }

        const result = await this.deps.db
          .select({ count: sql<number>`count(*)` })
          .from(notes)
          .where(conditions.length > 0 ? and(...conditions) : undefined);

        return result[0]?.count ?? 0;
      },
      { workspaceId: options?.workspaceId, notebookId: options?.notebookId },
    );
  }

  async exists(id: string): Promise<boolean> {
    return this.handle(
      'exists',
      async () => {
        const result = await this.deps.db
          .select({ id: notes.id })
          .from(notes)
          .where(eq(notes.id, id))
          .limit(1);

        return result.length > 0;
      },
      { noteId: id },
    );
  }

  async findRecentlyUpdated(limit: number, workspaceId?: string): Promise<NoteProps[]> {
    return this.handle(
      'findRecentlyUpdated',
      async () => {
        const conditions: any[] = [eq(notes.isDeleted, false)];

        if (workspaceId) {
          conditions.push(eq(notes.workspaceId, workspaceId));
        }

        const result = await this.deps.db
          .select()
          .from(notes)
          .where(and(...conditions))
          .orderBy(desc(notes.updatedAt))
          .limit(limit);

        return result.map((row) => this.toNoteProps(row));
      },
      { limit, workspaceId },
    );
  }

  async findFavorites(workspaceId?: string): Promise<NoteProps[]> {
    return this.handle(
      'findFavorites',
      async () => {
        const conditions: any[] = [eq(notes.isDeleted, false), eq(notes.isFavorite, true)];

        if (workspaceId) {
          conditions.push(eq(notes.workspaceId, workspaceId));
        }

        const result = await this.deps.db
          .select()
          .from(notes)
          .where(and(...conditions))
          .orderBy(desc(notes.updatedAt));

        return result.map((row) => this.toNoteProps(row));
      },
      { workspaceId },
    );
  }

  async findPinned(workspaceId?: string): Promise<NoteProps[]> {
    return this.handle(
      'findPinned',
      async () => {
        const conditions: any[] = [eq(notes.isDeleted, false), eq(notes.isPinned, true)];

        if (workspaceId) {
          conditions.push(eq(notes.workspaceId, workspaceId));
        }

        const result = await this.deps.db
          .select()
          .from(notes)
          .where(and(...conditions))
          .orderBy(desc(notes.updatedAt));

        return result.map((row) => this.toNoteProps(row));
      },
      { workspaceId },
    );
  }

  async findArchived(workspaceId?: string): Promise<NoteProps[]> {
    return this.handle(
      'findArchived',
      async () => {
        const conditions: any[] = [eq(notes.isDeleted, false), eq(notes.isArchived, true)];

        if (workspaceId) {
          conditions.push(eq(notes.workspaceId, workspaceId));
        }

        const result = await this.deps.db
          .select()
          .from(notes)
          .where(and(...conditions))
          .orderBy(desc(notes.updatedAt));

        return result.map((row) => this.toNoteProps(row));
      },
      { workspaceId },
    );
  }

  async findDeleted(workspaceId?: string): Promise<NoteProps[]> {
    return this.handle(
      'findDeleted',
      async () => {
        const conditions: any[] = [eq(notes.isDeleted, true)];

        if (workspaceId) {
          conditions.push(eq(notes.workspaceId, workspaceId));
        }

        const result = await this.deps.db
          .select()
          .from(notes)
          .where(and(...conditions))
          .orderBy(desc(notes.deletedAt));

        return result.map((row) => this.toNoteProps(row));
      },
      { workspaceId },
    );
  }

  // ============================================================================
  // Content Operations
  // ============================================================================

  async getContentById(id: string): Promise<string | null> {
    return this.handle(
      'getContentById',
      async () => {
        const noteProps = await this.deps.db
          .select()
          .from(notes)
          .where(eq(notes.id, id))
          .limit(1);
        if (!noteProps[0]?.filePath) {
          return null;
        }

        const workspacePath = this.deps.getWorkspacePath();
        if (!workspacePath) {
          return null;
        }

        const fullPath = `${workspacePath}/${noteProps[0].filePath}`;
        const exists = await this.deps.fileStorage.exists(fullPath);
        if (!exists) {
          return null;
        }

        const markdown = await this.deps.fileStorage.read(fullPath);
        if (!markdown) {
          return null;
        }
        const html = await this.deps.markdownProcessor.markdownToHtml(markdown);
        return html;
      },
      { noteId: id },
    );
  }

  // ============================================================================
  // Embedding Operations
  // ============================================================================

  async getEmbedding(noteId: string): Promise<number[] | null> {
    return this.handle(
      'getEmbedding',
      async () => {
        try {
          const result = await this.deps.db
            .select({ embedding: notes.embedding })
            .from(notes)
            .where(eq(notes.id, noteId))
            .limit(1);

          if (!result[0]?.embedding || !(result[0].embedding instanceof Buffer)) {
            return null;
          }

          // Embedding is stored as blob - convert to number array
          const buffer = result[0].embedding;
          const floats = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
          return Array.from(floats);
        } catch {
          return null;
        }
      },
      { noteId },
    );
  }

  async updateEmbedding(noteId: string, embedding: number[] | null): Promise<void> {
    return this.handle(
      'updateEmbedding',
      async () => {
        let embeddingBlob: Buffer | null = null;

        if (embedding) {
          const floats = new Float32Array(embedding);
          embeddingBlob = Buffer.from(floats.buffer);
        }

        await this.deps.db
          .update(notes)
          .set({ embedding: embeddingBlob })
          .where(eq(notes.id, noteId));
      },
      { noteId, hasEmbedding: embedding !== null },
    );
  }

  async findBySimilarity(
    embedding: number[],
    limit: number,
    workspaceId?: string,
  ): Promise<Array<{ noteId: string; title: string; distance: number }>> {
    return this.handle(
      'findBySimilarity',
      async () => {
        // Build query conditions
        const conditions: any[] = [eq(notes.isDeleted, false)];
        if (workspaceId) {
          conditions.push(eq(notes.workspaceId, workspaceId));
        }

        // Get notes with embeddings matching conditions
        const allNotes = await this.deps.db
          .select({
            id: notes.id,
            title: notes.title,
            embedding: notes.embedding,
          })
          .from(notes)
          .where(and(...conditions));

        const results: Array<{ noteId: string; title: string; distance: number }> = [];

        for (const row of allNotes) {
          if (!row.embedding) continue;

          try {
            const buffer = row.embedding as Buffer;
            const floats = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
            const stored = Array.from(floats);
            const distance = this.cosineSimilarity(embedding, stored);
            results.push({ noteId: row.id, title: row.title ?? 'Untitled', distance });
          } catch {
            continue;
          }
        }

        // Sort by similarity (higher is better) and take top N
        results.sort((a, b) => b.distance - a.distance);
        return results.slice(0, limit);
      },
      { limit, workspaceId },
    );
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private toNoteProps(row: typeof notes.$inferSelect): NoteProps {
    return {
      id: row.id,
      title: row.title ?? 'Untitled',
      notebookId: row.notebookId ?? null,
      workspaceId: row.workspaceId ?? null,
      filePath: row.filePath ?? null,
      isFavorite: row.isFavorite ?? false,
      isPinned: row.isPinned ?? false,
      isArchived: row.isArchived ?? false,
      isDeleted: row.isDeleted ?? false,
      deletedAt: row.deletedAt ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private getOrderColumn(field: 'createdAt' | 'updatedAt' | 'title') {
    switch (field) {
      case 'createdAt':
        return notes.createdAt;
      case 'title':
        return notes.title;
      case 'updatedAt':
      default:
        return notes.updatedAt;
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}
