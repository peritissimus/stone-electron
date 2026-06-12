/**
 * Git Service Port - Outbound interface for git operations
 */

/**
 * Git file status
 */
export type GitFileStatus = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';

/**
 * File change in git status
 */
export interface GitFileChange {
  path: string;
  status: GitFileStatus;
  staged: boolean;
}

/**
 * Git repository status
 */
export interface GitStatus {
  isRepo: boolean;
  branch: string | null;
  ahead: number;
  behind: number;
  hasRemote: boolean;
  remoteUrl: string | null;
  changes: GitFileChange[];
  hasUncommittedChanges: boolean;
}

/**
 * Git commit info
 */
export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email: string;
  date: Date;
}

/**
 * Git operation result
 */
export interface GitOperationResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Classified failure cause — drives actionable UI copy instead of a
 * generic "sync failed".
 */
export type GitErrorKind = 'auth' | 'network' | 'conflict' | 'unknown';

/**
 * Result of a full sync (commit → pull --rebase → push).
 */
export interface GitSyncResult {
  success: boolean;
  /** True when local changes were committed as part of this sync. */
  committed: boolean;
  commitMessage?: string;
  /** Commits integrated from the remote during this sync. */
  pulledCount: number;
  /** Commits sent to the remote during this sync. */
  pushedCount: number;
  /**
   * Conflicted file paths when the rebase stopped. The client aborts the
   * rebase before returning, so the working tree is clean and the local
   * commit is intact — nothing is half-merged.
   */
  conflicts: string[];
  errorKind?: GitErrorKind;
  error?: string;
}

/**
 * Git Service - Handles git operations
 */
export interface IGitClient {
  /**
   * Check if a directory is a git repository
   */
  isRepository(path: string): Promise<boolean>;

  /**
   * Initialize a new git repository
   */
  init(path: string): Promise<GitOperationResult>;

  /**
   * Get repository status
   */
  getStatus(path: string): Promise<GitStatus>;

  /**
   * Stage files for commit
   */
  stage(path: string, files?: string[]): Promise<GitOperationResult>;

  /**
   * Create a commit
   */
  commit(path: string, message: string): Promise<GitOperationResult>;

  /**
   * Pull from remote
   */
  pull(path: string): Promise<GitOperationResult>;

  /**
   * Push to remote
   */
  push(path: string): Promise<GitOperationResult>;

  /**
   * Set remote URL
   */
  setRemote(path: string, url: string, name?: string): Promise<GitOperationResult>;

  /**
   * Get recent commits
   */
  getCommits(path: string, limit?: number): Promise<GitCommit[]>;

  /**
   * Sync: commit local changes, pull --rebase, push. Conflict-aware —
   * see GitSyncResult.
   */
  sync(path: string, message?: string): Promise<GitSyncResult>;
}
