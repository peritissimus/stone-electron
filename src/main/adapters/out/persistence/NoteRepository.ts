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

export interface NoteRepositoryDeps {
  db: Database;
  fileStorage: IFileStorage;
  markdownProcessor: IMarkdownProcessor;
  getWorkspacePath: () => string | null;
}

export class NoteRepository implements INoteRepository {
  constructor(private readonly deps: NoteRepositoryDeps) {}

  async findById(id: string): Promise<NoteProps | null> {
    const result = await this.deps.db.select().from(notes).where(eq(notes.id, id)).limit(1);

    return result[0] ? this.toNoteProps(result[0]) : null;
  }

  async findAll(options?: NoteFindOptions): Promise<NoteProps[]> {
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
  }

  async findByNotebookId(notebookId: string | null, workspaceId?: string): Promise<NoteProps[]> {
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
  }

  async findByWorkspaceId(workspaceId: string): Promise<NoteProps[]> {
    const result = await this.deps.db
      .select()
      .from(notes)
      .where(and(eq(notes.workspaceId, workspaceId), eq(notes.isDeleted, false)))
      .orderBy(desc(notes.updatedAt));

    return result.map((row) => this.toNoteProps(row));
  }

  async findByFilePath(filePath: string, workspaceId?: string): Promise<NoteProps | null> {
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
  }

  async save(note: NoteEntity): Promise<void> {
    const props = note.toPersistence();
    const existing = await this.findById(props.id);

    if (existing) {
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
  }

  async delete(id: string): Promise<void> {
    await this.deps.db.delete(notes).where(eq(notes.id, id));
  }

  async searchByTitle(options: NoteSearchOptions): Promise<NoteProps[]> {
    const conditions: any[] = [eq(notes.isDeleted, false), like(notes.title, `%${options.query}%`)];

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
  }

  async count(options?: NoteFindOptions): Promise<number> {
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
  }

  async exists(id: string): Promise<boolean> {
    const result = await this.deps.db
      .select({ id: notes.id })
      .from(notes)
      .where(eq(notes.id, id))
      .limit(1);

    return result.length > 0;
  }

  async findRecentlyUpdated(limit: number, workspaceId?: string): Promise<NoteProps[]> {
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
  }

  async findFavorites(workspaceId?: string): Promise<NoteProps[]> {
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
  }

  async findPinned(workspaceId?: string): Promise<NoteProps[]> {
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
  }

  async findArchived(workspaceId?: string): Promise<NoteProps[]> {
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
  }

  async findDeleted(workspaceId?: string): Promise<NoteProps[]> {
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
  }

  // ============================================================================
  // Content Operations
  // ============================================================================

  async getContentById(id: string): Promise<string | null> {
    const noteProps = await this.findById(id);
    if (!noteProps?.filePath) {
      return null;
    }

    const workspacePath = this.deps.getWorkspacePath();
    if (!workspacePath) {
      return null;
    }

    const fullPath = `${workspacePath}/${noteProps.filePath}`;
    const exists = await this.deps.fileStorage.exists(fullPath);
    if (!exists) {
      return null;
    }

    const markdown = await this.deps.fileStorage.read(fullPath);
    const html = await this.deps.markdownProcessor.markdownToHtml(markdown);
    return html;
  }

  // ============================================================================
  // Embedding Operations
  // ============================================================================

  async getEmbedding(noteId: string): Promise<number[] | null> {
    const result = await this.deps.db
      .select({ embedding: notes.embedding })
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1);

    if (!result[0]?.embedding) {
      return null;
    }

    // Embedding is stored as blob - convert to number array
    try {
      const buffer = result[0].embedding as Buffer;
      const floats = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
      return Array.from(floats);
    } catch {
      return null;
    }
  }

  async updateEmbedding(noteId: string, embedding: number[] | null): Promise<void> {
    let embeddingBlob: Buffer | null = null;

    if (embedding) {
      const floats = new Float32Array(embedding);
      embeddingBlob = Buffer.from(floats.buffer);
    }

    await this.deps.db.update(notes).set({ embedding: embeddingBlob }).where(eq(notes.id, noteId));
  }

  async findBySimilarity(
    embedding: number[],
    limit: number,
    workspaceId?: string,
  ): Promise<Array<{ noteId: string; title: string; distance: number }>> {
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
