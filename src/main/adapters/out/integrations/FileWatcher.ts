/**
 * FileWatcher - Watches workspace folders for Markdown file changes
 * and triggers database sync + renderer notifications.
 */

import chokidar, { FSWatcher } from 'chokidar';
import path from 'node:path';
import { logger } from '../../../shared';
import type {
  WorkspaceProps,
  IWorkspaceRepository,
  IEventPublisher,
  IFileWatcher,
} from '../../../domain';
import { DOMAIN_EVENT_TYPES } from '../../../domain/ports/out/IEventPublisher';

type WatchEntry = {
  watcher: FSWatcher;
  workspace: WorkspaceProps;
};

/**
 * Triggers a disk → DB sync for a single workspace. Wired in the DI container
 * to `SyncWorkspaceUseCase.execute({ workspaceId })` — kept as a callback so
 * the adapter doesn't import application-layer code.
 */
export type WorkspaceSyncTrigger = (workspaceId: string) => Promise<void>;

/**
 * Dependencies for FileWatcher
 */
export interface FileWatcherDeps {
  workspaceRepository: IWorkspaceRepository;
  eventPublisher: IEventPublisher;
  syncWorkspace: WorkspaceSyncTrigger;
}

// Retry-on-failure tuning for the debounced workspace sync.
const SYNC_DEBOUNCE_MS = 500;
const SYNC_RETRY_BASE_MS = 1000;
const SYNC_RETRY_MAX_MS = 30000;
const SYNC_RETRY_MAX_ATTEMPTS = 5;

export class FileWatcher implements IFileWatcher {
  private readonly watchers = new Map<string, WatchEntry>();
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  // Number of consecutive failed sync attempts per workspace; drives backoff.
  private readonly retryAttempts = new Map<string, number>();
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

      const sendEvent = (event: Parameters<IEventPublisher['publish']>[0]) => {
        this.deps.eventPublisher.publish(event);
      };

      const onFsEvent = (kind: 'add' | 'change' | 'unlink', fullPath: string) => {
        return logger.withContext(`out:FileWatcher.fs.${kind}`, () => {
          if (!fullPath.endsWith('.md')) return;
          const rel = path.relative(folder, fullPath).split(path.sep).filter(Boolean).join('/');

          logger.info(`[Watcher] ${kind}: ${rel} (workspace=${workspace.name})`);

          // Emit file-level event immediately
          if (kind === 'add') {
            sendEvent({
              type: DOMAIN_EVENT_TYPES.FILE_SYNCED,
              timestamp: new Date(),
              payload: {
                filePath: rel,
                operation: 'created',
              },
            });
          } else if (kind === 'change') {
            sendEvent({
              type: DOMAIN_EVENT_TYPES.FILE_SYNCED,
              timestamp: new Date(),
              payload: {
                filePath: rel,
                operation: 'updated',
              },
            });
          } else if (kind === 'unlink') {
            sendEvent({
              type: DOMAIN_EVENT_TYPES.FILE_SYNCED,
              timestamp: new Date(),
              payload: {
                filePath: rel,
                operation: 'deleted',
              },
            });
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

  /**
   * Schedule a debounced sync for a workspace. A new file event resets the
   * debounce timer and the retry/backoff state (fresh debounce wins).
   */
  private scheduleSync(workspaceId: string) {
    // A new file event supersedes any pending sync or retry for this workspace.
    this.retryAttempts.delete(workspaceId);
    this.runScheduledSync(workspaceId, SYNC_DEBOUNCE_MS);
  }

  /**
   * (Re)schedule the sync after `delayMs`. On failure, retries with bounded
   * exponential backoff up to SYNC_RETRY_MAX_ATTEMPTS before giving up.
   */
  private runScheduledSync(workspaceId: string, delayMs: number) {
    const prev = this.debounceTimers.get(workspaceId);
    if (prev) clearTimeout(prev);

    const timer = setTimeout(() => {
      void logger.withContext(`out:FileWatcher.sync.${workspaceId}`, async () => {
        this.debounceTimers.delete(workspaceId);
        try {
          await this.syncWorkspace(workspaceId);
          this.retryAttempts.delete(workspaceId);
        } catch (e) {
          const attempt = (this.retryAttempts.get(workspaceId) ?? 0) + 1;
          if (attempt >= SYNC_RETRY_MAX_ATTEMPTS) {
            this.retryAttempts.delete(workspaceId);
            logger.error(
              `[Watcher] Sync failed for workspace ${workspaceId} after ${attempt} attempts, giving up:`,
              e,
            );
            return;
          }
          this.retryAttempts.set(workspaceId, attempt);
          const backoff = Math.min(SYNC_RETRY_BASE_MS * 2 ** (attempt - 1), SYNC_RETRY_MAX_MS);
          logger.error(
            `[Watcher] Sync failed for workspace ${workspaceId} (attempt ${attempt}/${SYNC_RETRY_MAX_ATTEMPTS}), retrying in ${backoff}ms:`,
            e,
          );
          this.runScheduledSync(workspaceId, backoff);
        }
      });
    }, delayMs);

    this.debounceTimers.set(workspaceId, timer);
  }

  private clearTimer(workspaceId: string) {
    const timer = this.debounceTimers.get(workspaceId);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(workspaceId);
    }
    this.retryAttempts.delete(workspaceId);
  }

  private clearAllTimers() {
    for (const [workspaceId] of this.debounceTimers) {
      this.clearTimer(workspaceId);
    }
    // Clear any residual retry state not paired with a live timer.
    this.retryAttempts.clear();
  }

  private async syncWorkspace(workspaceId: string) {
    return await logger.withContext('out:FileWatcher.syncWorkspace', async () => {
      const ws = await this.deps.workspaceRepository.findById(workspaceId);
      if (!ws) return;

      logger.info(`[Watcher] Debounced sync start for workspace ${ws.name}`);
      try {
        await this.deps.syncWorkspace(workspaceId);
      } catch (e) {
        logger.error(`[Watcher] Error syncing ${ws.name}:`, e);
        // Rethrow so the scheduler can apply retry/backoff instead of dropping it.
        throw e;
      }

      // Notify renderer that workspace has updated; UI can refresh trees/counts
      this.deps.eventPublisher.publish({
        type: DOMAIN_EVENT_TYPES.WORKSPACE_UPDATED,
        timestamp: new Date(),
        payload: { workspace: ws },
      });
      logger.info(`[Watcher] Sync complete for workspace ${ws.name}`);
    });
  }
}
