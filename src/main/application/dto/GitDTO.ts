/**
 * Git DTOs - Data transfer objects for git operations
 */

/**
 * File change status
 */
export interface GitFileChangeDTO {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
  staged: boolean;
}

/**
 * Git status response
 */
export interface GitStatusDTO {
  isRepo: boolean;
  branch: string | null;
  ahead: number;
  behind: number;
  hasRemote: boolean;
  remoteUrl: string | null;
  changes: GitFileChangeDTO[];
  hasUncommittedChanges: boolean;
}

/**
 * Git commit info
 */
export interface GitCommitDTO {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email: string;
  date: string;
}

/**
 * Git operation result
 */
export interface GitOperationResultDTO {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Init repo request
 */
export interface GitInitRequestDTO {
  workspaceId: string;
}

/**
 * Commit request
 */
export interface GitCommitRequestDTO {
  workspaceId: string;
  message: string;
  stageAll?: boolean;
}

/**
 * Pull request
 */
export interface GitPullRequestDTO {
  workspaceId: string;
}

/**
 * Push request
 */
export interface GitPushRequestDTO {
  workspaceId: string;
}

/**
 * Sync request
 */
export interface GitSyncRequestDTO {
  workspaceId: string;
  commitMessage?: string;
}

/**
 * Set remote request
 */
export interface GitSetRemoteRequestDTO {
  workspaceId: string;
  url: string;
  name?: string;
}

/**
 * Get commits request
 */
export interface GitGetCommitsRequestDTO {
  workspaceId: string;
  limit?: number;
}

/**
 * Get commits response
 */
export interface GitGetCommitsResponseDTO {
  commits: GitCommitDTO[];
}
