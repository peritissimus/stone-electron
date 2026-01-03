/**
 * FileWatcherService - Watches workspace folders for Markdown file changes
 * and triggers database sync + renderer notifications.
 */

import chokidar, { FSWatcher } from 'chokidar';
import path from 'node:path';
import { EVENTS } from '@shared/constants/ipcChannels';
import { logger } from '../utils/logger';
import { Workspace } from '@shared/types';
import type { WorkspaceRepository } from '../repositories/WorkspaceRepository';
import type { NoteRepository } from '../repositories/NoteRepository';
import type { NotebookRepository } from '../repositories/NotebookRepository';
import type { EventBus } from './EventBus';

type WatchEntry = {
  watcher: FSWatcher;
  workspace: Workspace;
};

/**
 * Dependencies for FileWatcherService
 */
export interface FileWatcherServiceDeps {
  workspaceRepository: WorkspaceRepository;
  noteRepository: NoteRepository;
  notebookRepository: NotebookRepository;
  eventBus: EventBus;
}

export class FileWatcherService {
  private readonly watchers = new Map<string, WatchEntry>();
  private readonly debounceTimers = new Map<string, NodeJS.Timeout>();
  private started = false;

  constructor(private readonly deps: FileWatcherServiceDeps) {}

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    const workspaces = await this.deps.workspaceRepository.findAll();

    for (const ws of workspaces) {
      await this.watchWorkspace(ws);
    }
    logger.info(`[Watcher] Started for ${workspaces.length} workspace(s)`);
  }

  async stopAll(): Promise<void> {
    for (const [id, entry] of this.watchers) {
      await entry.watcher.close();
      this.watchers.delete(id);
    }
    this.started = false;
    logger.info('[Watcher] Stopped all watchers');
  }

  async watchWorkspace(workspace: Workspace): Promise<void> {
    if (!workspace?.id || !workspace.folderPath) return;
    // Avoid duplicate watchers
    if (this.watchers.has(workspace.id)) {
      return;
    }

    const folder = workspace.folderPath;
    const watcher = chokidar.watch(folder, {
      ignoreInitial: true,
      ignored: /(^|[/\\])\./, // dotfiles and folders
      awaitWriteFinish: { stabilityThreshold: 250, pollInterval: 100 },
      persistent: true,
      depth: undefined,
    });

    const sendEvent = (event: keyof typeof EVENTS, payload: any) => {
      this.deps.eventBus.emit(EVENTS[event], payload);
    };

    const onFsEvent = (kind: 'add' | 'change' | 'unlink', fullPath: string) => {
      if (!fullPath.endsWith('.md')) return;
      const rel = path
        .relative(folder, fullPath)
        .split(path.sep)
        .filter(Boolean)
        .join('/');

      logger.info(`[Watcher] ${kind}: ${rel} (workspace=${workspace.name})`);

      // Emit file-level event immediately
      if (kind === 'add') {
        sendEvent('FILE_CREATED', { workspaceId: workspace.id, path: rel });
      } else if (kind === 'change') {
        sendEvent('FILE_CHANGED', { workspaceId: workspace.id, path: rel });
      } else if (kind === 'unlink') {
        sendEvent('FILE_DELETED', { workspaceId: workspace.id, path: rel });
      }

      // Debounce a full sync for this workspace only for structural changes
      // Content edits ("change") don't require a full workspace rescan
      if (kind === 'add' || kind === 'unlink') {
        this.scheduleSync(workspace.id);
      }
    };

    watcher
      .on('add', (p) => onFsEvent('add', p))
      .on('change', (p) => onFsEvent('change', p))
      .on('unlink', (p) => onFsEvent('unlink', p))
      .on('error', (err) => logger.error(`[Watcher] Error for ${folder}:`, err));

    this.watchers.set(workspace.id, { watcher, workspace });
    logger.info(`[Watcher] Watching: ${workspace.name} -> ${workspace.folderPath}`);
  }

  async unwatchWorkspace(workspaceId: string): Promise<void> {
    const entry = this.watchers.get(workspaceId);
    if (!entry) return;
    await entry.watcher.close();
    this.watchers.delete(workspaceId);
    logger.info(`[Watcher] Unwatched workspace ${workspaceId}`);
  }

  private scheduleSync(workspaceId: string) {
    const prev = this.debounceTimers.get(workspaceId);
    if (prev) clearTimeout(prev);

    const timer = setTimeout(() => {
      this.debounceTimers.delete(workspaceId);
      this.syncWorkspace(workspaceId).catch((e) =>
        logger.error(`[Watcher] Sync failed for workspace ${workspaceId}:`, e),
      );
    }, 500);

    this.debounceTimers.set(workspaceId, timer);
  }

  private async syncWorkspace(workspaceId: string) {
    const ws = await this.deps.workspaceRepository.findById(workspaceId);
    if (!ws) return;

    logger.info(`[Watcher] Debounced sync start for workspace ${ws.name}`);
    try {
      await this.deps.notebookRepository.syncWithWorkspaceFolders(workspaceId);
      await this.deps.noteRepository.syncWithFileSystem(workspaceId);
      // Notify renderer that workspace has updated; UI can refresh trees/counts
      this.deps.eventBus.emit(EVENTS.WORKSPACE_UPDATED, { workspace: ws });
      logger.info(`[Watcher] Sync complete for workspace ${ws.name}`);
    } catch (e) {
      logger.error(`[Watcher] Error syncing ${ws.name}:`, e);
    }
  }
}

// ==========================================================================
// Singleton for backward compatibility (IPC handlers)
// ==========================================================================

import { getRepositories } from '../repositories';
import { getEventBus } from './EventBus';

let watcherInstance: FileWatcherService | null = null;

export function getFileWatcherService(): FileWatcherService {
  if (!watcherInstance) {
    const repos = getRepositories();
    watcherInstance = new FileWatcherService({
      workspaceRepository: repos.workspace,
      noteRepository: repos.note,
      notebookRepository: repos.notebook,
      eventBus: getEventBus(),
    });
  }
  return watcherInstance;
}

/**
 * Create FileWatcherService with custom dependencies (for DI container)
 */
export function createFileWatcherService(deps: FileWatcherServiceDeps): FileWatcherService {
  return new FileWatcherService(deps);
}
