/**
 * NoteService - Business logic for note operations
 *
 * Orchestrates repositories and file operations.
 * IPC handlers should use this service, not repositories directly.
 */

import { BrowserWindow } from 'electron';
import path from 'node:path';
import { getRepositories } from '../repositories';
import { getFileSystemService } from './FileSystemService';
import { getMarkdownService } from './MarkdownService';
import { getDatabaseManager } from '../database/DatabaseManager';
import { EVENTS } from '@shared/constants/ipcChannels';
import { logger } from '../utils/logger';
import { resolveInsideRoot } from '../utils/path';
import { generateId } from '@shared/utils/id';
import type { Note } from '@shared/types';

// Request/Response types
export interface CreateNoteRequest {
  title?: string;
  folderPath?: string;
  notebookId?: string;
  content?: string;
  isFavorite?: boolean;
  isPinned?: boolean;
  tags?: string[];
}

export interface UpdateNoteRequest {
  title?: string;
  content?: string;
  folderPath?: string;
  notebookId?: string;
  isFavorite?: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
  tags?: string[];
}

export interface NoteWithRelations extends Note {
  tags?: { id: string; name: string; color: string | null }[];
}

/**
 * NoteService handles all note business logic
 */
class NoteService {
  private readonly fileSystemService = getFileSystemService();
  private readonly markdownService = getMarkdownService();

  // Content cache (moved from repository)
  private contentCache = new Map<string, { content: string; timestamp: number }>();
  private static readonly CONTENT_CACHE_TTL_MS = 5000; // 5 seconds

  // ==========================================================================
  // Content Management
  // ==========================================================================

  /**
   * Get note content by ID (loads from file, converts to HTML)
   */
  async getContent(noteId: string): Promise<string | null> {
    const repos = getRepositories();
    const note = await repos.note.findById(noteId);
    if (!note) return null;

    if (!note.filePath || !note.workspaceId) {
      return '';
    }

    return this.getContentFromFile(note.id, note.filePath, note.workspaceId);
  }

  /**
   * Get raw markdown content (for export - no HTML conversion)
   */
  async getRawContent(noteId: string): Promise<string | null> {
    const repos = getRepositories();
    const note = await repos.note.findById(noteId);
    if (!note) return null;

    if (!note.filePath || !note.workspaceId) {
      return '';
    }

    try {
      const workspace = await repos.workspace.findById(note.workspaceId);
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

  /**
   * Update note content (converts HTML to markdown, writes to file)
   */
  async updateContent(noteId: string, content: string): Promise<void> {
    const repos = getRepositories();
    const note = await repos.note.findById(noteId);
    if (!note) throw new Error('Note not found');

    if (!note.filePath || !note.workspaceId) {
      throw new Error('Note has no file backing');
    }

    await this.saveContentToFile(note.filePath, note.workspaceId, content, {
      favorite: note.isFavorite || undefined,
      pinned: note.isPinned || undefined,
    });

    // Invalidate content cache
    this.contentCache.delete(noteId);

    // Update note timestamp
    await repos.note.update(noteId, { updatedAt: new Date() });
  }

  // ==========================================================================
  // Note CRUD (Orchestrated)
  // ==========================================================================

  /**
   * Create a new note with file creation and tag handling
   */
  async createNote(data: CreateNoteRequest): Promise<NoteWithRelations> {
    const repos = getRepositories();
    const id = generateId();
    const now = new Date();
    const title = data.title?.trim() || 'Untitled Note';
    const requestedFolder = this.normalizeFolderPath(data.folderPath);

    const activeWorkspace = await repos.workspace.getActive();
    if (!activeWorkspace) {
      throw new Error('Cannot create note without an active workspace');
    }

    // Resolve target folder
    const relativeFolder = await this.resolveTargetFolder(
      activeWorkspace,
      requestedFolder,
      data.notebookId,
    );

    const targetFolderAbsolute = resolveInsideRoot(
      activeWorkspace.folderPath,
      relativeFolder || '.',
    );

    // Generate filename
    const filename = await this.generateNoteFilename(targetFolderAbsolute, relativeFolder, title);
    const relativePath = relativeFolder ? path.posix.join(relativeFolder, filename) : filename;

    // Create markdown file with content
    const content = data.content || `# ${title}\n\n`;
    await this.saveContentToFile(relativePath, activeWorkspace.id, content, {
      tags: data.tags || [],
      favorite: data.isFavorite,
      pinned: data.isPinned,
    });

    // Insert DB record
    const noteData = {
      id,
      title,
      filePath: relativePath,
      workspaceId: activeWorkspace.id,
      notebookId: data.notebookId || null,
      isFavorite: data.isFavorite ?? false,
      isPinned: data.isPinned ?? false,
      isArchived: false,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };

    await repos.note.create(noteData);

    // Handle tags
    if (data.tags && data.tags.length > 0) {
      await this.setNoteTags(id, data.tags);
    }

    // Emit event
    this.emitNoteCreated(id);

    // Return note with relations
    const note = await repos.note.findById(id);
    if (!note) throw new Error('Failed to create note');

    const tags = await this.getNoteTags(id);
    return { ...note, tags };
  }

  /**
   * Update a note with file operations and tag handling
   */
  async updateNote(id: string, data: UpdateNoteRequest): Promise<NoteWithRelations> {
    const repos = getRepositories();
    const existingNote = await repos.note.findById(id);
    if (!existingNote) throw new Error('Note not found');

    const hasFileBacking = Boolean(existingNote.filePath && existingNote.workspaceId);
    const updateData: Partial<Note> = { updatedAt: new Date() };

    // Handle metadata updates
    if (data.title !== undefined) updateData.title = data.title;
    if (data.isFavorite !== undefined) updateData.isFavorite = data.isFavorite;
    if (data.isPinned !== undefined) updateData.isPinned = data.isPinned;
    if (data.isArchived !== undefined) updateData.isArchived = data.isArchived;

    if (hasFileBacking) {
      const workspace = await repos.workspace.findById(existingNote.workspaceId!);
      if (!workspace) throw new Error('Workspace not found');

      // Handle folder change
      if (data.folderPath !== undefined || data.notebookId !== undefined) {
        const newFilePath = await this.handleFolderChange(
          existingNote,
          data.folderPath,
          data.notebookId,
          workspace,
        );
        if (newFilePath) {
          updateData.filePath = newFilePath;
          if (data.notebookId !== undefined) {
            updateData.notebookId = data.notebookId || null;
          }
        }
      }

      // Handle content or title change
      const shouldUpdateFile =
        data.content != null ||
        (data.title !== undefined && data.title !== existingNote.title);

      if (shouldUpdateFile) {
        const filePathToUse = (updateData.filePath as string) || existingNote.filePath!;
        const currentTitle = data.title || existingNote.title || 'Untitled Note';

        let contentToSave = data.content ?? (await this.getContent(existingNote.id)) ?? '';
        contentToSave = this.syncContentWithTitle(contentToSave, currentTitle);

        await this.saveContentToFile(filePathToUse, existingNote.workspaceId!, contentToSave, {
          favorite: (data.isFavorite ?? existingNote.isFavorite) || undefined,
          pinned: (data.isPinned ?? existingNote.isPinned) || undefined,
        });

        // Invalidate content cache
        this.contentCache.delete(id);
      }
    }

    // Update DB
    await repos.note.update(id, updateData);

    // Handle tags
    if (data.tags !== undefined) {
      await this.setNoteTags(id, data.tags);
    }

    // Emit event
    this.emitNoteUpdated(id);

    // Return note with relations
    const note = await repos.note.findById(id);
    if (!note) throw new Error('Note not found after update');

    const tags = await this.getNoteTags(id);
    return { ...note, tags };
  }

  /**
   * Delete a note (soft or permanent)
   */
  async deleteNote(id: string, permanent: boolean = false): Promise<void> {
    const repos = getRepositories();
    const note = await repos.note.findById(id);
    if (!note) throw new Error('Note not found');

    if (permanent) {
      // Delete markdown file if it exists
      if (note.filePath && note.workspaceId) {
        await this.deleteMarkdownFile(note.filePath, note.workspaceId);
      }

      // Delete from database (CASCADE handles relations)
      await repos.note.delete(id);
    } else {
      // Soft delete
      await repos.note.update(id, {
        isDeleted: true,
        deletedAt: new Date(),
      });
    }

    // Emit event
    this.emitNoteDeleted(id);
  }

  /**
   * Restore a deleted note
   */
  async restoreNote(id: string): Promise<Note> {
    const repos = getRepositories();
    const note = await repos.note.findById(id);
    if (!note) throw new Error('Note not found');

    await repos.note.update(id, {
      isDeleted: false,
      deletedAt: null,
    });

    const restored = await repos.note.findById(id);
    if (!restored) throw new Error('Note not found after restore');

    return restored;
  }

  /**
   * Move note to a different folder
   */
  async moveNote(id: string, targetFolder: string): Promise<Note> {
    const repos = getRepositories();
    const note = await repos.note.findById(id);
    if (!note) throw new Error('Note not found');

    if (!note.filePath || !note.workspaceId) {
      throw new Error('Note has no file backing');
    }

    const workspace = await repos.workspace.findById(note.workspaceId);
    if (!workspace) throw new Error('Workspace not found');

    const newFilePath = await this.handleFolderChange(
      note,
      targetFolder,
      undefined,
      workspace,
    );

    if (newFilePath) {
      await repos.note.update(id, {
        filePath: newFilePath,
        updatedAt: new Date(),
      });
    }

    const updated = await repos.note.findById(id);
    if (!updated) throw new Error('Note not found after move');

    return updated;
  }

  // ==========================================================================
  // Cache Management
  // ==========================================================================

  /**
   * Invalidate content cache for a note or all notes
   */
  invalidateContentCache(noteId?: string): void {
    if (noteId) {
      this.contentCache.delete(noteId);
    } else {
      this.contentCache.clear();
    }
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Get content from markdown file with caching
   */
  private async getContentFromFile(
    noteId: string,
    filePath: string,
    workspaceId: string,
  ): Promise<string | null> {
    const repos = getRepositories();

    try {
      const workspace = await repos.workspace.findById(workspaceId);
      if (!workspace) {
        logger.error(`Workspace not found: ${workspaceId}`);
        return null;
      }

      let relativePath = filePath.replaceAll('\\', '/');
      let absolutePath = resolveInsideRoot(workspace.folderPath, relativePath);

      const fileExists = await this.fileSystemService.fileExists(absolutePath);

      if (!fileExists) {
        // Try to find the file by basename
        const scannedFiles = await this.fileSystemService.scanFolder(workspace.folderPath, true);
        const exactMatch = scannedFiles.find(
          (file) => file.relativePath.replaceAll('\\', '/') === relativePath,
        );

        const basenameMatch =
          exactMatch ??
          scannedFiles.find(
            (file) => path.basename(file.relativePath) === path.basename(relativePath),
          );

        if (basenameMatch) {
          relativePath = basenameMatch.relativePath.replaceAll('\\', '/');
          absolutePath = resolveInsideRoot(workspace.folderPath, relativePath);
          await repos.note.update(noteId, { filePath: relativePath });
        } else {
          return null;
        }
      }

      const markdownFile = await this.fileSystemService.readMarkdownFile(absolutePath, true);

      // Strip the title heading from content for editor display
      let contentForEditor = markdownFile.content;
      const note = await repos.note.findById(noteId);
      if (note?.title) {
        const escapedTitle = note.title.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
        const titleHeading = `# ${escapedTitle}`;
        const titleHeadingRegex = new RegExp(String.raw`^${titleHeading}\s*\n*`);
        contentForEditor = contentForEditor.replace(titleHeadingRegex, '');
      }

      // Convert markdown to HTML for TipTap editor
      const stats = await this.fileSystemService.getFileStats(absolutePath);
      const mtime = stats.mtimeMs;
      let html = await this.markdownService.markdownToHtml(contentForEditor, absolutePath, mtime);

      // Resolve relative image paths to absolute file:// URLs
      html = this.resolveImagePaths(html, workspace.folderPath);

      return html;
    } catch (error) {
      logger.error(`Error reading content from file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Save content to markdown file
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
    const repos = getRepositories();

    try {
      const workspace = await repos.workspace.findById(workspaceId);
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
   * Resolve target folder for note creation
   */
  private async resolveTargetFolder(
    workspace: { id: string; folderPath: string },
    requestedFolder: string,
    notebookId?: string,
  ): Promise<string> {
    const repos = getRepositories();

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
      const notebook = await repos.notebook.findById(notebookId);
      if (!notebook) throw new Error('Notebook not found');
      if (notebook.workspaceId && notebook.workspaceId !== workspace.id) {
        throw new Error('Notebook belongs to a different workspace');
      }
      return (notebook.folderPath || '').replaceAll('\\', '/') || 'Personal';
    }

    return 'Personal';
  }

  /**
   * Generate filename for new note
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
   * Handle folder change during note update
   */
  private async handleFolderChange(
    note: Note,
    folderPath: string | undefined,
    notebookId: string | null | undefined,
    workspace: { id: string; folderPath: string },
  ): Promise<string | null> {
    const repos = getRepositories();

    const currentRelativePath = note.filePath;
    if (!currentRelativePath) return null;

    const currentFolder = currentRelativePath.includes('/')
      ? currentRelativePath.slice(0, currentRelativePath.lastIndexOf('/'))
      : '';

    let targetFolderRelative = currentFolder;

    if (folderPath !== undefined) {
      targetFolderRelative = this.normalizeFolderPath(folderPath);
    } else if (notebookId !== undefined) {
      const targetNotebook = notebookId ? await repos.notebook.findById(notebookId) : null;
      if (targetNotebook?.workspaceId && targetNotebook.workspaceId !== workspace.id) {
        throw new Error('Target notebook belongs to a different workspace');
      }
      targetFolderRelative = targetNotebook?.folderPath?.replaceAll('\\', '/') || '';
    }

    const filename = path.basename(currentRelativePath);
    const newRelativePath = targetFolderRelative
      ? path.posix.join(targetFolderRelative, filename)
      : filename;

    if (newRelativePath !== currentRelativePath) {
      await this.renameMarkdownFile(currentRelativePath, newRelativePath, note.workspaceId!);
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
   * Resolve relative image paths to absolute file:// URLs
   */
  private resolveImagePaths(html: string, workspacePath: string): string {
    return html.replaceAll(
      /(<img[^>]{0,500}\s+src=["'])\.assets\/([^"']{1,500})(["'][^>]{0,500}>)/gi,
      (_, prefix, imagePath, suffix) => {
        const absolutePath = path.join(workspacePath, '.assets', imagePath);
        return `${prefix}file://${absolutePath}${suffix}`;
      },
    );
  }

  /**
   * Delete markdown file
   */
  private async deleteMarkdownFile(filePath: string, workspaceId: string): Promise<void> {
    const repos = getRepositories();

    try {
      const workspace = await repos.workspace.findById(workspaceId);
      if (!workspace) {
        logger.warn(`Workspace not found: ${workspaceId}, skipping file deletion`);
        return;
      }

      const absolutePath = resolveInsideRoot(workspace.folderPath, filePath);
      await this.fileSystemService.deleteMarkdownFile(absolutePath);
    } catch (error) {
      logger.error(`Error deleting markdown file ${filePath}:`, error);
      // Don't throw - allow database deletion to proceed
    }
  }

  /**
   * Rename/move markdown file
   */
  private async renameMarkdownFile(
    oldFilePath: string,
    newFilePath: string,
    workspaceId: string,
  ): Promise<void> {
    const repos = getRepositories();

    try {
      const workspace = await repos.workspace.findById(workspaceId);
      if (!workspace) {
        throw new Error(`Workspace not found: ${workspaceId}`);
      }

      const oldAbsolutePath = resolveInsideRoot(workspace.folderPath, oldFilePath);
      const newAbsolutePath = resolveInsideRoot(workspace.folderPath, newFilePath);

      await this.fileSystemService.renameMarkdownFile(oldAbsolutePath, newAbsolutePath);

      // Emit file system events to update UI
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send(EVENTS.FILE_DELETED, {
          workspaceId,
          path: oldFilePath,
        });
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
   * Normalize folder path
   */
  private normalizeFolderPath(folderPath?: string | null): string {
    if (!folderPath) return '';
    return folderPath
      .replaceAll('\\', '/')
      .replace(/^\.\//, '')
      .replace(/^\/{1,100}/, '')
      .replace(/\/{1,100}$/, '');
  }

  // ==========================================================================
  // Tag Helpers (temporary - will move to NoteTagRepository)
  // ==========================================================================

  /**
   * Get tags for a note
   */
  private async getNoteTags(
    noteId: string,
  ): Promise<{ id: string; name: string; color: string | null }[]> {
    const repos = getRepositories();
    return repos.tag.getTagsForNote(noteId);
  }

  /**
   * Set tags for a note
   */
  private async setNoteTags(noteId: string, tagNames: string[]): Promise<void> {
    const repos = getRepositories();
    await repos.tag.setTagsForNote(noteId, tagNames);
  }

  // ==========================================================================
  // Event Emitters
  // ==========================================================================

  private emitNoteCreated(noteId: string): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send(EVENTS.NOTE_CREATED, { id: noteId });
    });
  }

  private emitNoteUpdated(noteId: string): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send(EVENTS.NOTE_UPDATED, { id: noteId });
    });
  }

  private emitNoteDeleted(noteId: string): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send(EVENTS.NOTE_DELETED, { id: noteId });
    });
  }
}

// Singleton instance
let instance: NoteService | null = null;

export function getNoteService(): NoteService {
  instance ??= new NoteService();
  return instance;
}
