/**
 * Git Use Cases Port
 *
 * Defines the contract for git operations.
 */

import { Context } from 'effect';
import type { Effect } from 'effect';

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
  /** ISO timestamp of the last successful sync for this workspace. */
  lastSyncAt: string | null;
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
  /** True when local changes were committed as part of this sync. */
  committed: boolean;
  pulled: number;
  pushed: number;
  /** Conflicted file paths; the rebase was aborted, local commit kept. */
  conflicts: string[];
  /** 'auth' | 'network' | 'conflict' | 'unknown' — drives UI copy. */
  errorKind?: string;
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
  execute(request: GitStatusRequest): Effect.Effect<GitStatusResponse, Error>;
}

export interface IInitGitRepoUseCase {
  execute(request: GitInitRequest): Effect.Effect<GitInitResponse, Error>;
}

export interface IGitCommitUseCase {
  execute(request: GitCommitRequest): Effect.Effect<GitCommitResponse | null, Error>;
}

export interface IGitPullUseCase {
  execute(request: GitPullRequest): Effect.Effect<GitPullResponse, Error>;
}

export interface IGitPushUseCase {
  execute(request: GitPushRequest): Effect.Effect<GitPushResponse, Error>;
}

export interface IGitSyncUseCase {
  execute(request: GitSyncRequest): Effect.Effect<GitSyncResponse, Error>;
}

export interface ISetGitRemoteUseCase {
  execute(request: GitSetRemoteRequest): Effect.Effect<GitSetRemoteResponse, Error>;
}

export interface IGetGitCommitsUseCase {
  execute(request: GitGetCommitsRequest): Effect.Effect<GitGetCommitsResponse, Error>;
}

/**
 * Aggregated git use cases interface for DI container
 */
export interface IGitUseCases {
  getStatus: IGetGitStatusUseCase;
  init: IInitGitRepoUseCase;
  commit: IGitCommitUseCase;
  pull: IGitPullUseCase;
  push: IGitPushUseCase;
  sync: IGitSyncUseCase;
  setRemote: ISetGitRemoteUseCase;
  getCommits: IGetGitCommitsUseCase;
}

export const GitUseCasesPort =
  Context.GenericTag<IGitUseCases>('stone/IGitUseCases');
