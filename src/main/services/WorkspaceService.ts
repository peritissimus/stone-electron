/**
 * WorkspaceService - Workspace management and folder operations
 *
 * Handles workspace CRUD, folder management, and sync operations.
 */

import path from 'node:path';
import { EVENTS } from '@shared/constants/ipcChannels';
import { logger } from '../utils/logger';
import { resolveInsideRoot, normalizeRelativePath } from '../utils/path';
import type { Workspace } from '@shared/types';
import type { WorkspaceRepository } from '../repositories/WorkspaceRepository';
import type { NotebookRepository } from '../repositories/NotebookRepository';
import type { NoteRepository } from '../repositories/NoteRepository';
import type { FileSystemService } from './FileSystemService';
import type { FileWatcherService } from './FileWatcherService';
import type { EventBus } from './EventBus';

export interface CreateWorkspaceRequest {
  name: string;
  folderPath: string;
}

export interface UpdateWorkspaceRequest {
  name?: string;
}

export interface FolderOperationResult {
  folderPath: string;
}

export interface ScanResult {
  files: Array<{ relativePath: string; path: string }>;
  structure: any;
  total: number;
  counts: Record<string, number>;
}

export interface SyncResult {
  workspaceId: string;
  notebooks: { created: number; updated: number; errors: string[] };
  notes: { created: number; updated: number; deleted: number; errors: string[] };
  durationMs: number;
}

/**
 * Default folders created in new workspaces
 */
const DEFAULT_FOLDERS = ['Work', 'Journal', 'Personal'];

/**
 * Dependencies for WorkspaceService
 */
export interface WorkspaceServiceDeps {
  workspaceRepository: WorkspaceRepository;
  notebookRepository: NotebookRepository;
  noteRepository: NoteRepository;
  fileSystemService: FileSystemService;
  fileWatcherService: FileWatcherService;
  eventBus: EventBus;
}

/**
 * WorkspaceService handles workspace operations
 */
export class WorkspaceService {
  constructor(private readonly deps: WorkspaceServiceDeps) {}

  // ==========================================================================
  // Workspace CRUD
  // ==========================================================================

  /**
   * Create a new workspace with default folders
   */
  async createWorkspace(data: CreateWorkspaceRequest): Promise<Workspace> {
    // Validate folder path
    const validation = await this.deps.fileSystemService.validateFolderPath(data.folderPath);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid folder path');
    }

    // Create workspace in DB
    const workspace = await this.deps.workspaceRepository.create({
      name: data.name,
      folderPath: data.folderPath,
    });

    // Create default folders
    await this.ensureDefaultFolders(data.folderPath);

    // Sync notebooks and notes
    try {
      await this.deps.notebookRepository.syncWithWorkspaceFolders(workspace.id);
      await this.deps.noteRepository.syncWithFileSystem(workspace.id);
    } catch (error) {
      logger.error('[WorkspaceService] Error syncing after creation:', error);
    }

    // Start watching the workspace
    try {
      await this.deps.fileWatcherService.watchWorkspace(workspace);
    } catch (error) {
      logger.warn('[WorkspaceService] Could not start file watcher:', error);
    }

    // Emit event
    this.deps.eventBus.emit(EVENTS.WORKSPACE_CREATED, { workspace });

    logger.info(`[WorkspaceService] Created workspace: ${workspace.name}`);
    return workspace;
  }

  /**
   * Get all workspaces
   */
  async getAllWorkspaces(): Promise<Workspace[]> {
    return this.deps.workspaceRepository.findAll();
  }

  /**
   * Get the active workspace
   */
  async getActiveWorkspace(): Promise<Workspace | null> {
    return this.deps.workspaceRepository.getActive();
  }

  /**
   * Set the active workspace
   */
  async setActiveWorkspace(id: string): Promise<Workspace> {
    const workspace = await this.deps.workspaceRepository.setActive(id);

    this.deps.eventBus.emit(EVENTS.WORKSPACE_SWITCHED, { workspace });

    logger.info(`[WorkspaceService] Switched to workspace: ${workspace.name}`);
    return workspace;
  }

  /**
   * Update workspace
   */
  async updateWorkspace(id: string, data: UpdateWorkspaceRequest): Promise<Workspace> {
    const workspace = await this.deps.workspaceRepository.update(id, { name: data.name });

    this.deps.eventBus.emit(EVENTS.WORKSPACE_UPDATED, { workspace });

    return workspace;
  }

  /**
   * Delete workspace
   */
  async deleteWorkspace(id: string): Promise<void> {
    await this.deps.workspaceRepository.delete(id);

    // Stop watching
    try {
      await this.deps.fileWatcherService.unwatchWorkspace(id);
    } catch (error) {
      logger.warn('[WorkspaceService] Could not stop file watcher:', error);
    }

    this.deps.eventBus.emit(EVENTS.WORKSPACE_DELETED, { id });

    logger.info(`[WorkspaceService] Deleted workspace: ${id}`);
  }

  // ==========================================================================
  // Folder Operations
  // ==========================================================================

  /**
   * Create a folder in the active workspace
   */
  async createFolder(name: string, parentPath?: string): Promise<FolderOperationResult> {
    const workspace = await this.getActiveWorkspaceOrThrow();

    const parentRelative = normalizeRelativePath(parentPath || '');
    const targetBase = resolveInsideRoot(
      workspace.folderPath,
      parentRelative || '.',
    );

    const folderName = await this.deps.fileSystemService.generateUniqueFolderName(
      targetBase,
      name || 'New Folder',
    );

    const newRelative = parentRelative
      ? path.posix.join(parentRelative, folderName)
      : folderName;

    await this.deps.fileSystemService.createFolder(
      resolveInsideRoot(workspace.folderPath, newRelative),
    );

    this.deps.eventBus.emit(EVENTS.WORKSPACE_UPDATED, { workspace });

    logger.info(`[WorkspaceService] Created folder: ${newRelative}`);
    return { folderPath: newRelative };
  }

  /**
   * Rename a folder
   */
  async renameFolder(folderPath: string, newName: string): Promise<FolderOperationResult> {
    const workspace = await this.getActiveWorkspaceOrThrow();

    const targetRelative = normalizeRelativePath(folderPath);
    if (!targetRelative) {
      throw new Error('Folder path is required');
    }

    const currentAbsolute = resolveInsideRoot(workspace.folderPath, targetRelative);
    const exists = await this.deps.fileSystemService.fileExists(currentAbsolute);
    if (!exists) {
      throw new Error('Folder does not exist');
    }

    const parentRelative = this.getParentPath(targetRelative);
    const parentAbsolute = resolveInsideRoot(workspace.folderPath, parentRelative || '.');

    const desiredName = newName?.trim() || 'Folder';
    const newFolderName = await this.deps.fileSystemService.generateUniqueFolderName(
      parentAbsolute,
      desiredName,
      currentAbsolute,
    );

    const newRelative = parentRelative
      ? path.posix.join(parentRelative, newFolderName)
      : newFolderName;

    const newAbsolute = resolveInsideRoot(workspace.folderPath, newRelative);

    if (newAbsolute !== currentAbsolute) {
      await this.deps.fileSystemService.renameFolder(currentAbsolute, newAbsolute);
    }

    this.deps.eventBus.emit(EVENTS.WORKSPACE_UPDATED, { workspace });

    logger.info(`[WorkspaceService] Renamed folder: ${targetRelative} → ${newRelative}`);
    return { folderPath: newRelative };
  }

  /**
   * Delete a folder
   */
  async deleteFolder(folderPath: string): Promise<void> {
    const workspace = await this.getActiveWorkspaceOrThrow();

    const targetRelative = normalizeRelativePath(folderPath);
    if (!targetRelative) {
      throw new Error('Folder path is required');
    }

    const targetAbsolute = resolveInsideRoot(workspace.folderPath, targetRelative);
    const exists = await this.deps.fileSystemService.fileExists(targetAbsolute);
    if (!exists) {
      throw new Error('Folder does not exist');
    }

    await this.deps.fileSystemService.deleteFolder(targetAbsolute, true);

    this.deps.eventBus.emit(EVENTS.WORKSPACE_UPDATED, { workspace });

    logger.info(`[WorkspaceService] Deleted folder: ${targetRelative}`);
  }

  /**
   * Move a folder to a new location
   */
  async moveFolder(sourcePath: string, destinationPath: string | null): Promise<FolderOperationResult> {
    const workspace = await this.getActiveWorkspaceOrThrow();

    const sourceRelative = normalizeRelativePath(sourcePath);
    if (!sourceRelative) {
      throw new Error('Source folder path is required');
    }

    const sourceAbsolute = resolveInsideRoot(workspace.folderPath, sourceRelative);
    const exists = await this.deps.fileSystemService.fileExists(sourceAbsolute);
    if (!exists) {
      throw new Error('Source folder does not exist');
    }

    const destinationRelative = normalizeRelativePath(destinationPath || '');
    const destinationAbsolute = resolveInsideRoot(
      workspace.folderPath,
      destinationRelative || '.',
    );

    // Check destination exists
    if (destinationRelative) {
      const destExists = await this.deps.fileSystemService.fileExists(destinationAbsolute);
      if (!destExists) {
        throw new Error('Destination folder does not exist');
      }
    }

    // Prevent moving into self
    if (destinationRelative.startsWith(sourceRelative + '/')) {
      throw new Error('Cannot move a folder into itself or its subdirectory');
    }

    const folderName = path.basename(sourceRelative);
    const uniqueName = await this.deps.fileSystemService.generateUniqueFolderName(
      destinationAbsolute,
      folderName,
    );

    const finalRelative = destinationRelative
      ? path.posix.join(destinationRelative, uniqueName)
      : uniqueName;

    const finalAbsolute = resolveInsideRoot(workspace.folderPath, finalRelative);

    await this.deps.fileSystemService.renameFolder(sourceAbsolute, finalAbsolute);

    this.deps.eventBus.emit(EVENTS.WORKSPACE_UPDATED, { workspace });

    logger.info(`[WorkspaceService] Moved folder: ${sourceRelative} → ${finalRelative}`);
    return { folderPath: finalRelative };
  }

  // ==========================================================================
  // Scan & Sync
  // ==========================================================================

  /**
   * Scan workspace for files and structure
   */
  async scanWorkspace(workspaceId: string): Promise<ScanResult> {
    const workspace = await this.deps.workspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const files = await this.deps.fileSystemService.scanFolder(workspace.folderPath, true);
    const counts: Record<string, number> = {};

    for (const file of files) {
      const normalized = file.relativePath.replaceAll('\\', '/');
      const segments = normalized.split('/');
      const folderSegments = segments.length > 1 ? segments.slice(0, -1) : [];

      const prefixes: string[] = ['__root__'];
      let current = '';
      for (const segment of folderSegments) {
        current = current ? `${current}/${segment}` : segment;
        prefixes.push(current);
      }

      for (const prefix of prefixes) {
        counts[prefix] = (counts[prefix] || 0) + 1;
      }
    }

    const structure = await this.deps.fileSystemService.getFolderStructure(workspace.folderPath);

    this.deps.eventBus.emit(EVENTS.WORKSPACE_SCANNED, { workspace, files, structure });

    return { files, structure, total: files.length, counts };
  }

  /**
   * Sync workspace - reconcile DB with filesystem
   */
  async syncWorkspace(workspaceId?: string): Promise<SyncResult> {
    const workspace = workspaceId
      ? await this.deps.workspaceRepository.findById(workspaceId)
      : await this.deps.workspaceRepository.getActive();

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const start = Date.now();

    // Ensure default folders exist
    await this.ensureDefaultFolders(workspace.folderPath);

    // Sync notebooks from folders
    const nbResult = await this.deps.notebookRepository.syncWithWorkspaceFolders(workspace.id);

    // Sync notes from files
    const noteResult = await this.deps.noteRepository.syncWithFileSystem(workspace.id);

    const durationMs = Date.now() - start;

    logger.info(
      `[WorkspaceService] Synced workspace ${workspace.id}: ` +
      `${noteResult.created + noteResult.updated} notes (${durationMs}ms)`,
    );

    return {
      workspaceId: workspace.id,
      notebooks: nbResult,
      notes: noteResult,
      durationMs,
    };
  }

  /**
   * Validate a folder path
   */
  async validatePath(folderPath: string): Promise<{ valid: boolean; error?: string }> {
    return this.deps.fileSystemService.validateFolderPath(folderPath);
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private async getActiveWorkspaceOrThrow(): Promise<Workspace> {
    const workspace = await this.getActiveWorkspace();
    if (!workspace) {
      throw new Error('No active workspace');
    }
    return workspace;
  }

  private async ensureDefaultFolders(folderPath: string): Promise<void> {
    for (const folderName of DEFAULT_FOLDERS) {
      try {
        const fullPath = path.join(folderPath, folderName);
        const exists = await this.deps.fileSystemService.fileExists(fullPath);
        if (!exists) {
          await this.deps.fileSystemService.createFolder(fullPath);
          logger.debug(`[WorkspaceService] Created default folder: ${folderName}`);
        }
      } catch (error) {
        logger.warn(`[WorkspaceService] Could not create folder ${folderName}:`, error);
      }
    }
  }

  private getParentPath(relativePath: string): string {
    const normalized = normalizeRelativePath(relativePath);
    if (!normalized.includes('/')) {
      return '';
    }
    return normalized.slice(0, normalized.lastIndexOf('/'));
  }
}

// ==========================================================================
// Singleton for backward compatibility (IPC handlers)
// ==========================================================================

import { getRepositories } from '../repositories';
import { getFileSystemService } from './FileSystemService';
import { getFileWatcherService } from './FileWatcherService';
import { getEventBus } from './EventBus';

let instance: WorkspaceService | null = null;

export function getWorkspaceService(): WorkspaceService {
  if (!instance) {
    const repos = getRepositories();
    instance = new WorkspaceService({
      workspaceRepository: repos.workspace,
      notebookRepository: repos.notebook,
      noteRepository: repos.note,
      fileSystemService: getFileSystemService(),
      fileWatcherService: getFileWatcherService(),
      eventBus: getEventBus(),
    });
  }
  return instance;
}

/**
 * Create WorkspaceService with custom dependencies (for DI container)
 */
export function createWorkspaceService(deps: WorkspaceServiceDeps): WorkspaceService {
  return new WorkspaceService(deps);
}
