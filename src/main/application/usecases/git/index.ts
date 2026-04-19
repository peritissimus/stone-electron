import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IGitClient } from '../../../domain/ports/out/IGitClient';
import type { IGitUseCases } from '../../../domain/ports/in/IGitUseCases';
import { GetGitStatusUseCase } from './GetGitStatusUseCase';
import { InitGitRepoUseCase } from './InitGitRepoUseCase';
import { GitCommitUseCase } from './GitCommitUseCase';
import { GitPullUseCase } from './GitPullUseCase';
import { GitPushUseCase } from './GitPushUseCase';
import { GitSyncUseCase } from './GitSyncUseCase';
import { SetGitRemoteUseCase } from './SetGitRemoteUseCase';
import { GetGitCommitsUseCase } from './GetGitCommitsUseCase';

export { GetGitStatusUseCase } from './GetGitStatusUseCase';
export { InitGitRepoUseCase } from './InitGitRepoUseCase';
export { GitCommitUseCase } from './GitCommitUseCase';
export { GitPullUseCase } from './GitPullUseCase';
export { GitPushUseCase } from './GitPushUseCase';
export { GitSyncUseCase } from './GitSyncUseCase';
export { SetGitRemoteUseCase } from './SetGitRemoteUseCase';
export { GetGitCommitsUseCase } from './GetGitCommitsUseCase';

export interface GitUseCasesDeps {
  workspaceRepository: IWorkspaceRepository;
  gitClient: IGitClient;
}

export function createGitUseCases(deps: GitUseCasesDeps): IGitUseCases {
  const { workspaceRepository, gitClient } = deps;

  return {
    getStatus: new GetGitStatusUseCase(workspaceRepository, gitClient),
    init: new InitGitRepoUseCase(workspaceRepository, gitClient),
    commit: new GitCommitUseCase(workspaceRepository, gitClient),
    pull: new GitPullUseCase(workspaceRepository, gitClient),
    push: new GitPushUseCase(workspaceRepository, gitClient),
    sync: new GitSyncUseCase(workspaceRepository, gitClient),
    setRemote: new SetGitRemoteUseCase(workspaceRepository, gitClient),
    getCommits: new GetGitCommitsUseCase(workspaceRepository, gitClient),
  };
}
