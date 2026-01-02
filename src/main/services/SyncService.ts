/**
 * SyncService - File system synchronization for notes
 *
 * Handles syncing between database entries and actual markdown files on disk.
 */

import path from 'node:path';
import { getRepositories } from '../repositories';
import { getFileSystemService } from './FileSystemService';
import { logger } from '../utils/logger';
import type { Note } from '@shared/types';

export interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  errors: string[];
}

/**
 * SyncService handles file system synchronization
 */
class SyncService {
  private readonly fileSystemService = getFileSystemService();

  /**
   * Sync notes with file system for a workspace
   * Reconciles database entries with actual markdown files
   */
  async syncWorkspace(workspaceId: string): Promise<SyncResult> {
    const repos = getRepositories();
    const results: SyncResult = { created: 0, updated: 0, deleted: 0, errors: [] };

    try {
      logger.info(`[SyncService] Starting file system sync for workspace: ${workspaceId}`);

      const workspace = await repos.workspace.findById(workspaceId);
      if (!workspace) throw new Error(`Workspace not found: ${workspaceId}`);

      logger.info(`[SyncService] Workspace folder: ${workspace.folderPath}`);

      // Scan workspace and database
      const filesOnDisk = await this.fileSystemService.scanFolder(workspace.folderPath, true);
      logger.info(`[SyncService] Found ${filesOnDisk.length} markdown files on disk`);

      const notesInDb = await repos.note.findAll({ where: { workspaceId, isDeleted: false } });
      const deletedNotesInDb = await repos.note.findAll({ where: { workspaceId, isDeleted: true } });
      logger.info(`[SyncService] Found ${notesInDb.length} active, ${deletedNotesInDb.length} deleted notes`);

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

      logger.info(`[SyncService] Comparing files and notes...`);

      // Step 1: Create notes for new files
      await this.syncCreateNewNotes(filesOnDisk, notesMap, deletedNotePaths, workspaceId, results);

      // Step 2: Handle moved or deleted files
      await this.syncRelocateOrDeleteNotes(notesInDb, filesMap, filesByBase, notesMap, workspaceId, results);

      // Step 3: Ensure notebook assignments match folder paths
      await this.syncNotebookAssignments(notesInDb, workspaceId, results);

      logger.info(`[SyncService] File system sync completed:`, results);
      return results;
    } catch (error) {
      logger.error(`[SyncService] Error syncing with file system:`, error);
      results.errors.push(`Sync failed: ${error}`);
      return results;
    }
  }

  /**
   * Handle file change event from file watcher
   */
  async handleFileChange(
    filePath: string,
    workspaceId: string,
    event: 'add' | 'change' | 'unlink',
  ): Promise<void> {
    const repos = getRepositories();

    try {
      switch (event) {
        case 'add': {
          // Check if note already exists
          const existing = await repos.note.findByFilePath(filePath);
          if (!existing) {
            // Create new note from file
            const title = this.extractTitleFromPath(filePath);
            const folderPath = path.dirname(filePath);
            const notebookId = await this.findNotebookIdByFolder(workspaceId, folderPath);

            await repos.note.create({
              title,
              filePath,
              workspaceId,
              notebookId: notebookId || undefined,
            });
            logger.info(`[SyncService] Created note from new file: ${filePath}`);
          }
          break;
        }

        case 'change': {
          // File content changed - just invalidate any caches
          // Content is loaded on demand from file
          const note = await repos.note.findByFilePath(filePath);
          if (note) {
            await repos.note.update(note.id, { updatedAt: new Date() });
            logger.debug(`[SyncService] Updated timestamp for: ${filePath}`);
          }
          break;
        }

        case 'unlink': {
          // File deleted - soft delete the note
          const note = await repos.note.findByFilePath(filePath);
          if (note) {
            await repos.note.update(note.id, {
              isDeleted: true,
              deletedAt: new Date(),
            });
            logger.info(`[SyncService] Soft deleted note for removed file: ${filePath}`);
          }
          break;
        }
      }
    } catch (error) {
      logger.error(`[SyncService] Error handling file ${event} for ${filePath}:`, error);
    }
  }

  /**
   * Handle file rename event
   */
  async handleFileRename(
    oldPath: string,
    newPath: string,
    workspaceId: string,
  ): Promise<void> {
    const repos = getRepositories();

    try {
      const note = await repos.note.findByFilePath(oldPath);
      if (note) {
        // Update file path in database
        const newFolder = path.dirname(newPath);
        const notebookId = await this.findNotebookIdByFolder(workspaceId, newFolder);

        await repos.note.update(note.id, {
          filePath: newPath,
          notebookId: notebookId || null,
          updatedAt: new Date(),
        });

        logger.info(`[SyncService] Updated note path: ${oldPath} -> ${newPath}`);
      }
    } catch (error) {
      logger.error(`[SyncService] Error handling file rename from ${oldPath} to ${newPath}:`, error);
    }
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Create notes from new files discovered during sync
   */
  private async syncCreateNewNotes(
    filesOnDisk: { relativePath: string; title: string; metadata?: any }[],
    notesMap: Map<string, Note>,
    deletedNotePaths: Set<string>,
    workspaceId: string,
    results: SyncResult,
  ): Promise<void> {
    const repos = getRepositories();

    for (const file of filesOnDisk) {
      if (notesMap.has(file.relativePath) || deletedNotePaths.has(file.relativePath)) continue;

      logger.info(`[SyncService] Creating note from file: ${file.relativePath}`);
      try {
        const folderRel = path.dirname(file.relativePath);
        const notebookId = await this.findNotebookIdByFolder(workspaceId, folderRel);

        await repos.note.create({
          title: file.title,
          workspaceId,
          notebookId: notebookId || undefined,
          filePath: file.relativePath,
          isFavorite: file.metadata?.favorite || false,
          isPinned: file.metadata?.pinned || false,
        });
        results.created++;
        logger.info(`[SyncService] Created note: ${file.title}`);
      } catch (error) {
        logger.error(`[SyncService] Failed to create note from ${file.relativePath}:`, error);
        results.errors.push(`Failed to create note from ${file.relativePath}: ${error}`);
      }
    }
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
    results: SyncResult,
  ): Promise<void> {
    for (const note of notesInDb) {
      if (!note.filePath || filesMap.has(note.filePath)) continue;

      const relocated = await this.tryRelocateNote(
        note,
        filesByBase.get(path.basename(note.filePath)) || [],
        notesMap,
        workspaceId,
        results,
      );

      if (!relocated) {
        await this.softDeleteMissingNote(note, results);
      }
    }
  }

  private async tryRelocateNote(
    note: Note,
    candidates: any[],
    notesMap: Map<string, Note>,
    workspaceId: string,
    results: SyncResult,
  ): Promise<boolean> {
    const repos = getRepositories();

    for (const cand of candidates) {
      if (notesMap.has(cand.relativePath)) continue;

      try {
        const folderRel = path.dirname(cand.relativePath);
        const notebookId = await this.findNotebookIdByFolder(workspaceId, folderRel);

        await repos.note.update(note.id, {
          filePath: cand.relativePath,
          notebookId: notebookId || null,
          updatedAt: new Date(),
        });

        notesMap.set(cand.relativePath, { ...note, filePath: cand.relativePath, notebookId });
        logger.info(`[SyncService] Relocated note ${note.id} -> ${cand.relativePath}`);
        results.updated++;
        return true;
      } catch (error) {
        logger.error(`[SyncService] Failed to relocate note ${note.id}:`, error);
        results.errors.push(`Failed to relocate note ${note.id}: ${error}`);
      }
    }

    return false;
  }

  private async softDeleteMissingNote(note: Note, results: SyncResult): Promise<void> {
    const repos = getRepositories();

    logger.info(`[SyncService] Soft deleting note (file no longer exists): ${note.filePath}`);
    try {
      await repos.note.update(note.id, {
        isDeleted: true,
        deletedAt: new Date(),
      });
      results.deleted++;
    } catch (error) {
      logger.error(`[SyncService] Failed to delete note ${note.id}:`, error);
      results.errors.push(`Failed to delete note ${note.id}: ${error}`);
    }
  }

  /**
   * Sync notebook assignments based on file paths
   */
  private async syncNotebookAssignments(
    notesInDb: Note[],
    workspaceId: string,
    results: SyncResult,
  ): Promise<void> {
    const repos = getRepositories();

    for (const note of notesInDb) {
      if (!note.filePath || !note.workspaceId) continue;

      const folderRel = path.dirname(note.filePath);
      const targetNbId = await this.findNotebookIdByFolder(workspaceId, folderRel);

      if (note.notebookId !== targetNbId) {
        try {
          await repos.note.update(note.id, {
            notebookId: targetNbId || null,
            updatedAt: new Date(),
          });
          results.updated++;
          logger.info(`[SyncService] Assigned notebook for ${note.id} -> ${folderRel}`);
        } catch (e) {
          logger.warn(`[SyncService] Failed to assign notebook for ${note.id}`, e);
        }
      }
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

    const repos = getRepositories();

    try {
      const notebook = await repos.notebook.findByFolderPath(workspaceId, folderPath);
      return notebook?.id ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Extract title from file path
   */
  private extractTitleFromPath(filePath: string): string {
    const basename = path.basename(filePath, '.md');
    // Remove timestamp prefix if present (e.g., "20231215-123456-title.md")
    const withoutTimestamp = basename.replace(/^\d{8}-\d{6}-/, '');
    return withoutTimestamp || 'Untitled Note';
  }
}

// Singleton instance
let instance: SyncService | null = null;

export function getSyncService(): SyncService {
  instance ??= new SyncService();
  return instance;
}
