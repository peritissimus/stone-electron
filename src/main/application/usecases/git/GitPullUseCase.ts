import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IGitClient } from '../../../domain/ports/out/IGitClient';
import type {
  IGitPullUseCase,
  GitPullRequest,
  GitPullResponse,
} from '../../../domain/ports/in/IGitUseCases';

export class GitPullUseCase implements IGitPullUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly gitClient: IGitClient,
  ) {}

  async execute(request: GitPullRequest): Promise<GitPullResponse> {
    const workspace = await this.workspaceRepository.findById(request.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${request.workspaceId}`);
    }

    const result = await this.gitClient.pull(workspace.folderPath);
    return { success: result.success, error: result.error };
  }
}
