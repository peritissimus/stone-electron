/**
 * Git Use Cases Port
 *
 * Defines the contract for git operations.
 */

// Request/Response types
export interface GitStatusRequest {
  workspaceId: string;
}

export interface GitStatusResponse {
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

export interface GitInitRequest {
  workspaceId: string;
}

export interface GitInitResponse {
  success: boolean;
}

export interface GitCommitRequest {
  workspaceId: string;
  message?: string;
}

export interface GitCommitResponse {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: Date;
}

export interface GitPullRequest {
  workspaceId: string;
}

export interface GitPullResponse {
  success: boolean;
  error?: string;
}

export interface GitPushRequest {
  workspaceId: string;
}

export interface GitPushResponse {
  success: boolean;
  error?: string;
}

export interface GitSyncRequest {
  workspaceId: string;
  message?: string;
}

export interface GitSyncResponse {
  success: boolean;
  pulled: number;
  pushed: number;
  conflicts: string[];
  error?: string;
}

export interface GitSetRemoteRequest {
  workspaceId: string;
  url: string;
}

export interface GitSetRemoteResponse {
  success: boolean;
}

export interface GitGetCommitsRequest {
  workspaceId: string;
  limit?: number;
}

export interface GitGetCommitsResponse {
  commits: Array<{
    hash: string;
    shortHash: string;
    message: string;
    author: string;
    date: Date;
  }>;
}

// Use case interfaces
export interface IGetGitStatusUseCase {
  execute(request: GitStatusRequest): Promise<GitStatusResponse>;
}

export interface IInitGitRepoUseCase {
  execute(request: GitInitRequest): Promise<GitInitResponse>;
}

export interface IGitCommitUseCase {
  execute(request: GitCommitRequest): Promise<GitCommitResponse | null>;
}

export interface IGitPullUseCase {
  execute(request: GitPullRequest): Promise<GitPullResponse>;
}

export interface IGitPushUseCase {
  execute(request: GitPushRequest): Promise<GitPushResponse>;
}

export interface IGitSyncUseCase {
  execute(request: GitSyncRequest): Promise<GitSyncResponse>;
}

export interface ISetGitRemoteUseCase {
  execute(request: GitSetRemoteRequest): Promise<GitSetRemoteResponse>;
}

export interface IGetGitCommitsUseCase {
  execute(request: GitGetCommitsRequest): Promise<GitGetCommitsResponse>;
}

/**
 * Aggregated git use cases interface for DI container
 */
export interface IGitUseCases {
  getStatus: { execute(request: { workspaceId: string }): Promise<GitStatusResponse> };
  init: { execute(request: { workspaceId: string }): Promise<GitInitResponse> };
  commit: {
    execute(request: { workspaceId: string; message?: string }): Promise<GitCommitResponse | null>;
  };
  pull: { execute(request: { workspaceId: string }): Promise<GitPullResponse> };
  push: { execute(request: { workspaceId: string }): Promise<GitPushResponse> };
  sync: { execute(request: { workspaceId: string; message?: string }): Promise<GitSyncResponse> };
  setRemote: {
    execute(request: { workspaceId: string; url: string }): Promise<GitSetRemoteResponse>;
  };
  getCommits: {
    execute(request: { workspaceId: string; limit?: number }): Promise<GitGetCommitsResponse>;
  };
}
