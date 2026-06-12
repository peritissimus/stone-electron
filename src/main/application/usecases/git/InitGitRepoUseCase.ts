import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IGitClient } from '../../../domain/ports/out/IGitClient';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IPathService } from '../../../domain/ports/out/IPathService';
import { ensureWorkspaceGitignore } from './workspaceGitignore';
import type {
  IInitGitRepoUseCase,
  GitInitRequest,
  GitInitResponse,
} from '../../../domain/ports/in/IGitUseCases';

export class InitGitRepoUseCase implements IInitGitRepoUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly gitClient: IGitClient,
    private readonly fileStorage: IFileStorage,
    private readonly pathService: IPathService,
  ) {}

  async execute(request: GitInitRequest): Promise<GitInitResponse> {
    const workspace = await this.workspaceRepository.findById(request.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${request.workspaceId}`);
    }

    const result = await this.gitClient.init(workspace.folderPath);
    if (result.success) {
      // New repo: keep Stone scratch (in-flight recordings) out of history
      // from the very first commit.
      try {
        await ensureWorkspaceGitignore(this.fileStorage, this.pathService, workspace.folderPath);
      } catch {
        // best-effort
      }
    }
    return { success: result.success };
  }
}
