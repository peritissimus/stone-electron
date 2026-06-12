import type { IWorkspaceRepository } from '../../../domain/ports/out/IWorkspaceRepository';
import type { IGitClient } from '../../../domain/ports/out/IGitClient';
import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IPathService } from '../../../domain/ports/out/IPathService';
import type { ISettingsRepository } from '../../../domain/ports/out/ISettingsRepository';
import type {
  IGitSyncUseCase,
  GitSyncRequest,
  GitSyncResponse,
} from '../../../domain/ports/in/IGitUseCases';
import { ensureWorkspaceGitignore } from './workspaceGitignore';

/** Settings key holding the last successful sync time (ISO) per workspace. */
export const lastSyncSettingKey = (workspaceId: string) => `git.lastSyncAt.${workspaceId}`;

export class GitSyncUseCase implements IGitSyncUseCase {
  // Single-flight per workspace: a second sync while one is running joins
  // the in-flight result instead of stacking commits/pulls (spamming the
  // sidebar button must be harmless).
  private readonly inFlight = new Map<string, Promise<GitSyncResponse>>();

  constructor(
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly gitClient: IGitClient,
    private readonly fileStorage: IFileStorage,
    private readonly pathService: IPathService,
    private readonly settingsRepository: ISettingsRepository,
  ) {}

  async execute(request: GitSyncRequest): Promise<GitSyncResponse> {
    const existing = this.inFlight.get(request.workspaceId);
    if (existing) return existing;

    const run = this.run(request).finally(() => {
      this.inFlight.delete(request.workspaceId);
    });
    this.inFlight.set(request.workspaceId, run);
    return run;
  }

  private async run(request: GitSyncRequest): Promise<GitSyncResponse> {
    const workspace = await this.workspaceRepository.findById(request.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${request.workspaceId}`);
    }

    // Guard BEFORE staging: without it, a sync mid-meeting commits the
    // in-flight recording audio under .stone/ into the notes repo.
    try {
      await ensureWorkspaceGitignore(this.fileStorage, this.pathService, workspace.folderPath);
    } catch {
      // Best-effort — a failed seed shouldn't block the sync itself.
    }

    const result = await this.gitClient.sync(workspace.folderPath, request.message);

    if (result.success) {
      try {
        await this.settingsRepository.set(
          lastSyncSettingKey(request.workspaceId),
          new Date().toISOString(),
        );
      } catch {
        // Timestamp is cosmetic; never fail a successful sync over it.
      }
    }

    return {
      success: result.success,
      committed: result.committed,
      pulled: result.pulledCount,
      pushed: result.pushedCount,
      conflicts: result.conflicts,
      errorKind: result.errorKind,
      error: result.error,
    };
  }
}
