/**
 * NoteRepository - Handles all note-related database operations
 */

import { eq, and, sql, desc, asc, isNull } from 'drizzle-orm';
import { BrowserWindow } from 'electron';
import { getDatabaseManager } from '../database/DatabaseManager';
import {
  notes,
  noteTags,
  noteLinks,
  notebooks,
} from '../database/schema';
import type { Note } from '@shared/types';
import { generateId } from '@shared/utils/id';
import { getFileSystemService } from '../services/FileSystemService';
import { getMarkdownService } from '../services/MarkdownService';
import { WorkspaceRepository } from './WorkspaceRepository';
import { EVENTS } from '@shared/constants/ipcChannels';
import { logger } from '../utils/logger';
import path from 'node:path';
import { resolveInsideRoot } from '../utils/path';

/**
 * Note Repository
 */
export class NoteRepository {
  private readonly db = getDatabaseManager().getDrizzle();
  private readonly fileSystemService = getFileSystemService();
  private readonly markdownService = getMarkdownService();
  private readonly workspaceRepository = new WorkspaceRepository();

  // Cache for graph data (TTL-based)
  private graphCache: {
    data: { nodes: { id: string; name: string; val: number }[]; links: { source: string; target: string }[] } | null;
    timestamp: number;
  } = { data: null, timestamp: 0 };
  private static readonly GRAPH_CACHE_TTL_MS = 30000; // 30 seconds

  // Cache for note title -> note ID lookup (invalidated on create/delete/rename)
  private noteTitleCache: Map<string, Note> | null = null;

  /**
   * Invalidate caches when notes are created/deleted/renamed
   */
  invalidateTitleCache(): void {
    this.noteTitleCache = null;
  }

  invalidateGraphCache(): void {
    this.graphCache = { data: null, timestamp: 0 };
  }

  /**
   * Get or build the note title lookup map (cached)
   */
  private async getNoteTitleMap(): Promise<Map<string, Note>> {
    if (this.noteTitleCache) {
      return this.noteTitleCache;
    }

    const allNotes = await this.findAll({ where: { isDeleted: false } });
    this.noteTitleCache = new Map();
    for (const note of allNotes) {
      if (note.title) {
        this.noteTitleCache.set(note.title.toLowerCase(), note);
      }
    }
    return this.noteTitleCache;
  }

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
   * Build WHERE conditions for a query based on the where object
   */
  private buildWhereConditions(where: Partial<Note>): any[] {
    const conditions: any[] = [];

    // Simple equality fields (non-nullable)
    const simpleFields = ['id', 'title', 'isFavorite', 'isPinned', 'isArchived', 'isDeleted', 'createdAt', 'updatedAt'] as const;
    for (const field of simpleFields) {
      if (where[field] !== undefined && where[field] !== null) {
        conditions.push(eq((notes as any)[field], where[field]));
      }
    }

    // Nullable fields (need isNull check)
    const nullableFields = ['notebookId', 'workspaceId', 'deletedAt'] as const;
    for (const field of nullableFields) {
      if (where[field] !== undefined) {
        if (where[field] === null) {
          conditions.push(isNull((notes as any)[field]));
        } else {
          conditions.push(eq((notes as any)[field], where[field]));
        }
      }
    }

    return conditions;
  }

  /**
   * Get ORDER BY column based on field and order
   */
  private getOrderByColumn(field: keyof Note, order: 'ASC' | 'DESC'): any {
    const columnMap: Record<string, any> = {
      id: notes.id,
      title: notes.title,
      notebookId: notes.notebookId,
      isFavorite: notes.isFavorite,
      isPinned: notes.isPinned,
      isArchived: notes.isArchived,
      isDeleted: notes.isDeleted,
      deletedAt: notes.deletedAt,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
    };

    const column = columnMap[field] || notes.updatedAt;
    return order === 'DESC' ? desc(column) : asc(column);
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

    // Add WHERE clause
    if (options?.where) {
      const conditions = this.buildWhereConditions(options.where);
      if (conditions.length > 0) {
        query = (query as any).where(and(...conditions));
      }
    }

    // Add ORDER BY
    const orderByColumn = options?.sort
      ? this.getOrderByColumn(options.sort.field, options.sort.order)
      : desc(notes.updatedAt);
    query = (query as any).orderBy(orderByColumn);

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
   * Determine target folder for new note, ensuring Personal folder exists
   */
  private async resolveTargetFolder(
    workspace: { id: string; folderPath: string },
    requestedFolder: string,
    notebookId?: string | null,
  ): Promise<string> {
    // Ensure Personal folder exists as default
    const personalFolderPath = path.join(workspace.folderPath, 'Personal');
    if (!(await this.fileSystemService.fileExists(personalFolderPath))) {
      await this.fileSystemService.createFolder(personalFolderPath);
      logger.info(`Created Personal folder: ${personalFolderPath}`);
    }

    // Use requested folder if provided
    if (requestedFolder) return requestedFolder;

    // If notebook specified, use its folder
    if (notebookId) {
      const notebook = await this.getNotebookInfo(notebookId);
      if (!notebook) throw new Error('Notebook not found');
      if (notebook.workspaceId && notebook.workspaceId !== workspace.id) {
        throw new Error('Notebook belongs to a different workspace');
      }
      return (notebook.folderPath || '').replaceAll('\\', '/') || 'Personal';
    }

    return 'Personal';
  }

  /**
   * Generate filename for new note (journal vs regular)
   */
  private async generateNoteFilename(
    targetFolderAbsolute: string,
    relativeFolder: string,
    title: string,
  ): Promise<string> {
    const isJournalNote = relativeFolder === 'Journal' && /^\d{4}-\d{2}-\d{2}$/.test(title);

    if (isJournalNote) {
      return this.fileSystemService.generateUniqueFilename(targetFolderAbsolute, title, '.md');
    }
    return this.fileSystemService.generateTimestampFilename(targetFolderAbsolute, '.md');
  }

  /**
   * Create a new note
   */
  async create(data: Partial<Note>): Promise<Note> {
    const id = generateId();
    const now = new Date();
    const title = data.title?.trim() || 'Untitled Note';
    const requestedFolder = this.normalizeFolderPath((data as any).folderPath);

    const activeWorkspace = await this.workspaceRepository.getActive();

    const noteData: any = {
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

    // Case 1: Creating from an existing file - just link it
    if (data.filePath && data.workspaceId) {
      noteData.filePath = data.filePath;
      noteData.workspaceId = data.workspaceId;
    }
    // Case 2: Creating new file in active workspace
    else if (activeWorkspace) {
      noteData.workspaceId = activeWorkspace.id;

      try {
        const relativeFolder = await this.resolveTargetFolder(
          activeWorkspace,
          requestedFolder,
          data.notebookId,
        );

        const targetFolderAbsolute = resolveInsideRoot(
          activeWorkspace.folderPath,
          relativeFolder || '.',
        );

        const filename = await this.generateNoteFilename(targetFolderAbsolute, relativeFolder, title);
        const relativePath = relativeFolder ? path.posix.join(relativeFolder, filename) : filename;

        // Save content with title as H1
        const content = `# ${title}\n\n`;
        await this.saveContentToFile(relativePath, activeWorkspace.id, content, {
          tags: [],
          favorite: data.isFavorite ?? undefined,
          pinned: data.isPinned ?? undefined,
        });

        noteData.filePath = relativePath;
      } catch (error) {
        logger.error('Error creating markdown file during note creation:', error);
        throw new Error('Failed to create note file on disk');
      }
    }
    // Case 3: No workspace available
    else {
      throw new Error('Cannot create note without an active workspace');
    }

    await this.db.insert(notes).values(noteData);

    this.invalidateTitleCache();
    this.invalidateGraphCache();

    const result = await this.findById(id);
    if (!result) throw new Error('Failed to create note');
    return result;
  }

  /**
   * Determine target folder for note update based on folder path or notebook change
   */
  private async resolveUpdateTargetFolder(
    currentFolder: string,
    requestedFolder: string | undefined,
    notebookId: string | null | undefined,
    workspace: { id: string; folderPath: string },
    updateData: any,
  ): Promise<string> {
    if (requestedFolder !== undefined) {
      updateData.notebookId = null;
      return requestedFolder;
    }

    if (notebookId !== undefined) {
      const targetNotebook = notebookId ? await this.getNotebookInfo(notebookId) : null;
      if (targetNotebook?.workspaceId && targetNotebook.workspaceId !== workspace.id) {
        throw new Error('Target notebook belongs to a different workspace');
      }
      updateData.notebookId = notebookId ?? null;
      return targetNotebook?.folderPath?.replaceAll('\\', '/') || '';
    }

    return currentFolder;
  }

  /**
   * Handle file movement when folder changes during update
   */
  private async handleFileMoveOnUpdate(
    currentRelativePath: string,
    targetFolderRelative: string,
    workspace: { id: string; folderPath: string },
    workspaceId: string,
  ): Promise<string | null> {
    resolveInsideRoot(
      workspace.folderPath,
      targetFolderRelative || '.',
    );

    const filename = path.basename(currentRelativePath);
    const newRelativePath = targetFolderRelative
      ? path.posix.join(targetFolderRelative, filename)
      : filename;

    if (newRelativePath !== currentRelativePath) {
      await this.renameMarkdownFile(currentRelativePath, newRelativePath, workspaceId);
      return newRelativePath;
    }

    return null;
  }

  /**
   * Sync content title with note title in markdown
   */
  private syncContentWithTitle(content: string, title: string): string {
    if (!content.trim().startsWith('# ')) {
      return `# ${title}\n\n${content}`;
    }

    const lines = content.split('\n');
    if (lines[0].startsWith('# ')) {
      lines[0] = `# ${title}`;
    }
    return lines.join('\n');
  }

  /**
   * Update file content during note update
   */
  private async updateNoteFileContent(
    noteId: string,
    existingNote: Note,
    updateData: any,
    contentUpdate: string | null | undefined,
  ): Promise<void> {
    const filePathToUse = updateData.filePath || existingNote.filePath!;
    const currentTitle = updateData.title || existingNote.title || 'Untitled Note';

    let contentToSave = contentUpdate ?? (await this.getContentById(existingNote.id)) ?? '';
    contentToSave = this.syncContentWithTitle(contentToSave, currentTitle);

    await this.saveContentToFile(filePathToUse, existingNote.workspaceId!, contentToSave, {
      tags: [],
      favorite: (updateData.isFavorite ?? existingNote.isFavorite) || undefined,
      pinned: (updateData.isPinned ?? existingNote.isPinned) || undefined,
    });

    await this.updateLinksFromContent(noteId, contentToSave);
  }

  /**
   * Handle file-backed note updates (folder moves and content changes)
   */
  private async updateFileBackedNote(
    existingNote: Note,
    data: Partial<Note>,
    updateData: any,
    requestedFolder: string | undefined,
  ): Promise<void> {
    const workspace = await this.workspaceRepository.findById(existingNote.workspaceId!);
    if (!workspace) throw new Error('Workspace not found');

    const currentRelativePath = updateData.filePath || existingNote.filePath;
    if (!currentRelativePath) throw new Error('Note has no file path');

    const currentFolder = currentRelativePath.includes('/')
      ? currentRelativePath.slice(0, currentRelativePath.lastIndexOf('/'))
      : '';

    const targetFolderRelative = await this.resolveUpdateTargetFolder(
      currentFolder,
      requestedFolder,
      data.notebookId,
      workspace,
      updateData,
    );

    const newFilePath = await this.handleFileMoveOnUpdate(
      currentRelativePath,
      targetFolderRelative,
      workspace,
      existingNote.workspaceId!,
    );
    if (newFilePath) updateData.filePath = newFilePath;

    const contentUpdate = (data as any).content;
    const shouldUpdateFile =
      contentUpdate != null || (data.title !== undefined && data.title !== existingNote.title);

    if (shouldUpdateFile) {
      await this.updateNoteFileContent(existingNote.id, existingNote, updateData, contentUpdate);
    }
  }

  /**
   * Update a note
   */
  async update(id: string, data: Partial<Note>): Promise<Note> {
    const existingNote = await this.findById(id);
    if (!existingNote) throw new Error('Note not found');

    const requestedFolder =
      (data as any).folderPath !== undefined
        ? this.normalizeFolderPath((data as any).folderPath)
        : undefined;

    const updateData: any = { ...data, updatedAt: new Date() };
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) delete updateData[key];
    });

    const hasFileBacking = Boolean(existingNote.filePath && existingNote.workspaceId);

    if (hasFileBacking) {
      try {
        await this.updateFileBackedNote(existingNote, data, updateData, requestedFolder);
      } catch (error) {
        logger.error('Error updating markdown file:', error);
        throw new Error('Failed to update note file on disk');
      }
    }

    await this.db.update(notes).set(updateData).where(eq(notes.id, id));

    if (data.title && data.title !== existingNote.title) {
      this.invalidateTitleCache();
      this.invalidateGraphCache();
    }

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

    // Invalidate caches since a note was deleted
    this.invalidateTitleCache();
    this.invalidateGraphCache();

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

    const normalized = folderPath.replaceAll('\\', '/');
    const pattern = includeSubfolders ? `${normalized}/%` : `${normalized}`;
    const likeCondition = sql`${notes.filePath} LIKE ${pattern}`;

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
   * Find a note by ID (metadata only, no content)
   */
  async findById(id: string): Promise<Note | null> {
    const result = await this.db.select().from(notes).where(eq(notes.id, id)).limit(1);

    if (result.length === 0) return null;

    return result[0];
  }

  /**
   * Find a note by file path (metadata only, no content)
   */
  async findByFilePath(filePath: string): Promise<Note | null> {
    // Normalize path for comparison
    const normalizedPath = filePath.replaceAll('\\', '/');

    const result = await this.db
      .select()
      .from(notes)
      .where(and(eq(notes.filePath, normalizedPath), eq(notes.isDeleted, false)))
      .limit(1);

    if (result.length === 0) return null;

    return result[0];
  }

  /**
   * Get note content by ID (loads from file system)
   */
  async getContentById(id: string): Promise<string | null> {
    const note = await this.findById(id);

    if (!note) return null;

    // If note has a file path, read content from file system
    if (note.filePath && note.workspaceId) {
      const fileContent = await this.getContentFromFile(note.id, note.filePath, note.workspaceId);

      if (fileContent !== null) {
        return fileContent;
      }

      logger.warn(`Could not read markdown file for note ${id}`);
      return '';
    }

    // Notes without file backing return empty content
    return '';
  }

  /**
   * Get raw markdown content by ID (for export - no HTML conversion)
   */
  async getRawContentById(id: string): Promise<string | null> {
    const note = await this.findById(id);

    if (!note) return null;

    // If note has a file path, read raw content from file system
    if (note.filePath && note.workspaceId) {
      try {
        const workspace = await this.workspaceRepository.findById(note.workspaceId);
        if (!workspace) {
          logger.error(`Workspace not found: ${note.workspaceId}`);
          return null;
        }

        const relativePath = note.filePath.replaceAll('\\', '/');
        const absolutePath = resolveInsideRoot(workspace.folderPath, relativePath);

        const markdownFile = await this.fileSystemService.readMarkdownFile(absolutePath, true);
        return markdownFile.content;
      } catch (error) {
        logger.error(`Error reading raw content from file ${note.filePath}:`, error);
        return null;
      }
    }

    return '';
  }

  /**
   * Full-text search (placeholder - FTS not implemented in Drizzle yet)
   */
  async searchFullText(query: string, limit: number = 50): Promise<Note[]> {
    // For now, use simple LIKE search
    const baseResults = await this.findAll({
      where: { isDeleted: false },
      sort: { field: 'updatedAt', order: 'DESC' },
      limit,
    });

    const lowerQuery = query.toLowerCase();
    const matches: Note[] = [];

    for (const note of baseResults) {
      const titleMatch = note.title?.toLowerCase().includes(lowerQuery) ?? false;
      let contentMatch = false;

      if (note.filePath && note.workspaceId) {
        const fileContent = await this.getContentFromFile(note.id, note.filePath, note.workspaceId);
        if (fileContent !== null) {
          contentMatch = fileContent.toLowerCase().includes(lowerQuery);
        }
      }

      if (titleMatch || contentMatch) {
        matches.push(note);
      }
    }

    return matches;
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
   * Related tables (attachments, versions, tags, links) use ON DELETE CASCADE
   */
  async permanentDelete(id: string): Promise<boolean> {
    // Get note to check if it has a file (before deleting from DB)
    const note = await this.findById(id);

    // Delete from database - CASCADE will handle related tables
    await this.db.delete(notes).where(eq(notes.id, id));

    // Delete markdown file if it exists
    if (note?.filePath && note.workspaceId) {
      await this.deleteMarkdownFile(note.filePath, note.workspaceId);
    }

    return true;
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
   * Get graph data for visualization (nodes and edges)
   * Uses TTL-based caching to avoid expensive queries on frequent calls
   */
  async getGraphData(): Promise<{
    nodes: { id: string; name: string; val: number; color?: string }[];
    links: { source: string; target: string }[];
  }> {
    // Check cache first
    const now = Date.now();
    if (this.graphCache.data && (now - this.graphCache.timestamp) < NoteRepository.GRAPH_CACHE_TTL_MS) {
      logger.debug('[NoteRepository] Graph data served from cache');
      return this.graphCache.data;
    }

    try {
      // Get all non-deleted notes
      const allNotes = await this.findAll({ where: { isDeleted: false } });

      // Get all links
      const allLinks = await this.db.select().from(noteLinks);

      // Create nodes with link counts for sizing
      const linkCounts = new Map<string, number>();
      for (const link of allLinks) {
        linkCounts.set(link.sourceNoteId, (linkCounts.get(link.sourceNoteId) || 0) + 1);
        linkCounts.set(link.targetNoteId, (linkCounts.get(link.targetNoteId) || 0) + 1);
      }

      const noteIdSet = new Set(allNotes.map((n) => n.id));
      const nodes = allNotes.map((note) => ({
        id: note.id,
        name: note.title || 'Untitled',
        val: 1 + (linkCounts.get(note.id) || 0), // Size based on connections
      }));

      // Filter links to only include existing notes
      const links = allLinks
        .filter((link: { sourceNoteId: string; targetNoteId: string }) => noteIdSet.has(link.sourceNoteId) && noteIdSet.has(link.targetNoteId))
        .map((link: { sourceNoteId: string; targetNoteId: string }) => ({
          source: link.sourceNoteId,
          target: link.targetNoteId,
        }));

      // Update cache
      const result = { nodes, links };
      this.graphCache = { data: result, timestamp: now };

      logger.info(`[NoteRepository] Graph data: ${nodes.length} nodes, ${links.length} links`);
      return result;
    } catch (error) {
      logger.error('[NoteRepository] Failed to get graph data:', error);
      return { nodes: [], links: [] };
    }
  }

  /**
   * Extract [[note name]] patterns from markdown content and update links
   * Uses cached title map for performance (called frequently during autosave)
   */
  async updateLinksFromContent(sourceNoteId: string, markdownContent: string): Promise<void> {
    try {
      // Extract all [[note name]] patterns from the content
      // Limit capture to 500 chars to prevent excessive matching on malformed input
      const linkPattern = /\[\[([^\]]{1,500})\]\]/g;
      const matches = markdownContent.matchAll(linkPattern);
      const linkedTitles = new Set<string>();

      for (const match of matches) {
        linkedTitles.add(match[1].trim());
      }

      // Skip expensive operations if no links in content
      if (linkedTitles.size === 0) {
        // Still need to remove any existing links
        const currentLinks = await this.getForwardLinks(sourceNoteId);
        for (const link of currentLinks) {
          await this.removeLink(sourceNoteId, link.id);
        }
        return;
      }

      // Get current forward links
      const currentLinks = await this.getForwardLinks(sourceNoteId);
      const currentLinkIds = new Set(currentLinks.map((n) => n.id));

      // Use cached title map instead of loading all notes every time
      const notesByTitle = await this.getNoteTitleMap();

      // Resolve titles to note IDs
      const targetNoteIds = new Set<string>();
      for (const title of linkedTitles) {
        const targetNote = notesByTitle.get(title.toLowerCase());
        if (targetNote && targetNote.id !== sourceNoteId) {
          targetNoteIds.add(targetNote.id);
        }
      }

      // Remove links that no longer exist
      for (const currentId of currentLinkIds) {
        if (!targetNoteIds.has(currentId)) {
          await this.removeLink(sourceNoteId, currentId);
        }
      }

      // Add new links
      for (const targetId of targetNoteIds) {
        if (!currentLinkIds.has(targetId)) {
          await this.addLink(sourceNoteId, targetId);
        }
      }

      logger.info(`[NoteRepository] Updated links for note ${sourceNoteId}: ${targetNoteIds.size} links`);
    } catch (error) {
      logger.error(`[NoteRepository] Failed to update links for note ${sourceNoteId}:`, error);
    }
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
   * Get notes with ANY of the specified tags (OR logic)
   * Returns distinct notes that have at least one of the given tags
   */
  async findByTagsAny(tagIds: string[]): Promise<Note[]> {
    if (tagIds.length === 0) return [];

    const result = await this.db
      .select()
      .from(notes)
      .innerJoin(noteTags, eq(notes.id, noteTags.noteId))
      .where(and(sql`${noteTags.tagId} IN ${tagIds}`, eq(notes.isDeleted, false)))
      .groupBy(notes.id)
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
      .replaceAll('\\', '/')
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
        logger.error(`Workspace not found: ${workspaceId}`);
        return null;
      }

      let relativePath = filePath.replaceAll('\\', '/');
      let absolutePath = resolveInsideRoot(workspace.folderPath, relativePath);

      const fileExists = await this.fileSystemService.fileExists(absolutePath);

      if (!fileExists) {
        const scannedFiles = await this.fileSystemService.scanFolder(workspace.folderPath, true);
        const exactMatch = scannedFiles.find(
          (file) => file.relativePath.replaceAll('\\', '/') === relativePath,
        );

        const basenameMatch = exactMatch ??
          scannedFiles.find(
            (file) => path.basename(file.relativePath) === path.basename(relativePath),
          );

        if (basenameMatch) {
          relativePath = basenameMatch.relativePath.replaceAll('\\', '/');
          absolutePath = resolveInsideRoot(workspace.folderPath, relativePath);
          await this.db
            .update(notes)
            .set({ filePath: relativePath, updatedAt: new Date() })
            .where(eq(notes.id, noteId));
        } else {
          return null;
        }
      }

      const markdownFile = await this.fileSystemService.readMarkdownFile(absolutePath, true);

      // Strip the title heading from content for editor display
      let contentForEditor = markdownFile.content;
      const note = await this.db
        .select({ title: notes.title })
        .from(notes)
        .where(eq(notes.id, noteId))
        .limit(1);
      if (note.length > 0 && note[0].title) {
        const escapedTitle = note[0].title.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
        const titleHeading = `# ${escapedTitle}`;
        const titleHeadingRegex = new RegExp(String.raw`^${titleHeading}\s*\n*`);
        contentForEditor = contentForEditor.replace(titleHeadingRegex, '');
      }

      // Convert markdown to HTML for TipTap editor with caching
      const stats = await this.fileSystemService.getFileStats(absolutePath);
      const mtime = stats.mtimeMs;
      let html = await this.markdownService.markdownToHtml(contentForEditor, absolutePath, mtime);

      // Resolve relative image paths (.assets/) to absolute file:// URLs
      html = this.resolveImagePaths(html, workspace.folderPath);

      return html;
    } catch (error) {
      logger.error(`Error reading content from file ${filePath}:`, error);
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

      const absolutePath = resolveInsideRoot(workspace.folderPath, filePath);

      // Convert HTML content to markdown
      const markdownContent = this.markdownService.htmlToMarkdown(content);

      await this.fileSystemService.writeMarkdownFile(absolutePath, markdownContent, metadata);
    } catch (error) {
      logger.error(`Error saving content to file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Helper: Resolve relative image paths to absolute file:// URLs
   * Converts .assets/image.png to file:///path/to/workspace/.assets/image.png
   */
  private resolveImagePaths(html: string, workspacePath: string): string {
    // Match img src attributes with relative .assets paths
    return html.replaceAll(
      /(<img[^>]*\s+src=["'])\.assets\/([^"']+)(["'][^>]*>)/gi,
      (_, prefix, imagePath, suffix) => {
        const absolutePath = path.join(workspacePath, '.assets', imagePath);
        return `${prefix}file://${absolutePath}${suffix}`;
      }
    );
  }

  /**
   * Helper: Delete markdown file
   */
  private async deleteMarkdownFile(filePath: string, workspaceId: string): Promise<void> {
    try {
      const workspace = await this.workspaceRepository.findById(workspaceId);
      if (!workspace) {
        logger.warn(`Workspace not found: ${workspaceId}, skipping file deletion`);
        return;
      }

      const absolutePath = resolveInsideRoot(workspace.folderPath, filePath);
      await this.fileSystemService.deleteMarkdownFile(absolutePath);
    } catch (error) {
      logger.error(`Error deleting markdown file ${filePath}:`, error);
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

      const oldAbsolutePath = resolveInsideRoot(workspace.folderPath, oldFilePath);
      const newAbsolutePath = resolveInsideRoot(workspace.folderPath, newFilePath);

      await this.fileSystemService.renameMarkdownFile(oldAbsolutePath, newAbsolutePath);

      // Emit file system events to update UI
      // First emit FILE_DELETED for the old path
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.FILE_DELETED, {
          workspaceId,
          path: oldFilePath,
        });
      });

      // Then emit FILE_CREATED for the new path
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.FILE_CREATED, {
          workspaceId,
          path: newFilePath,
        });
      });
    } catch (error) {
      logger.error(`Error renaming markdown file ${oldFilePath} to ${newFilePath}:`, error);
      throw error;
    }
  }

  /**
   * Find notebook ID by folder path
   */
  private async findNotebookIdByFolder(
    workspaceId: string,
    folderPath: string,
  ): Promise<string | null> {
    if (!folderPath || folderPath === '.' || folderPath === '/') return null;

    try {
      const nb = await this.db
        .select({ id: notebooks.id })
        .from(notebooks)
        .where(and(eq(notebooks.workspaceId, workspaceId), eq(notebooks.folderPath, folderPath)))
        .limit(1);
      return nb[0]?.id ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Create notes from new files discovered during sync
   */
  private async syncCreateNewNotes(
    filesOnDisk: { relativePath: string; title: string; metadata?: any }[],
    notesMap: Map<string, Note>,
    deletedNotePaths: Set<string>,
    workspaceId: string,
    results: { created: number; errors: string[] },
  ): Promise<void> {
    for (const file of filesOnDisk) {
      if (notesMap.has(file.relativePath) || deletedNotePaths.has(file.relativePath)) continue;

      logger.info(`[NoteRepository] ➕ Creating note from file: ${file.relativePath}`);
      try {
        const folderRel = path.dirname(file.relativePath);
        const notebookId = await this.findNotebookIdByFolder(workspaceId, folderRel);

        await this.create({
          title: file.title,
          workspaceId,
          notebookId: notebookId ?? undefined,
          filePath: file.relativePath,
          isFavorite: file.metadata?.favorite || false,
          isPinned: file.metadata?.pinned || false,
        });
        results.created++;
        logger.info(`[NoteRepository] ✅ Created note: ${file.title}`);
      } catch (error) {
        logger.error(`[NoteRepository] ❌ Failed to create note from ${file.relativePath}:`, error);
        results.errors.push(`Failed to create note from ${file.relativePath}: ${error}`);
      }
    }
  }

  /**
   * Try to relocate a note to a new file path
   */
  private async tryRelocateNote(
    note: Note,
    candidate: { relativePath: string },
    workspaceId: string,
    notesMap: Map<string, Note>,
  ): Promise<boolean> {
    const folderRel = path.dirname(candidate.relativePath);
    const notebookId = await this.findNotebookIdByFolder(workspaceId, folderRel);

    await this.db
      .update(notes)
      .set({ filePath: candidate.relativePath, notebookId, updatedAt: new Date() })
      .where(eq(notes.id, note.id));

    notesMap.set(candidate.relativePath, { ...note, filePath: candidate.relativePath, notebookId });
    logger.info(`[NoteRepository] 🔁 Relocated note ${note.id} -> ${candidate.relativePath}`);
    return true;
  }

  /**
   * Try to relocate a note to one of the candidate files
   * Returns true if successfully relocated
   */
  private async tryRelocateToCandidates(
    note: Note,
    candidates: { relativePath: string }[],
    notesMap: Map<string, Note>,
    workspaceId: string,
    results: { updated: number; errors: string[] },
  ): Promise<boolean> {
    for (const cand of candidates) {
      if (notesMap.has(cand.relativePath)) continue;

      try {
        const relocated = await this.tryRelocateNote(note, cand, workspaceId, notesMap);
        if (relocated) {
          results.updated++;
          return true;
        }
      } catch (error) {
        logger.error(`[NoteRepository] ❌ Failed to relocate note ${note.id}:`, error);
        results.errors.push(`Failed to relocate note ${note.id}: ${error}`);
      }
    }
    return false;
  }

  /**
   * Handle notes whose files were moved or deleted
   */
  private async syncRelocateOrDeleteNotes(
    notesInDb: Note[],
    filesMap: Map<string, any>,
    filesByBase: Map<string, any[]>,
    notesMap: Map<string, Note>,
    workspaceId: string,
    results: { updated: number; deleted: number; errors: string[] },
  ): Promise<void> {
    for (const note of notesInDb) {
      if (!note.filePath || filesMap.has(note.filePath)) continue;

      const candidates = filesByBase.get(path.basename(note.filePath)) || [];
      const relocated = await this.tryRelocateToCandidates(note, candidates, notesMap, workspaceId, results);

      if (!relocated) {
        await this.syncDeleteMissingNote(note, results);
      }
    }
  }

  /**
   * Soft delete a note whose file no longer exists
   */
  private async syncDeleteMissingNote(
    note: Note,
    results: { deleted: number; errors: string[] },
  ): Promise<void> {
    logger.info(`[NoteRepository] 🗑️  Deleting note (file no longer exists): ${note.filePath}`);
    try {
      await this.softDelete(note.id);
      results.deleted++;
    } catch (error) {
      logger.error(`[NoteRepository] ❌ Failed to delete note ${note.id}:`, error);
      results.errors.push(`Failed to delete note ${note.id}: ${error}`);
    }
  }

  /**
   * Sync notebook assignments based on file paths
   */
  private async syncNotebookAssignments(
    notesInDb: Note[],
    workspaceId: string,
    results: { updated: number },
  ): Promise<void> {
    for (const note of notesInDb) {
      if (!note.filePath || !note.workspaceId) continue;

      const folderRel = path.dirname(note.filePath);
      const targetNbId = await this.findNotebookIdByFolder(workspaceId, folderRel);

      if (note.notebookId !== targetNbId) {
        try {
          await this.db
            .update(notes)
            .set({ notebookId: targetNbId, updatedAt: new Date() })
            .where(eq(notes.id, note.id));
          results.updated++;
          logger.info(`[NoteRepository] 🧭 Assigned notebook for ${note.id} -> ${folderRel}`);
        } catch (e) {
          logger.warn(`[NoteRepository] Failed to assign notebook for ${note.id}`, e);
        }
      }
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
    const results = { created: 0, updated: 0, deleted: 0, errors: [] as string[] };

    try {
      logger.info(`[NoteRepository] 🔄 Starting file system sync for workspace: ${workspaceId}`);

      const workspace = await this.workspaceRepository.findById(workspaceId);
      if (!workspace) throw new Error(`Workspace not found: ${workspaceId}`);

      logger.info(`[NoteRepository] 📁 Workspace folder: ${workspace.folderPath}`);

      // Scan workspace and database
      const filesOnDisk = await this.fileSystemService.scanFolder(workspace.folderPath, true);
      logger.info(`[NoteRepository] ✅ Found ${filesOnDisk.length} markdown files on disk`);

      const notesInDb = await this.findAll({ where: { workspaceId, isDeleted: false } });
      const deletedNotesInDb = await this.findAll({ where: { workspaceId, isDeleted: true } });
      logger.info(`[NoteRepository] ✅ Found ${notesInDb.length} active, ${deletedNotesInDb.length} deleted notes`);

      // Create lookup maps
      const filesMap = new Map(filesOnDisk.map((f) => [f.relativePath, f]));
      const notesMap = new Map(notesInDb.map((n) => [n.filePath || '', n]));
      const deletedNotePaths = new Set(
        deletedNotesInDb.map((n) => n.filePath).filter(Boolean) as string[],
      );

      // Build basename index for detecting file moves
      const filesByBase = new Map<string, typeof filesOnDisk>();
      for (const f of filesOnDisk) {
        const base = path.basename(f.relativePath);
        const arr = filesByBase.get(base) || [];
        arr.push(f);
        filesByBase.set(base, arr);
      }

      logger.info(`[NoteRepository] 📊 Comparing files and notes...`);

      // Step 1: Create notes for new files
      await this.syncCreateNewNotes(filesOnDisk, notesMap, deletedNotePaths, workspaceId, results);

      // Step 2: Handle moved or deleted files
      await this.syncRelocateOrDeleteNotes(notesInDb, filesMap, filesByBase, notesMap, workspaceId, results);

      // Step 3: Ensure notebook assignments match folder paths
      await this.syncNotebookAssignments(notesInDb, workspaceId, results);

      logger.info(`[NoteRepository] ✅ File system sync completed:`, results);
      return results;
    } catch (error) {
      logger.error(`[NoteRepository] ❌ Error syncing with file system:`, error);
      results.errors.push(`Sync failed: ${error}`);
      return results;
    }
  }
}
