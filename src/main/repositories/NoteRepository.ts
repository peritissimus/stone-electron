/**
 * NoteRepository - Handles all note-related database operations
 */

import { eq, and, sql, desc, asc, or, isNull } from 'drizzle-orm';
import { getDatabaseManager } from '../database/DatabaseManager';
import { notes, noteTags, tags, noteLinks, noteVersions, attachments } from '../database/schema';
import type { Note } from '@shared/types';
import { generateId } from '@shared/utils/id';
import { getFileSystemService } from '../services/FileSystemService';
import { getMarkdownService } from '../services/MarkdownService';
import { WorkspaceRepository } from './WorkspaceRepository';
import path from 'path';

/**
 * Note Repository
 */
export class NoteRepository {
  private db = getDatabaseManager().getDrizzle();
  private fileSystemService = getFileSystemService();
  private markdownService = getMarkdownService();
  private workspaceRepository = new WorkspaceRepository();

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
    const title = data.title ?? 'Untitled';

    // Check if we have an active workspace
    const activeWorkspace = await this.workspaceRepository.getActive();

    let noteData: any = {
      id,
      title,
      notebookId: data.notebookId ?? null,
      isFavorite: data.isFavorite ?? false,
      isPinned: data.isPinned ?? false,
      isArchived: data.isArchived ?? false,
      isDeleted: data.isDeleted ?? false,
      deletedAt: data.deletedAt ?? null,
      createdAt: now,
      updatedAt: now,
    };

    // If we have an active workspace, store as markdown file
    if (activeWorkspace) {
      try {
        // Determine the target folder (notebook folder or workspace root)
        let targetFolder = activeWorkspace.folderPath;

        if (data.notebookId) {
          // TODO: Get notebook's folder path and use it
          // For now, just use workspace root
        }

        // Generate unique filename
        const filename = await this.fileSystemService.generateUniqueFilename(
          targetFolder,
          title,
          '.md'
        );
        const relativePath = filename;

        // Save content to file
        const content = data.content ?? '';
        await this.saveContentToFile(relativePath, activeWorkspace.id, content, {
          tags: [], // TODO: Get tags from note
          favorite: data.isFavorite ?? undefined,
          pinned: data.isPinned ?? undefined,
        });

        // Store file path and workspace ID, but not content
        noteData = {
          ...noteData,
          filePath: relativePath,
          workspaceId: activeWorkspace.id,
          content: null, // Content lives in file
        };
      } catch (error) {
        console.error('Error creating markdown file, falling back to database storage:', error);
        // Fall back to database storage
        noteData.content = data.content ?? '';
      }
    } else {
      // No active workspace - store in database only (legacy mode)
      noteData.content = data.content ?? '';
    }

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

    // Get the existing note to check if it has a file
    const existingNote = await this.findById(id);
    if (!existingNote) throw new Error('Note not found');

    const updateData: any = {
      ...data,
      updatedAt: now,
    };

    // Remove undefined values
    Object.keys(updateData).forEach((key) => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData];
      }
    });

    // If note has a file path and workspace, update the file
    if (existingNote.filePath && existingNote.workspaceId) {
      try {
        // Handle title change -> file rename
        if (data.title && data.title !== existingNote.title) {
          const workspace = await this.workspaceRepository.findById(existingNote.workspaceId);
          if (workspace) {
            const oldFilePath = existingNote.filePath;
            const dirPath = path.dirname(path.join(workspace.folderPath, oldFilePath));
            const newFilename = await this.fileSystemService.generateUniqueFilename(
              dirPath,
              data.title,
              '.md'
            );

            // Get relative path from workspace root
            const newRelativePath = path.relative(workspace.folderPath, path.join(dirPath, newFilename));

            // Rename the file
            await this.renameMarkdownFile(oldFilePath, newRelativePath, existingNote.workspaceId);

            // Update the file path in database
            updateData.filePath = newRelativePath;
          }
        }

        // If content is being updated, write to file
        if (data.content !== undefined && data.content !== null && existingNote.workspaceId && (updateData.filePath || existingNote.filePath)) {
          const filePathToUse = updateData.filePath || existingNote.filePath!;
          const workspaceId = existingNote.workspaceId!;
          await this.saveContentToFile(filePathToUse, workspaceId, data.content, {
            tags: [], // TODO: Get tags
            favorite: (updateData.isFavorite ?? existingNote.isFavorite) || undefined,
            pinned: (updateData.isPinned ?? existingNote.isPinned) || undefined,
          });

          // Don't store content in database
          delete updateData.content;
        }
      } catch (error) {
        console.error('Error updating markdown file:', error);
        // Fall through to update database anyway
      }
    }

    await this.db.update(notes).set(updateData).where(eq(notes.id, id));

    const result = await this.findById(id);
    if (!result) throw new Error('Note not found after update');
    return result;
  }

  /**
   * Delete a note
   */
  async delete(id: string): Promise<boolean> {
    // Get note to check if it has a file
    const note = await this.findById(id);

    // Delete from database
    await this.db.delete(notes).where(eq(notes.id, id));

    // Delete markdown file if it exists
    if (note?.filePath && note.workspaceId) {
      await this.deleteMarkdownFile(note.filePath, note.workspaceId);
    }

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

    const note = result[0];

    // If note has a file path, read content from file system
    if (note.filePath && note.workspaceId) {
      const fileContent = await this.getContentFromFile(note.filePath, note.workspaceId);

      if (fileContent !== null) {
        // Return note with content from file
        return {
          ...note,
          content: fileContent,
        };
      } else {
        // File couldn't be read, fall back to database content
        console.warn(`Could not read file for note ${id}, using database content`);
      }
    }

    // Return note with database content (legacy notes or file read failed)
    return note;
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
      // Get note to check if it has a file (before deleting from DB)
      const note = await this.findById(id);

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

      // Delete from database
      await this.db.delete(notes).where(eq(notes.id, id));

      // Delete markdown file if it exists
      if (note?.filePath && note.workspaceId) {
        await this.deleteMarkdownFile(note.filePath, note.workspaceId);
      }

      return true;
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

  /**
   * Helper: Get content from markdown file
   */
  private async getContentFromFile(filePath: string, workspaceId: string): Promise<string | null> {
    try {
      const workspace = await this.workspaceRepository.findById(workspaceId);
      if (!workspace) {
        console.error(`Workspace not found: ${workspaceId}`);
        return null;
      }

      const absolutePath = path.join(workspace.folderPath, filePath);
      const markdownFile = await this.fileSystemService.readMarkdownFile(absolutePath);

      // Convert markdown to HTML for TipTap editor
      return await this.markdownService.markdownToHtml(markdownFile.content);
    } catch (error) {
      console.error(`Error reading content from file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Helper: Save content to markdown file
   */
  private async saveContentToFile(
    filePath: string,
    workspaceId: string,
    content: string,
    metadata?: {
      tags?: string[];
      favorite?: boolean;
      pinned?: boolean;
    }
  ): Promise<void> {
    try {
      const workspace = await this.workspaceRepository.findById(workspaceId);
      if (!workspace) {
        throw new Error(`Workspace not found: ${workspaceId}`);
      }

      const absolutePath = path.join(workspace.folderPath, filePath);

      // Convert HTML content to markdown
      const markdownContent = this.markdownService.htmlToMarkdown(content);

      await this.fileSystemService.writeMarkdownFile(absolutePath, markdownContent, metadata);
    } catch (error) {
      console.error(`Error saving content to file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Helper: Delete markdown file
   */
  private async deleteMarkdownFile(filePath: string, workspaceId: string): Promise<void> {
    try {
      const workspace = await this.workspaceRepository.findById(workspaceId);
      if (!workspace) {
        console.warn(`Workspace not found: ${workspaceId}, skipping file deletion`);
        return;
      }

      const absolutePath = path.join(workspace.folderPath, filePath);
      await this.fileSystemService.deleteMarkdownFile(absolutePath);
    } catch (error) {
      console.error(`Error deleting markdown file ${filePath}:`, error);
      // Don't throw - allow database deletion to proceed even if file is missing
    }
  }

  /**
   * Helper: Rename markdown file
   */
  private async renameMarkdownFile(
    oldFilePath: string,
    newFilePath: string,
    workspaceId: string
  ): Promise<void> {
    try {
      const workspace = await this.workspaceRepository.findById(workspaceId);
      if (!workspace) {
        throw new Error(`Workspace not found: ${workspaceId}`);
      }

      const oldAbsolutePath = path.join(workspace.folderPath, oldFilePath);
      const newAbsolutePath = path.join(workspace.folderPath, newFilePath);

      await this.fileSystemService.renameMarkdownFile(oldAbsolutePath, newAbsolutePath);
    } catch (error) {
      console.error(`Error renaming markdown file ${oldFilePath} to ${newFilePath}:`, error);
      throw error;
    }
  }

  /**
   * Sync notes with file system
   * Reconciles database entries with actual markdown files in workspace
   */
  async syncWithFileSystem(workspaceId: string): Promise<{
    created: number;
    updated: number;
    deleted: number;
    errors: string[];
  }> {
    const results = {
      created: 0,
      updated: 0,
      deleted: 0,
      errors: [] as string[],
    };

    try {
      const workspace = await this.workspaceRepository.findById(workspaceId);
      if (!workspace) {
        throw new Error(`Workspace not found: ${workspaceId}`);
      }

      // Scan workspace folder for all markdown files
      const filesOnDisk = await this.fileSystemService.scanFolder(workspace.folderPath, true);

      // Get all notes in this workspace from database
      const notesInDb = await this.findAll({
        where: { workspaceId, isDeleted: false },
      });

      // Create maps for efficient lookup
      const filesMap = new Map(filesOnDisk.map(f => [f.relativePath, f]));
      const notesMap = new Map(notesInDb.map(n => [n.filePath || '', n]));

      // Find files that exist on disk but not in database (CREATE)
      for (const file of filesOnDisk) {
        if (!notesMap.has(file.relativePath)) {
          try {
            // Create new note from file
            await this.create({
              title: file.title,
              content: await this.markdownService.markdownToHtml(file.content),
              workspaceId,
              filePath: file.relativePath,
              isFavorite: file.metadata?.favorite || false,
              isPinned: file.metadata?.pinned || false,
            });
            results.created++;
          } catch (error) {
            results.errors.push(`Failed to create note from ${file.relativePath}: ${error}`);
          }
        }
      }

      // Find notes in database whose files no longer exist (DELETE)
      for (const note of notesInDb) {
        if (note.filePath && !filesMap.has(note.filePath)) {
          try {
            // Soft delete the note
            await this.softDelete(note.id);
            results.deleted++;
          } catch (error) {
            results.errors.push(`Failed to delete note ${note.id}: ${error}`);
          }
        }
      }

      // Check for files that were renamed/moved (UPDATE)
      // This is more complex and may require content comparison or user input
      // For now, we'll just detect and report them as errors

      console.log('File system sync completed:', results);
      return results;
    } catch (error) {
      console.error('Error syncing with file system:', error);
      results.errors.push(`Sync failed: ${error}`);
      return results;
    }
  }
}
