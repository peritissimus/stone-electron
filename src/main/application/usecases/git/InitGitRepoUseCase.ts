import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IGitClient } from '../../../domain/ports/out/IGitClient';
import type {
  IInitGitRepoUseCase,
  GitInitRequest,
  GitInitResponse,
} from '../../../domain/ports/in/IGitUseCases';

export class InitGitRepoUseCase implements IInitGitRepoUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly gitClient: IGitClient,
  ) {}

  async execute(request: GitInitRequest): Promise<GitInitResponse> {
    const workspace = await this.workspaceRepository.findById(request.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${request.workspaceId}`);
    }

    const result = await this.gitClient.init(workspace.folderPath);
    return { success: result.success };
  }
}
