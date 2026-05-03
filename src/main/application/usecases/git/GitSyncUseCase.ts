import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IGitClient } from '../../../domain/ports/out/IGitClient';
import type {
  IGitSyncUseCase,
  GitSyncRequest,
  GitSyncResponse,
} from '../../../domain/ports/in/IGitUseCases';

export class GitSyncUseCase implements IGitSyncUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly gitClient: IGitClient,
  ) {}

  async execute(request: GitSyncRequest): Promise<GitSyncResponse> {
    const workspace = await this.workspaceRepository.findById(request.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${request.workspaceId}`);
    }

    const result = await this.gitClient.sync(
      workspace.folderPath,
      request.message || `Sync: ${new Date().toISOString()}`,
    );
    return {
      success: result.success,
      pulled: 0,
      pushed: 0,
      conflicts: [],
      error: result.error,
    };
  }
}
