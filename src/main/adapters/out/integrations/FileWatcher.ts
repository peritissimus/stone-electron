/**
 * FileWatcher - Watches workspace folders for Markdown file changes
 * and triggers database sync + renderer notifications.
 */

import chokidar, { FSWatcher } from 'chokidar';
import path from 'node:path';
import { EVENTS } from '../../../../shared/constants/ipcChannels';
import { logger } from '../../../shared';
import type {
  WorkspaceProps,
  IWorkspaceRepository,
  INoteRepository,
  INotebookRepository,
  IEventPublisher,
  IFileWatcher,
} from '../../../domain';

type WatchEntry = {
  watcher: FSWatcher;
  workspace: WorkspaceProps;
};

/**
 * Dependencies for FileWatcher
 */
export interface FileWatcherDeps {
  workspaceRepository: IWorkspaceRepository;
  noteRepository: INoteRepository;
  notebookRepository: INotebookRepository;
  eventPublisher: IEventPublisher;
}

export class FileWatcher implements IFileWatcher {
  private readonly watchers = new Map<string, WatchEntry>();
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private started = false;

  constructor(private readonly deps: FileWatcherDeps) {}

  async start(): Promise<void> {
    return await logger.withContext('out:FileWatcher.start', async () => {
      if (this.started) return;
      this.started = true;

      const workspaces = await this.deps.workspaceRepository.findAll();

      for (const ws of workspaces) {
        await this.watchWorkspace(ws);
      }
      logger.info(`[Watcher] Started for ${workspaces.length} workspace(s)`);
    });
  }

  async stopAll(): Promise<void> {
    return await logger.withContext('out:FileWatcher.stopAll', async () => {
      this.clearAllTimers();
      for (const [id, entry] of this.watchers) {
        await entry.watcher.close();
        this.watchers.delete(id);
      }
      this.started = false;
      logger.info('[Watcher] Stopped all watchers');
    });
  }

  async watchWorkspace(workspace: WorkspaceProps): Promise<void> {
    return await logger.withContext('out:FileWatcher.watchWorkspace', async () => {
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
        this.deps.eventPublisher.emit(EVENTS[event], payload);
      };

      const onFsEvent = (kind: 'add' | 'change' | 'unlink', fullPath: string) => {
        return logger.withContext(`out:FileWatcher.fs.${kind}`, () => {
          if (!fullPath.endsWith('.md')) return;
          const rel = path.relative(folder, fullPath).split(path.sep).filter(Boolean).join('/');

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
        });
      };

      watcher
        .on('add', (p) => onFsEvent('add', p))
        .on('change', (p) => onFsEvent('change', p))
        .on('unlink', (p) => onFsEvent('unlink', p))
        .on('error', (err) =>
          logger.withContext('out:FileWatcher.fs.error', () =>
            logger.error(`[Watcher] Error for ${folder}:`, err),
          ),
        );

      this.watchers.set(workspace.id, { watcher, workspace });
      logger.info(`[Watcher] Watching: ${workspace.name} -> ${workspace.folderPath}`);
    });
  }

  async unwatchWorkspace(workspaceId: string): Promise<void> {
    return await logger.withContext('out:FileWatcher.unwatchWorkspace', async () => {
      const entry = this.watchers.get(workspaceId);
      if (!entry) return;
      this.clearTimer(workspaceId);
      await entry.watcher.close();
      this.watchers.delete(workspaceId);
      logger.info(`[Watcher] Unwatched workspace ${workspaceId}`);
    });
  }

  private scheduleSync(workspaceId: string) {
    const prev = this.debounceTimers.get(workspaceId);
    if (prev) clearTimeout(prev);

    const timer = setTimeout(() => {
      void logger.withContext(`out:FileWatcher.sync.${workspaceId}`, async () => {
        this.debounceTimers.delete(workspaceId);
        try {
          await this.syncWorkspace(workspaceId);
        } catch (e) {
          logger.error(`[Watcher] Sync failed for workspace ${workspaceId}:`, e);
        }
      });
    }, 500);

    this.debounceTimers.set(workspaceId, timer);
  }

  private clearTimer(workspaceId: string) {
    const timer = this.debounceTimers.get(workspaceId);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(workspaceId);
    }
  }

  private clearAllTimers() {
    for (const [workspaceId] of this.debounceTimers) {
      this.clearTimer(workspaceId);
    }
  }

  private async syncWorkspace(workspaceId: string) {
    return await logger.withContext('out:FileWatcher.syncWorkspace', async () => {
      const ws = await this.deps.workspaceRepository.findById(workspaceId);
      if (!ws) return;

      logger.info(`[Watcher] Debounced sync start for workspace ${ws.name}`);
      try {
        // These methods might need migration if they don't exist on hex interfaces yet
        if ((this.deps.notebookRepository as any).syncWithWorkspaceFolders) {
          await (this.deps.notebookRepository as any).syncWithWorkspaceFolders(workspaceId);
        }
        if ((this.deps.noteRepository as any).syncWithFileSystem) {
          await (this.deps.noteRepository as any).syncWithFileSystem(workspaceId);
        }

        // Notify renderer that workspace has updated; UI can refresh trees/counts
        this.deps.eventPublisher.emit(EVENTS.WORKSPACE_UPDATED, { workspace: ws });
        logger.info(`[Watcher] Sync complete for workspace ${ws.name}`);
      } catch (e) {
        logger.error(`[Watcher] Error syncing ${ws.name}:`, e);
      }
    });
  }
}
