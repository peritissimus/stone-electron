import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IGitClient } from '../../../domain/ports/out/IGitClient';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IPathService } from '../../../domain/ports/out/IPathService';
import type { ISettingsRepository } from '../../../domain/ports/out/ISettingsRepository';
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
  fileStorage: IFileStorage;
  pathService: IPathService;
  settingsRepository: ISettingsRepository;
}

export function createGitUseCases(deps: GitUseCasesDeps): IGitUseCases {
  const { workspaceRepository, gitClient, fileStorage, pathService, settingsRepository } = deps;

  return {
    getStatus: new GetGitStatusUseCase(workspaceRepository, gitClient, settingsRepository),
    init: new InitGitRepoUseCase(workspaceRepository, gitClient, fileStorage, pathService),
    commit: new GitCommitUseCase(workspaceRepository, gitClient),
    pull: new GitPullUseCase(workspaceRepository, gitClient),
    push: new GitPushUseCase(workspaceRepository, gitClient),
    sync: new GitSyncUseCase(
      workspaceRepository,
      gitClient,
      fileStorage,
      pathService,
      settingsRepository,
    ),
    setRemote: new SetGitRemoteUseCase(workspaceRepository, gitClient),
    getCommits: new GetGitCommitsUseCase(workspaceRepository, gitClient),
  };
}
