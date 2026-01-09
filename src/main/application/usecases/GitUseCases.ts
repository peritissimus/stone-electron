/**
 * Git Use Cases - Version control operations
 */

import type { IWorkspaceRepository } from '../../domain/ports/out/IWorkspaceRepository';
import type { IGitService } from '../../domain/ports/out/IGitService';
import type {
  IGitUseCases,
  GitStatusResponse,
  GitInitResponse,
  GitCommitResponse,
  GitPullResponse,
  GitPushResponse,
  GitSyncResponse,
  GitSetRemoteResponse,
  GitGetCommitsResponse,
} from '../../domain/ports/in/IGitUseCases';
import { logger } from '../../shared/utils';

export interface GitUseCasesDeps {
  workspaceRepository: IWorkspaceRepository;
  gitService: IGitService;
}

export function createGitUseCases(deps: GitUseCasesDeps): IGitUseCases {
  const { workspaceRepository, gitService } = deps;

  return {
    getStatus: {
      async execute(request: { workspaceId: string }): Promise<GitStatusResponse> {
        const workspace = await workspaceRepository.findById(request.workspaceId);
        if (!workspace) {
          throw new Error(`Workspace not found: ${request.workspaceId}`);
        }

        const status = await gitService.getStatus(workspace.folderPath);
        return {
          isRepo: status.isRepo,
          hasChanges: status.hasUncommittedChanges,
          branch: status.branch,
          remote: status.remoteUrl,
          ahead: status.ahead,
          behind: status.behind,
          staged: status.changes.filter((c) => c.staged).map((c) => c.path),
          modified: status.changes.filter((c) => c.status === 'modified').map((c) => c.path),
          untracked: status.changes.filter((c) => c.status === 'untracked').map((c) => c.path),
        };
      },
    },

    init: {
      async execute(request: { workspaceId: string }): Promise<GitInitResponse> {
        const workspace = await workspaceRepository.findById(request.workspaceId);
        if (!workspace) {
          throw new Error(`Workspace not found: ${request.workspaceId}`);
        }

        const result = await gitService.init(workspace.folderPath);
        logger.info(`[GitUseCases] Initialized git repo in workspace ${request.workspaceId}`);
        return { success: result.success };
      },
    },

    commit: {
      async execute(request: { workspaceId: string; message?: string }): Promise<GitCommitResponse | null> {
        const workspace = await workspaceRepository.findById(request.workspaceId);
        if (!workspace) {
          throw new Error(`Workspace not found: ${request.workspaceId}`);
        }

        await gitService.stage(workspace.folderPath);
        const result = await gitService.commit(
          workspace.folderPath,
          request.message || `Commit: ${new Date().toISOString()}`
        );

        if (!result.success) {
          return null;
        }

        // Get the latest commit info after successful commit
        const commits = await gitService.getCommits(workspace.folderPath, 1);
        const latestCommit = commits[0];

        logger.info(`[GitUseCases] Committed changes in workspace ${request.workspaceId}`);
        return {
          hash: latestCommit?.hash || '',
          shortHash: latestCommit?.shortHash || '',
          message: latestCommit?.message || request.message || '',
          author: latestCommit?.author || '',
          date: latestCommit?.date || new Date(),
        };
      },
    },

    pull: {
      async execute(request: { workspaceId: string }): Promise<GitPullResponse> {
        const workspace = await workspaceRepository.findById(request.workspaceId);
        if (!workspace) {
          throw new Error(`Workspace not found: ${request.workspaceId}`);
        }

        const result = await gitService.pull(workspace.folderPath);
        logger.info(`[GitUseCases] Pulled changes in workspace ${request.workspaceId}`);
        return { success: result.success, error: result.error };
      },
    },

    push: {
      async execute(request: { workspaceId: string }): Promise<GitPushResponse> {
        const workspace = await workspaceRepository.findById(request.workspaceId);
        if (!workspace) {
          throw new Error(`Workspace not found: ${request.workspaceId}`);
        }

        const result = await gitService.push(workspace.folderPath);
        logger.info(`[GitUseCases] Pushed changes in workspace ${request.workspaceId}`);
        return { success: result.success, error: result.error };
      },
    },

    sync: {
      async execute(request: { workspaceId: string; message?: string }): Promise<GitSyncResponse> {
        const workspace = await workspaceRepository.findById(request.workspaceId);
        if (!workspace) {
          throw new Error(`Workspace not found: ${request.workspaceId}`);
        }

        const result = await gitService.sync(
          workspace.folderPath,
          request.message || `Sync: ${new Date().toISOString()}`
        );
        logger.info(`[GitUseCases] Synced workspace ${request.workspaceId}`);
        return {
          success: result.success,
          pulled: 0,
          pushed: 0,
          conflicts: [],
          error: result.error,
        };
      },
    },

    setRemote: {
      async execute(request: { workspaceId: string; url: string }): Promise<GitSetRemoteResponse> {
        const workspace = await workspaceRepository.findById(request.workspaceId);
        if (!workspace) {
          throw new Error(`Workspace not found: ${request.workspaceId}`);
        }

        const result = await gitService.setRemote(workspace.folderPath, request.url, 'origin');
        logger.info(`[GitUseCases] Set remote origin to ${request.url} in workspace ${request.workspaceId}`);
        return { success: result.success };
      },
    },

    getCommits: {
      async execute(request: { workspaceId: string; limit?: number }): Promise<GitGetCommitsResponse> {
        const workspace = await workspaceRepository.findById(request.workspaceId);
        if (!workspace) {
          throw new Error(`Workspace not found: ${request.workspaceId}`);
        }

        const commits = await gitService.getCommits(workspace.folderPath, request.limit || 50);
        return {
          commits: commits.map((c) => ({
            hash: c.hash,
            shortHash: c.shortHash,
            message: c.message,
            author: c.author,
            date: c.date,
          })),
        };
      },
    },
  };
}
