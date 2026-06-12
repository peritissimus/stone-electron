import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IGitClient } from '../../../domain/ports/out/IGitClient';
import type { ISettingsRepository } from '../../../domain/ports/out/ISettingsRepository';
import { lastSyncSettingKey } from './GitSyncUseCase';
import type {
  IGetGitStatusUseCase,
  GitStatusRequest,
  GitStatusResponse,
} from '../../../domain/ports/in/IGitUseCases';

export class GetGitStatusUseCase implements IGetGitStatusUseCase {
  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly gitClient: IGitClient,
    private readonly settingsRepository: ISettingsRepository,
  ) {}

  async execute(request: GitStatusRequest): Promise<GitStatusResponse> {
    const workspace = await this.workspaceRepository.findById(request.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${request.workspaceId}`);
    }

    const status = await this.gitClient.getStatus(workspace.folderPath);
    let lastSyncAt: string | null = null;
    try {
      lastSyncAt =
        (await this.settingsRepository.get(lastSyncSettingKey(request.workspaceId)))?.value ??
        null;
    } catch {
      // cosmetic — status remains useful without it
    }
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
      lastSyncAt,
    };
  }
}
