import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IGitClient } from '../../../domain/ports/out/IGitClient';
import type {
  IGitCommitUseCase,
  GitCommitRequest,
  GitCommitResponse,
} from '../../../domain/ports/in/IGitUseCases';
import { logger } from '../../../shared/utils';

export class GitCommitUseCase implements IGitCommitUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly gitClient: IGitClient,
  ) {}

  async execute(request: GitCommitRequest): Promise<GitCommitResponse | null> {
    const workspace = await this.workspaceRepository.findById(request.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${request.workspaceId}`);
    }

    await this.gitClient.stage(workspace.folderPath);
    const result = await this.gitClient.commit(
      workspace.folderPath,
      request.message || `Commit: ${new Date().toISOString()}`,
    );

    if (!result.success) {
      return null;
    }

    const commits = await this.gitClient.getCommits(workspace.folderPath, 1);
    const latestCommit = commits[0];

    logger.info(`[GitUseCases] Committed changes in workspace ${request.workspaceId}`);
    return {
      hash: latestCommit?.hash || '',
      shortHash: latestCommit?.shortHash || '',
      message: latestCommit?.message || request.message || '',
      author: latestCommit?.author || '',
      date: latestCommit?.date || new Date(),
    };
  }
}
