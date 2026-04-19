import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IGitClient } from '../../../domain/ports/out/IGitClient';
import type {
  ISetGitRemoteUseCase,
  GitSetRemoteRequest,
  GitSetRemoteResponse,
} from '../../../domain/ports/in/IGitUseCases';
import { logger } from '../../../shared/utils';

export class SetGitRemoteUseCase implements ISetGitRemoteUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly gitClient: IGitClient,
  ) {}

  async execute(request: GitSetRemoteRequest): Promise<GitSetRemoteResponse> {
    const workspace = await this.workspaceRepository.findById(request.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${request.workspaceId}`);
    }

    const result = await this.gitClient.setRemote(workspace.folderPath, request.url, 'origin');
    logger.info(
      `[GitUseCases] Set remote origin to ${request.url} in workspace ${request.workspaceId}`,
    );
    return { success: result.success };
  }
}
