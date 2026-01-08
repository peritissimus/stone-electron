/**
 * Git Operations Port
 *
 * Defines the contract for git version control operations.
 */

export interface GitStatus {
  isRepo: boolean;
  hasChanges: boolean;
  branch: string | null;
  remote: string | null;
  ahead: number;
  behind: number;
  staged: string[];
  modified: string[];
  untracked: string[];
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: Date;
}

export interface GitSyncResult {
  success: boolean;
  pulled: number;
  pushed: number;
  conflicts: string[];
  error?: string;
}

export interface IGitOperations {
  /**
   * Check if path is a git repository
   */
  isRepo(workspacePath: string): Promise<boolean>;

  /**
   * Initialize a new git repository
   */
  init(workspacePath: string): Promise<boolean>;

  /**
   * Get repository status
   */
  getStatus(workspacePath: string): Promise<GitStatus>;

  /**
   * Stage all changes and commit
   */
  commit(workspacePath: string, message?: string): Promise<GitCommit | null>;

  /**
   * Pull changes from remote
   */
  pull(workspacePath: string): Promise<{ success: boolean; error?: string }>;

  /**
   * Push changes to remote
   */
  push(workspacePath: string): Promise<{ success: boolean; error?: string }>;

  /**
   * Sync (pull + commit + push)
   */
  sync(workspacePath: string, message?: string): Promise<GitSyncResult>;

  /**
   * Set remote URL
   */
  setRemote(workspacePath: string, url: string): Promise<boolean>;

  /**
   * Get remote URL
   */
  getRemote(workspacePath: string): Promise<string | null>;

  /**
   * Get recent commits
   */
  getRecentCommits(workspacePath: string, limit?: number): Promise<GitCommit[]>;

  /**
   * Discard changes to a file
   */
  discardChanges(workspacePath: string, filePath: string): Promise<boolean>;

  /**
   * Get diff for a file
   */
  getDiff(workspacePath: string, filePath?: string): Promise<string>;
}
