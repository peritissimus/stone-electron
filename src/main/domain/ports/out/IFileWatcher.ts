/**
 * File Watcher Port (Outbound)
 *
 * Defines the contract for watching file system changes in workspaces.
 * Implementations handle the actual file watching using libraries like chokidar.
 */

import type { WorkspaceProps } from '../../entities';

export interface IFileWatcher {
  /**
   * Start watching all workspaces for file changes
   */
  start(): Promise<void>;

  /**
   * Stop all file watchers
   */
  stopAll(): Promise<void>;

  /**
   * Start watching a specific workspace
   */
  watchWorkspace(workspace: WorkspaceProps): Promise<void>;

  /**
   * Stop watching a specific workspace
   */
  unwatchWorkspace(workspaceId: string): Promise<void>;
}
