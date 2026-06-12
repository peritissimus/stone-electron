import type { IFileStorage } from '../../../domain/ports/out/IFileStorage';
import type { IPathService } from '../../../domain/ports/out/IPathService';

/**
 * Default ignore rules for a notes workspace. `.stone/` is critical: it
 * holds in-flight recording audio (WAV/PCM scratch) — without this, a sync
 * during a meeting commits raw audio into the notes repo.
 */
export const WORKSPACE_GITIGNORE = `# Stone internal scratch — in-flight recordings, caches.
.stone/
.DS_Store
`;

/** Seed .gitignore if the workspace doesn't have one. Never overwrites. */
export async function ensureWorkspaceGitignore(
  fileStorage: IFileStorage,
  pathService: IPathService,
  workspaceFolderPath: string,
): Promise<void> {
  const gitignorePath = pathService.join(workspaceFolderPath, '.gitignore');
  if (await fileStorage.exists(gitignorePath)) return;
  await fileStorage.write(gitignorePath, WORKSPACE_GITIGNORE);
}
