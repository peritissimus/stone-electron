import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IGitClient } from '../../../domain/ports/out/IGitClient';
import type {
  IGetGitStatusUseCase,
  GitStatusRequest,
  GitStatusResponse,
} from '../../../domain/ports/in/IGitUseCases';

export class GetGitStatusUseCase implements IGetGitStatusUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly gitClient: IGitClient,
  ) {}

  async execute(request: GitStatusRequest): Promise<GitStatusResponse> {
    const workspace = await this.workspaceRepository.findById(request.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${request.workspaceId}`);
    }

    const status = await this.gitClient.getStatus(workspace.folderPath);
    return {
      isRepo: status.isRepo,
      hasChanges: status.hasUncommittedChanges,
      branch: status.branch,
      remote: status.remoteUrl,
      ahead: status.ahead,
      behind: status.behind,
      staged: status.changes.filter((c) => c.staged).map((c) => c.path),
      modified: status.changes.filter((c) => c.status === 'modified').map((c) => c.path),
      untracked: status.changes.filter((c) => c.status === 'untracked').map((c) => c.path),
    };
  }
}
