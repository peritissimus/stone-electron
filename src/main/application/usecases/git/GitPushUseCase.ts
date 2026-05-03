import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IGitClient } from '../../../domain/ports/out/IGitClient';
import type {
  IGitPushUseCase,
  GitPushRequest,
  GitPushResponse,
} from '../../../domain/ports/in/IGitUseCases';

export class GitPushUseCase implements IGitPushUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly gitClient: IGitClient,
  ) {}

  async execute(request: GitPushRequest): Promise<GitPushResponse> {
    const workspace = await this.workspaceRepository.findById(request.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${request.workspaceId}`);
    }

    const result = await this.gitClient.push(workspace.folderPath);
    return { success: result.success, error: result.error };
  }
}
