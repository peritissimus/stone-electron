/**
 * NoteRepository - Handles all note-related database operations
 */

import { eq, and, sql, desc, asc, or } from 'drizzle-orm';
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
    let query = this.db.select().from(notes);

    // Add WHERE clause
    if (options?.where) {
      const conditions = Object.entries(options.where)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => {
          const column = notes[key as keyof typeof notes];
          return eq(column, value);
        });

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }

    // Add ORDER BY
    if (options?.sort) {
      const column = notes[options.sort.field as keyof typeof notes];
      query = query.orderBy(options.sort.order === 'DESC' ? desc(column) : asc(column));
    } else {
      query = query.orderBy(desc(notes.updatedAt));
    }

    // Add LIMIT and OFFSET
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.offset(options.offset);
    }

    const result = await query;
    return result as Note[];
  }

  /**
   * Create a new note
   */
  async create(data: Partial<Note>): Promise<Note> {
    const id = generateId();
    const now = Math.floor(Date.now() / 1000);

    const noteData = {
      id,
      title: data.title ?? 'Untitled',
      content: data.content ?? '',
      notebookId: data.notebookId ?? null,
      isFavorite: data.isFavorite ?? false,
      isPinned: data.isPinned ?? false,
      isArchived: data.isArchived ?? false,
      isDeleted: data.isDeleted ?? false,
      deletedAt: data.deleted_at ?? null,
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
    const now = Math.floor(Date.now() / 1000);

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
    const result = await this.db.delete(notes).where(eq(notes.id, id));

    return result.rowCount > 0;
  }

  /**
   * Count notes with optional filtering
   */
  async count(where?: Partial<Note>): Promise<number> {
    let query = this.db.select({ count: sql<number>`COUNT(*)` }).from(notes);

    if (where) {
      const conditions = Object.entries(where)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => {
          const column = notes[key as keyof typeof notes];
          return eq(column, value);
        });

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }

    const result = await query;
    return result[0]?.count ?? 0;
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

    const note = result[0];
    return {
      ...note,
      id: note.id as any, // Cast UUID type
      created_at:
        note.created_at instanceof Date
          ? Math.floor(note.created_at.getTime() / 1000)
          : note.created_at,
      updated_at:
        note.updated_at instanceof Date
          ? Math.floor(note.updated_at.getTime() / 1000)
          : note.updated_at,
      deleted_at:
        note.deleted_at instanceof Date
          ? Math.floor(note.deleted_at.getTime() / 1000)
          : note.deleted_at,
      isFavorite: note.isFavorite ? 1 : 0,
      isPinned: note.isPinned ? 1 : 0,
      isArchived: note.isArchived ? 1 : 0,
      isDeleted: note.isDeleted ? 1 : 0,
    } as Note;
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
          note.title.toLowerCase().includes(query.toLowerCase()) ||
          note.content.toLowerCase().includes(query.toLowerCase()),
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
    const now = Math.floor(Date.now() / 1000);
    return await this.update(id, {
      isDeleted: true,
      deleted_at: now,
    } as Partial<Note>);
  }

  /**
   * Restore a deleted note
   */
  async restore(id: string): Promise<Note> {
    return await this.update(id, {
      isDeleted: false,
      deleted_at: null,
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
    const now = Math.floor(Date.now() / 1000);

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
    startDate: number,
    endDate: number,
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
