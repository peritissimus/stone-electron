import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IGitClient } from '../../../domain/ports/out/IGitClient';
import type {
  IGetGitCommitsUseCase,
  GitGetCommitsRequest,
  GitGetCommitsResponse,
} from '../../../domain/ports/in/IGitUseCases';

export class GetGitCommitsUseCase implements IGetGitCommitsUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly gitClient: IGitClient,
  ) {}

  async execute(request: GitGetCommitsRequest): Promise<GitGetCommitsResponse> {
    const workspace = await this.workspaceRepository.findById(request.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${request.workspaceId}`);
    }

    const commits = await this.gitClient.getCommits(workspace.folderPath, request.limit || 50);
    return {
      commits: commits.map((c) => ({
        hash: c.hash,
        shortHash: c.shortHash,
        message: c.message,
        author: c.author,
        date: c.date,
      })),
    };
  }
}
