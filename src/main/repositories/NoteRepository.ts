/**
 * NoteRepository - Handles all note-related database operations
 */

import { eq, and, sql, desc, asc, or, isNull } from 'drizzle-orm';
import { getDatabaseManager } from '../database/DatabaseManager';
import { notes, noteTags, tags, noteLinks, noteVersions, attachments } from '../database/schema';
import type { Note } from '@shared/types';
import { generateId } from '@shared/utils/id';

/**
 * Note Repository
 */
export class NoteRepository {
  private db = getDatabaseManager().getDrizzle();

  /**
   * Find all notes with optional filtering
   */
  async findAll(options?: {
    where?: Partial<Note>;
    sort?: { field: keyof Note; order: 'ASC' | 'DESC' };
    limit?: number;
    offset?: number;
  }): Promise<Note[]> {
    // For complex queries, use simpler approach to avoid Drizzle type issues
    if (options?.where || options?.sort) {
      // Use a more targeted approach for filtered queries
      return this.findAllFiltered(options);
    }

    // Simple case - just get all notes with default sorting
    let query = this.db.select().from(notes).orderBy(desc(notes.updatedAt));

    if (options?.limit) {
      query = (query as any).limit(options.limit);
    }
    if (options?.offset) {
      query = (query as any).offset(options.offset);
    }

    const result = await query;
    return result as Note[];
  }

  /**
   * Find all notes with filtering - separate method to avoid complex types
   */
  private async findAllFiltered(options?: {
    where?: Partial<Note>;
    sort?: { field: keyof Note; order: 'ASC' | 'DESC' };
    limit?: number;
    offset?: number;
  }): Promise<Note[]> {
    let query = this.db.select().from(notes);

    // Add WHERE clause - handle each field explicitly
    if (options?.where) {
      const conditions = [];

      if (options.where.id !== undefined) {
        conditions.push(eq(notes.id, options.where.id));
      }
      if (options.where.title !== undefined && options.where.title !== null) {
        conditions.push(eq(notes.title, options.where.title));
      }
      if (options.where.content !== undefined && options.where.content !== null) {
        conditions.push(eq(notes.content, options.where.content));
      }
      if (options.where.notebookId !== undefined) {
        if (options.where.notebookId === null) {
          conditions.push(isNull(notes.notebookId));
        } else {
          conditions.push(eq(notes.notebookId, options.where.notebookId));
        }
      }
      if (options.where.isFavorite !== undefined && options.where.isFavorite !== null) {
        conditions.push(eq(notes.isFavorite, options.where.isFavorite));
      }
      if (options.where.isPinned !== undefined && options.where.isPinned !== null) {
        conditions.push(eq(notes.isPinned, options.where.isPinned));
      }
      if (options.where.isArchived !== undefined && options.where.isArchived !== null) {
        conditions.push(eq(notes.isArchived, options.where.isArchived));
      }
      if (options.where.isDeleted !== undefined && options.where.isDeleted !== null) {
        conditions.push(eq(notes.isDeleted, options.where.isDeleted));
      }
      if (options.where.deletedAt !== undefined) {
        if (options.where.deletedAt === null) {
          conditions.push(isNull(notes.deletedAt));
        } else {
          conditions.push(eq(notes.deletedAt, options.where.deletedAt));
        }
      }
      if (options.where.createdAt !== undefined) {
        conditions.push(eq(notes.createdAt, options.where.createdAt));
      }
      if (options.where.updatedAt !== undefined) {
        conditions.push(eq(notes.updatedAt, options.where.updatedAt));
      }

      if (conditions.length > 0) {
        query = (query as any).where(and(...conditions));
      }
    }

    // Add ORDER BY - handle each field explicitly
    if (options?.sort) {
      let orderByColumn;
      switch (options.sort.field) {
        case 'id':
          orderByColumn = options.sort.order === 'DESC' ? desc(notes.id) : asc(notes.id);
          break;
        case 'title':
          orderByColumn = options.sort.order === 'DESC' ? desc(notes.title) : asc(notes.title);
          break;
        case 'content':
          orderByColumn = options.sort.order === 'DESC' ? desc(notes.content) : asc(notes.content);
          break;
        case 'notebookId':
          orderByColumn =
            options.sort.order === 'DESC' ? desc(notes.notebookId) : asc(notes.notebookId);
          break;
        case 'isFavorite':
          orderByColumn =
            options.sort.order === 'DESC' ? desc(notes.isFavorite) : asc(notes.isFavorite);
          break;
        case 'isPinned':
          orderByColumn =
            options.sort.order === 'DESC' ? desc(notes.isPinned) : asc(notes.isPinned);
          break;
        case 'isArchived':
          orderByColumn =
            options.sort.order === 'DESC' ? desc(notes.isArchived) : asc(notes.isArchived);
          break;
        case 'isDeleted':
          orderByColumn =
            options.sort.order === 'DESC' ? desc(notes.isDeleted) : asc(notes.isDeleted);
          break;
        case 'deletedAt':
          orderByColumn =
            options.sort.order === 'DESC' ? desc(notes.deletedAt) : asc(notes.deletedAt);
          break;
        case 'createdAt':
          orderByColumn =
            options.sort.order === 'DESC' ? desc(notes.createdAt) : asc(notes.createdAt);
          break;
        case 'updatedAt':
          orderByColumn =
            options.sort.order === 'DESC' ? desc(notes.updatedAt) : asc(notes.updatedAt);
          break;
        default:
          orderByColumn = desc(notes.updatedAt);
      }
      query = (query as any).orderBy(orderByColumn);
    } else {
      query = (query as any).orderBy(desc(notes.updatedAt));
    }

    // Add LIMIT and OFFSET
    if (options?.limit) {
      query = (query as any).limit(options.limit);
    }
    if (options?.offset) {
      query = (query as any).offset(options.offset);
    }

    const result = await (query as any);
    return result as Note[];
  }

  /**
   * Create a new note
   */
  async create(data: Partial<Note>): Promise<Note> {
    const id = generateId();
    const now = new Date();

    const noteData = {
      id,
      title: data.title ?? 'Untitled',
      content: data.content ?? '',
      notebookId: data.notebookId ?? null,
      isFavorite: data.isFavorite ?? false,
      isPinned: data.isPinned ?? false,
      isArchived: data.isArchived ?? false,
      isDeleted: data.isDeleted ?? false,
      deletedAt: data.deletedAt ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.insert(notes).values(noteData);

    const result = await this.findById(id);
    if (!result) throw new Error('Failed to create note');
    return result;
  }

  /**
   * Update a note
   */
  async update(id: string, data: Partial<Note>): Promise<Note> {
    const now = new Date();

    const updateData = {
      ...data,
      updatedAt: now,
    };

    // Remove undefined values
    Object.keys(updateData).forEach((key) => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData];
      }
    });

    await this.db.update(notes).set(updateData).where(eq(notes.id, id));

    const result = await this.findById(id);
    if (!result) throw new Error('Note not found after update');
    return result;
  }

  /**
   * Delete a note
   */
  async delete(id: string): Promise<boolean> {
    await this.db.delete(notes).where(eq(notes.id, id));
    return true; // Assume success if no error thrown
  }

  /**
   * Count notes with optional filtering
   */
  async count(where?: Partial<Note>): Promise<number> {
    // For now, use findAll and count the results
    const results = await this.findAll({ where });
    return results.length;
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    return await this.db.transaction(callback);
  }

  /**
   * Find notes by notebook
   */
  async findByNotebook(notebookId: string): Promise<Note[]> {
    return await this.findAll({
      where: { notebookId: notebookId, isDeleted: false },
      sort: { field: 'updatedAt', order: 'DESC' },
    });
  }

  /**
   * Find a note by ID
   */
  async findById(id: string): Promise<Note | null> {
    const result = await this.db.select().from(notes).where(eq(notes.id, id)).limit(1);

    if (result.length === 0) return null;

    return result[0];
  }

  /**
   * Full-text search (placeholder - FTS not implemented in Drizzle yet)
   */
  async searchFullText(query: string, limit: number = 50): Promise<Note[]> {
    // For now, use simple LIKE search
    const searchPattern = `%${query}%`;
    return await this.findAll({
      where: { isDeleted: false },
      sort: { field: 'updatedAt', order: 'DESC' },
      limit,
    }).then((notes) =>
      notes.filter(
        (note) =>
          (note.title?.toLowerCase().includes(query.toLowerCase()) ?? false) ||
          (note.content?.toLowerCase().includes(query.toLowerCase()) ?? false),
      ),
    );
  }

  /**
   * Get favorite notes
   */
  async getFavorites(): Promise<Note[]> {
    return await this.findAll({
      where: { isFavorite: true, isDeleted: false },
      sort: { field: 'updatedAt', order: 'DESC' },
    });
  }

  /**
   * Get pinned notes
   */
  async getPinned(): Promise<Note[]> {
    return await this.findAll({
      where: { isPinned: true, isDeleted: false },
      sort: { field: 'updatedAt', order: 'DESC' },
    });
  }

  /**
   * Get recent notes
   */
  async getRecent(limit: number = 20): Promise<Note[]> {
    return await this.findAll({
      where: { isDeleted: false },
      sort: { field: 'updatedAt', order: 'DESC' },
      limit,
    });
  }

  /**
   * Get deleted notes (trash)
   */
  async getDeleted(): Promise<Note[]> {
    return await this.findAll({
      where: { isDeleted: true },
      sort: { field: 'deletedAt', order: 'DESC' },
    });
  }

  /**
   * Get archived notes
   */
  async getArchived(): Promise<Note[]> {
    return await this.findAll({
      where: { isArchived: true, isDeleted: false },
      sort: { field: 'updatedAt', order: 'DESC' },
    });
  }

  /**
   * Soft delete a note
   */
  async softDelete(id: string): Promise<Note> {
    const now = new Date();
    return await this.update(id, {
      isDeleted: true,
      deletedAt: now,
    } as Partial<Note>);
  }

  /**
   * Restore a deleted note
   */
  async restore(id: string): Promise<Note> {
    return await this.update(id, {
      isDeleted: false,
      deletedAt: null,
    } as Partial<Note>);
  }

  /**
   * Permanently delete a note and all related data
   */
  async permanentDelete(id: string): Promise<boolean> {
    return await this.transaction(async () => {
      // Delete attachments
      await this.db.delete(attachments).where(eq(attachments.noteId, id));

      // Delete versions
      await this.db.delete(noteVersions).where(eq(noteVersions.noteId, id));

      // Delete tags associations
      await this.db.delete(noteTags).where(eq(noteTags.noteId, id));

      // Delete links
      await this.db
        .delete(noteLinks)
        .where(or(eq(noteLinks.sourceNoteId, id), eq(noteLinks.targetNoteId, id)));

      // Delete the note
      return await this.delete(id);
    });
  }

  /**
   * Toggle favorite status
   */
  async toggleFavorite(id: string): Promise<Note> {
    const note = await this.findById(id);
    if (!note) throw new Error('Note not found');

    return await this.update(id, {
      isFavorite: !note.isFavorite,
    } as Partial<Note>);
  }

  /**
   * Toggle pin status
   */
  async togglePin(id: string): Promise<Note> {
    const note = await this.findById(id);
    if (!note) throw new Error('Note not found');

    return await this.update(id, {
      isPinned: !note.isPinned,
    } as Partial<Note>);
  }

  /**
   * Toggle archive status
   */
  async toggleArchive(id: string): Promise<Note> {
    const note = await this.findById(id);
    if (!note) throw new Error('Note not found');

    return await this.update(id, {
      isArchived: !note.isArchived,
    } as Partial<Note>);
  }

  /**
   * Get backlinks for a note
   */
  async getBacklinks(noteId: string): Promise<Note[]> {
    const result = await this.db
      .select()
      .from(notes)
      .innerJoin(noteLinks, eq(notes.id, noteLinks.sourceNoteId))
      .where(and(eq(noteLinks.targetNoteId, noteId), eq(notes.isDeleted, false)))
      .orderBy(desc(notes.updatedAt));

    return result.map((row) => row.notes) as Note[];
  }

  /**
   * Get forward links from a note
   */
  async getForwardLinks(noteId: string): Promise<Note[]> {
    const result = await this.db
      .select()
      .from(notes)
      .innerJoin(noteLinks, eq(notes.id, noteLinks.targetNoteId))
      .where(and(eq(noteLinks.sourceNoteId, noteId), eq(notes.isDeleted, false)))
      .orderBy(desc(notes.updatedAt));

    return result.map((row) => row.notes) as Note[];
  }

  /**
   * Add a link between two notes
   */
  async addLink(sourceId: string, targetId: string): Promise<void> {
    const now = new Date();

    await this.db
      .insert(noteLinks)
      .values({
        sourceNoteId: sourceId,
        targetNoteId: targetId,
        createdAt: now,
      })
      .onConflictDoNothing();
  }

  /**
   * Remove a link between two notes
   */
  async removeLink(sourceId: string, targetId: string): Promise<void> {
    await this.db
      .delete(noteLinks)
      .where(and(eq(noteLinks.sourceNoteId, sourceId), eq(noteLinks.targetNoteId, targetId)));
  }

  /**
   * Get notes with specific tags (AND logic)
   */
  async findByTags(tagIds: string[]): Promise<Note[]> {
    if (tagIds.length === 0) return [];

    // This is complex with Drizzle - for now use a simpler approach
    const result = await this.db
      .select()
      .from(notes)
      .innerJoin(noteTags, eq(notes.id, noteTags.noteId))
      .where(and(sql`${noteTags.tagId} IN ${tagIds}`, eq(notes.isDeleted, false)))
      .groupBy(notes.id)
      .having(sql`COUNT(DISTINCT ${noteTags.tagId}) = ${tagIds.length}`)
      .orderBy(desc(notes.updatedAt));

    return result.map((row) => row.notes) as Note[];
  }

  /**
   * Get notes created within a date range
   */
  async findByDateRange(
    startDate: Date,
    endDate: Date,
    field: 'createdAt' | 'updatedAt' = 'createdAt',
  ): Promise<Note[]> {
    const column = field === 'createdAt' ? notes.createdAt : notes.updatedAt;

    return await this.findAll({
      where: { isDeleted: false },
      sort: { field, order: 'DESC' },
    }).then((notes) =>
      notes.filter((note) => {
        const timestamp = note[field];
        return timestamp >= startDate && timestamp <= endDate;
      }),
    );
  }
}
