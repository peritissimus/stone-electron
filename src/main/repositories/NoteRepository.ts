/**
 * NoteRepository - Handles all note-related database operations
 */

import { eq, and, sql, desc, asc, or, isNull } from 'drizzle-orm';
import { getDatabaseManager } from '../database/DatabaseManager';
import {
  notes,
  noteTags,
  tags,
  noteLinks,
  noteVersions,
  attachments,
  notebooks,
} from '../database/schema';
import type { Note } from '@shared/types';
import { generateId } from '@shared/utils/id';
import { getFileSystemService } from '../services/FileSystemService';
import { getMarkdownService } from '../services/MarkdownService';
import { WorkspaceRepository } from './WorkspaceRepository';
import { logger } from '../utils/logger';
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
      if (options.where.workspaceId !== undefined) {
        if (options.where.workspaceId === null) {
          conditions.push(isNull(notes.workspaceId));
        } else {
          conditions.push(eq(notes.workspaceId, options.where.workspaceId));
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
    const title =
      data.title && data.title.trim().length > 0 ? data.title : 'Untitled';
    const requestedFolder = this.normalizeFolderPath((data as any).folderPath);

    // Check if we have an active workspace
    const activeWorkspace = await this.workspaceRepository.getActive();

    let noteData: any = {
      id,
      title,
      notebookId: null,
      isFavorite: data.isFavorite ?? false,
      isPinned: data.isPinned ?? false,
      isArchived: data.isArchived ?? false,
      isDeleted: data.isDeleted ?? false,
      deletedAt: data.deletedAt ?? null,
      createdAt: now,
      updatedAt: now,
    };

    // If creating from an existing file, just link it (no write)
    if (data.filePath && data.workspaceId) {
      noteData = {
        ...noteData,
        filePath: data.filePath,
        workspaceId: data.workspaceId,
        content: null,
      };
    } else if (activeWorkspace) {
      noteData.workspaceId = activeWorkspace.id;
      try {
        // Determine the target folder (notebook folder or workspace root)
        let relativeFolder = requestedFolder;

        if (!relativeFolder && data.notebookId) {
          const notebook = await this.getNotebookInfo(data.notebookId);
          if (!notebook) {
            throw new Error('Notebook not found');
          }
          if (notebook.workspaceId && notebook.workspaceId !== activeWorkspace.id) {
            throw new Error('Notebook belongs to a different workspace');
          }
          relativeFolder = (notebook.folderPath || '').replace(/\\/g, '/');
        }

        const targetFolderAbsolute = relativeFolder
          ? path.join(activeWorkspace.folderPath, relativeFolder)
          : activeWorkspace.folderPath;

        // Generate unique filename
        const filename = await this.fileSystemService.generateUniqueFilename(
          targetFolderAbsolute,
          title,
          '.md',
        );
        const relativePath = relativeFolder
          ? path.posix.join(relativeFolder, filename)
          : filename;

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

    const requestedFolder = (data as any).folderPath !== undefined
      ? this.normalizeFolderPath((data as any).folderPath)
      : undefined;

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
        const workspace = await this.workspaceRepository.findById(existingNote.workspaceId);
        if (workspace) {
          const currentRelativePath = updateData.filePath || existingNote.filePath;
          const currentFolder = currentRelativePath.includes('/')
            ? currentRelativePath.slice(0, currentRelativePath.lastIndexOf('/'))
            : '';

          let targetFolderRelative = currentFolder;

          if (requestedFolder !== undefined) {
            targetFolderRelative = requestedFolder;
            updateData.notebookId = null;
          } else if (data.notebookId !== undefined) {
            const targetNotebook = data.notebookId
              ? await this.getNotebookInfo(data.notebookId)
              : null;
            if (
              targetNotebook &&
              targetNotebook.workspaceId &&
              targetNotebook.workspaceId !== workspace.id
            ) {
              throw new Error('Target notebook belongs to a different workspace');
            }
            targetFolderRelative = targetNotebook?.folderPath
              ? targetNotebook.folderPath.replace(/\\/g, '/')
              : '';
            updateData.notebookId = data.notebookId ?? null;
          }

          const targetDirAbsolute =
            targetFolderRelative && targetFolderRelative.length > 0
              ? path.join(workspace.folderPath, targetFolderRelative)
              : workspace.folderPath;

          let filename = path.basename(currentRelativePath);

          if (data.title && data.title !== existingNote.title) {
            filename = await this.fileSystemService.generateUniqueFilename(
              targetDirAbsolute,
              data.title,
              '.md',
            );
          }

          const newRelativePath =
            targetFolderRelative && targetFolderRelative.length > 0
              ? path.posix.join(targetFolderRelative, filename)
              : filename;

          if (newRelativePath !== currentRelativePath) {
            await this.renameMarkdownFile(currentRelativePath, newRelativePath, existingNote.workspaceId);
            updateData.filePath = newRelativePath;
          }
        }

        // If content is being updated, write to file
        if (
          data.content !== undefined &&
          data.content !== null &&
          existingNote.workspaceId &&
          (updateData.filePath || existingNote.filePath)
        ) {
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
   * Find notes by folder path (manual)
   */
  async findByFolder(folderPath: string, includeSubfolders: boolean = true): Promise<Note[]> {
    const activeWs = await this.workspaceRepository.getActive();
    const wsId = activeWs?.id;

    if (!folderPath || folderPath === '.' || folderPath.trim() === '') {
      const conditions: any[] = [eq(notes.isDeleted, false) as any];
      if (wsId) conditions.push(eq(notes.workspaceId, wsId) as any);
      const result = await (this.db as any)
        .select()
        .from(notes)
        .where((conditions.length > 1 ? and(...conditions) : conditions[0]) as any)
        .orderBy(desc(notes.updatedAt));
      return result as Note[];
    }

    const normalized = folderPath.replace(/\\/g, '/');
    const pattern = includeSubfolders ? `${normalized}/%` : `${normalized}`;
    const likeCondition = includeSubfolders
      ? sql`${notes.filePath} LIKE ${pattern}`
      : sql`${notes.filePath} LIKE ${pattern}`;

    const conditions: any[] = [eq(notes.isDeleted, false) as any, likeCondition as any];
    if (wsId) conditions.push(eq(notes.workspaceId, wsId) as any);
    const result = await (this.db as any)
      .select()
      .from(notes)
      .where(and(...conditions) as any)
      .orderBy(desc(notes.updatedAt));
    return result as Note[];
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
      const fileContent = await this.getContentFromFile(note.id, note.filePath, note.workspaceId);

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

    return result.map((row: { notes: Note }) => row.notes);
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

    return result.map((row: { notes: Note }) => row.notes);
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

    return result.map((row: { notes: Note }) => row.notes);
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

  private normalizeFolderPath(folderPath?: string | null): string {
    if (!folderPath) return '';
    return folderPath
      .replace(/\\/g, '/')
      .replace(/^\.\//, '')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '');
  }

  /**
   * Helper: Fetch minimal notebook information
   */
  private async getNotebookInfo(
    notebookId: string,
  ): Promise<{ id: string; workspaceId: string | null; folderPath: string | null } | null> {
    const result = await this.db
      .select({
        id: notebooks.id,
        workspaceId: notebooks.workspaceId,
        folderPath: notebooks.folderPath,
      })
      .from(notebooks)
      .where(eq(notebooks.id, notebookId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return result[0];
  }

  /**
   * Helper: Get content from markdown file
   */
  private async getContentFromFile(
    noteId: string,
    filePath: string,
    workspaceId: string,
  ): Promise<string | null> {
    try {
      const workspace = await this.workspaceRepository.findById(workspaceId);
      if (!workspace) {
        console.error(`Workspace not found: ${workspaceId}`);
        return null;
      }

      let relativePath = filePath.replace(/\\/g, '/');
      let absolutePath = path.join(workspace.folderPath, relativePath);

      const fileExists = await this.fileSystemService.fileExists(absolutePath);

      if (!fileExists) {
        const scannedFiles = await this.fileSystemService.scanFolder(workspace.folderPath, true);
        const exactMatch = scannedFiles.find(
          (file) => file.relativePath.replace(/\\/g, '/') === relativePath,
        );

        const basenameMatch = exactMatch
          ? exactMatch
          : scannedFiles.find(
              (file) => path.basename(file.relativePath) === path.basename(relativePath),
            );

        if (basenameMatch) {
          relativePath = basenameMatch.relativePath.replace(/\\/g, '/');
          absolutePath = path.join(workspace.folderPath, relativePath);
          await this.db
            .update(notes)
            .set({ filePath: relativePath, updatedAt: new Date() })
            .where(eq(notes.id, noteId));
        } else {
          return null;
        }
      }

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
    },
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
    workspaceId: string,
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
      logger.info(`[NoteRepository] 🔄 Starting file system sync for workspace: ${workspaceId}`);

      const workspace = await this.workspaceRepository.findById(workspaceId);
      if (!workspace) {
        throw new Error(`Workspace not found: ${workspaceId}`);
      }

      logger.info(`[NoteRepository] 📁 Workspace folder: ${workspace.folderPath}`);

      // Scan workspace folder for all markdown files
      logger.info(`[NoteRepository] 🔍 Scanning workspace folder for markdown files...`);
      const filesOnDisk = await this.fileSystemService.scanFolder(workspace.folderPath, true);
      logger.info(`[NoteRepository] ✅ Found ${filesOnDisk.length} markdown files on disk`);

      // Get all notes in this workspace from database
      logger.info(`[NoteRepository] 🔍 Querying database for existing notes...`);
      const notesInDb = await this.findAll({
        where: { workspaceId, isDeleted: false },
      });
      logger.info(`[NoteRepository] ✅ Found ${notesInDb.length} notes in database`);

      // Create maps for efficient lookup
      const filesMap = new Map(filesOnDisk.map((f) => [f.relativePath, f]));
      const notesMap = new Map(notesInDb.map((n) => [n.filePath || '', n]));

      logger.info(`[NoteRepository] 📊 Comparing files and notes...`);

      // Find files that exist on disk but not in database (CREATE)
      for (const file of filesOnDisk) {
        if (!notesMap.has(file.relativePath)) {
          logger.info(`[NoteRepository] ➕ Creating note from file: ${file.relativePath}`);
          try {
            // Determine notebook by folder path
            let notebookId: string | undefined = undefined;
            try {
              const folderRel = path.dirname(file.relativePath);
              if (folderRel && folderRel !== '.' && folderRel !== '/') {
                const nb = await this.db
                  .select({ id: notebooks.id })
                  .from(notebooks)
                  .where(
                    and(
                      eq(notebooks.workspaceId, workspaceId),
                      eq(notebooks.folderPath, folderRel),
                    ),
                  )
                  .limit(1);
                if (nb[0]?.id) notebookId = nb[0].id;
              }
            } catch (e) {
              console.warn('Could not resolve notebook for file', file.relativePath, e);
            }

            // Create new note from file
            await this.create({
              title: file.title,
              workspaceId,
              notebookId: notebookId,
              filePath: file.relativePath,
              isFavorite: file.metadata?.favorite || false,
              isPinned: file.metadata?.pinned || false,
            });
            results.created++;
            logger.info(`[NoteRepository] ✅ Created note: ${file.title}`);
          } catch (error) {
            logger.error(
              `[NoteRepository] ❌ Failed to create note from ${file.relativePath}:`,
              error,
            );
            results.errors.push(`Failed to create note from ${file.relativePath}: ${error}`);
          }
        }
      }

      // Build basename index for files on disk to help detect moves
      const filesByBase = new Map<string, (typeof filesOnDisk)[0][]>();
      for (const f of filesOnDisk) {
        const base = path.basename(f.relativePath);
        const arr = filesByBase.get(base) || [];
        arr.push(f);
        filesByBase.set(base, arr);
      }

      // Handle notes whose files moved: try to relocate by basename match; else delete
      for (const note of notesInDb) {
        if (note.filePath && !filesMap.has(note.filePath)) {
          const base = path.basename(note.filePath);
          const candidates = filesByBase.get(base) || [];
          let relocated = false;
          for (const cand of candidates) {
            if (!notesMap.has(cand.relativePath)) {
              try {
                // Determine notebook by folder path
                let notebookId: string | undefined = undefined;
                const folderRel = path.dirname(cand.relativePath);
                if (folderRel && folderRel !== '.' && folderRel !== '/') {
                  const nb = await this.db
                    .select({ id: notebooks.id })
                    .from(notebooks)
                    .where(
                      and(
                        eq(notebooks.workspaceId, workspaceId),
                        eq(notebooks.folderPath, folderRel),
                      ),
                    )
                    .limit(1);
                  if (nb[0]?.id) notebookId = nb[0].id;
                }

                await this.db
                  .update(notes)
                  .set({
                    filePath: cand.relativePath,
                    notebookId: notebookId ?? null,
                    updatedAt: new Date(),
                  })
                  .where(eq(notes.id, note.id));
                notesMap.set(cand.relativePath, {
                  ...note,
                  filePath: cand.relativePath,
                  notebookId: notebookId ?? null,
                });
                results.updated++;
                logger.info(
                  `[NoteRepository] 🔁 Relocated note ${note.id} -> ${cand.relativePath}`,
                );
                relocated = true;
                break;
              } catch (error) {
                logger.error(`[NoteRepository] ❌ Failed to relocate note ${note.id}:`, error);
                results.errors.push(`Failed to relocate note ${note.id}: ${error}`);
              }
            }
          }

          if (!relocated) {
            logger.info(
              `[NoteRepository] 🗑️  Deleting note (file no longer exists): ${note.filePath}`,
            );
            try {
              await this.softDelete(note.id);
              results.deleted++;
            } catch (error) {
              logger.error(`[NoteRepository] ❌ Failed to delete note ${note.id}:`, error);
              results.errors.push(`Failed to delete note ${note.id}: ${error}`);
            }
          }
        }
      }

      // Check for files that were renamed/moved (UPDATE)
      // This is more complex and may require content comparison or user input
      // For now, we'll just detect and report them as errors

      // Ensure notebookId matches folder for all notes
      for (const note of notesInDb) {
        if (note.filePath && note.workspaceId) {
          const folderRel = path.dirname(note.filePath);
          if (folderRel && folderRel !== '.' && folderRel !== '/') {
            try {
              const nb = await this.db
                .select({ id: notebooks.id })
                .from(notebooks)
                .where(
                  and(eq(notebooks.workspaceId, workspaceId), eq(notebooks.folderPath, folderRel)),
                )
                .limit(1);
              const targetNbId = nb[0]?.id ?? null;
              if (note.notebookId !== targetNbId) {
                await this.db
                  .update(notes)
                  .set({ notebookId: targetNbId, updatedAt: new Date() })
                  .where(eq(notes.id, note.id));
                results.updated++;
                logger.info(`[NoteRepository] 🧭 Assigned notebook for ${note.id} -> ${folderRel}`);
              }
            } catch (e) {
              logger.warn(`[NoteRepository] Failed to assign notebook for ${note.id}`, e);
            }
          }
        }
      }

      logger.info(`[NoteRepository] ✅ File system sync completed:`, results);
      return results;
    } catch (error) {
      logger.error(`[NoteRepository] ❌ Error syncing with file system:`, error);
      results.errors.push(`Sync failed: ${error}`);
      return results;
    }
  }
}
