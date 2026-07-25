import { Effect } from 'effect';
import type { EffectPort, IFileStorage, IPathService } from '../../../domain';

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
export function ensureWorkspaceGitignore(
  fileStorage: EffectPort<IFileStorage>,
  pathService: EffectPort<IPathService>,
  workspaceFolderPath: string,
): Effect.Effect<void, Error> {
  return pathService.join(workspaceFolderPath, '.gitignore').pipe(
    Effect.flatMap((gitignorePath) =>
      fileStorage.exists(gitignorePath).pipe(
        Effect.flatMap((exists) =>
          exists
            ? Effect.void
            : fileStorage.write(gitignorePath, WORKSPACE_GITIGNORE),
        ),
      ),
    ),
  );
}
