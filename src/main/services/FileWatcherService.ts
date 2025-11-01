/**
 * FileWatcherService - Watches workspace folders for Markdown file changes
 * and triggers database sync + renderer notifications.
 */

import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';
import { BrowserWindow } from 'electron';
import { EVENTS } from '@shared/constants/ipcChannels';
import { logger } from '../utils/logger';
import { Workspace } from '@shared/types';
import { WorkspaceRepository } from '../repositories/WorkspaceRepository';
import { NoteRepository } from '../repositories/NoteRepository';
import { NotebookRepository } from '../repositories/NotebookRepository';

type WatchEntry = {
  watcher: FSWatcher;
  workspace: Workspace;
};

export class FileWatcherService {
  private watchers = new Map<string, WatchEntry>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private started = false;

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    const wsRepo = new WorkspaceRepository();
    const workspaces = await wsRepo.findAll();

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
      ignored: /(^|[\/\\])\./, // dotfiles and folders
      awaitWriteFinish: { stabilityThreshold: 250, pollInterval: 100 },
      persistent: true,
      depth: undefined,
    });

    const sendEvent = (event: keyof typeof EVENTS, payload: any) => {
      BrowserWindow.getAllWindows().forEach((win) => {
        try {
          win.webContents.send(EVENTS[event], payload);
        } catch (e) {
          // Ignore send failures if window is gone
        }
      });
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

      // Debounce a full sync for this workspace
      this.scheduleSync(workspace.id);
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
    const wsRepo = new WorkspaceRepository();
    const nbRepo = new NotebookRepository();
    const noteRepo = new NoteRepository();

    const ws = await wsRepo.findById(workspaceId);
    if (!ws) return;

    logger.info(`[Watcher] Debounced sync start for workspace ${ws.name}`);
    try {
      await nbRepo.syncWithWorkspaceFolders(workspaceId);
      await noteRepo.syncWithFileSystem(workspaceId);
      // Notify renderer that workspace has updated; UI can refresh trees/counts
      BrowserWindow.getAllWindows().forEach((win) => {
        try {
          win.webContents.send(EVENTS.WORKSPACE_UPDATED, { workspace: ws });
        } catch {}
      });
      logger.info(`[Watcher] Sync complete for workspace ${ws.name}`);
    } catch (e) {
      logger.error(`[Watcher] Error syncing ${ws.name}:`, e);
    }
  }
}

// Singleton
let watcherInstance: FileWatcherService | null = null;
export function getFileWatcherService(): FileWatcherService {
  if (!watcherInstance) watcherInstance = new FileWatcherService();
  return watcherInstance;
}

