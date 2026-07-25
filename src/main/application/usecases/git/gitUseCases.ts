import { Deferred, Effect, Layer, Ref } from 'effect';
import {
  FileStoragePort,
  GitClientPort,
  GitUseCasesPort,
  PathServicePort,
  SettingsRepositoryPort,
  WorkspaceRepositoryPort,
  type GitSyncRequest,
  type GitSyncResponse,
  type IGitUseCases,
} from '../../../domain';
import { ensureWorkspaceGitignore } from './workspaceGitignore';

export const lastSyncSettingKey = (workspaceId: string) =>
  `git.lastSyncAt.${workspaceId}`;

export const GitUseCasesLive = Layer.effect(
  GitUseCasesPort,
  Effect.gen(function* () {
    const workspaces = yield* WorkspaceRepositoryPort;
    const git = yield* GitClientPort;
    const files = yield* FileStoragePort;
    const paths = yield* PathServicePort;
    const settings = yield* SettingsRepositoryPort;
    const inFlight = yield* Ref.make(
      new Map<string, Deferred.Deferred<GitSyncResponse, Error>>(),
    );

    const workspacePath = (workspaceId: string) =>
      workspaces.findById(workspaceId).pipe(
        Effect.flatMap((workspace) =>
          workspace
            ? Effect.succeed(workspace.folderPath)
            : Effect.fail(new Error(`Workspace not found: ${workspaceId}`)),
        ),
      );

    const runSync = (request: GitSyncRequest) =>
      workspacePath(request.workspaceId).pipe(
        Effect.tap((folderPath) =>
          ensureWorkspaceGitignore(files, paths, folderPath).pipe(
            Effect.catchAll(() => Effect.void),
          ),
        ),
        Effect.flatMap((folderPath) =>
          git.sync(folderPath, request.message).pipe(
            Effect.tap((result) =>
              result.success
                ? Effect.clockWith((clock) => clock.currentTimeMillis).pipe(
                    Effect.flatMap((now) =>
                      settings.set(
                        lastSyncSettingKey(request.workspaceId),
                        new Date(now).toISOString(),
                      ),
                    ),
                    Effect.catchAll(() => Effect.void),
                  )
                : Effect.void,
            ),
          ),
        ),
        Effect.map((result) => ({
          success: result.success,
          committed: result.committed,
          pulled: result.pulledCount,
          pushed: result.pushedCount,
          conflicts: result.conflicts,
          errorKind: result.errorKind,
          error: result.error,
        })),
      );

    const sync: IGitUseCases['sync']['execute'] = (request) =>
      Effect.gen(function* () {
        const candidate =
          yield* Deferred.make<GitSyncResponse, Error>();
        const selection = yield* Ref.modify(inFlight, (current) => {
          const existing = current.get(request.workspaceId);
          if (existing) return [{ deferred: existing, leader: false }, current];
          const next = new Map(current);
          next.set(request.workspaceId, candidate);
          return [{ deferred: candidate, leader: true }, next];
        });
        if (!selection.leader) return yield* Deferred.await(selection.deferred);
        return yield* runSync(request).pipe(
          Effect.onExit((exit) => Deferred.done(selection.deferred, exit)),
          Effect.ensuring(
            Ref.update(inFlight, (current) => {
              const next = new Map(current);
              next.delete(request.workspaceId);
              return next;
            }),
          ),
        );
      });

    const service: IGitUseCases = {
      getStatus: {
        execute: (request) =>
          workspacePath(request.workspaceId).pipe(
            Effect.flatMap((folderPath) =>
              Effect.all(
                [
                  git.getStatus(folderPath),
                  settings
                    .get(lastSyncSettingKey(request.workspaceId))
                    .pipe(
                      Effect.map((setting) => setting?.value ?? null),
                      Effect.catchAll(() => Effect.succeed(null)),
                    ),
                ],
                { concurrency: 'unbounded' },
              ),
            ),
            Effect.map(([status, lastSyncAt]) => ({
              isRepo: status.isRepo,
              hasChanges: status.hasUncommittedChanges,
              branch: status.branch,
              remote: status.remoteUrl,
              ahead: status.ahead,
              behind: status.behind,
              staged: status.changes
                .filter((change) => change.staged)
                .map((change) => change.path),
              modified: status.changes
                .filter((change) => change.status === 'modified')
                .map((change) => change.path),
              untracked: status.changes
                .filter((change) => change.status === 'untracked')
                .map((change) => change.path),
              lastSyncAt,
            })),
          ),
      },
      init: {
        execute: (request) =>
          workspacePath(request.workspaceId).pipe(
            Effect.flatMap((folderPath) =>
              git.init(folderPath).pipe(
                Effect.tap((result) =>
                  result.success
                    ? ensureWorkspaceGitignore(files, paths, folderPath).pipe(
                        Effect.catchAll(() => Effect.void),
                      )
                    : Effect.void,
                ),
              ),
            ),
            Effect.map((result) => ({ success: result.success })),
          ),
      },
      commit: {
        execute: (request) =>
          workspacePath(request.workspaceId).pipe(
            Effect.flatMap((folderPath) =>
              git.stage(folderPath).pipe(
                Effect.flatMap(() =>
                  Effect.clockWith((clock) => clock.currentTimeMillis).pipe(
                    Effect.flatMap((now) =>
                      git.commit(
                        folderPath,
                        request.message ??
                          `Commit: ${new Date(now).toISOString()}`,
                      ),
                    ),
                  ),
                ),
                Effect.flatMap((result) =>
                  result.success
                    ? git.getCommits(folderPath, 1).pipe(
                        Effect.flatMap((commits) =>
                          Effect.clockWith(
                            (clock) => clock.currentTimeMillis,
                          ).pipe(
                            Effect.map((now) => {
                              const latest = commits[0];
                              return {
                                hash: latest?.hash ?? '',
                                shortHash: latest?.shortHash ?? '',
                                message:
                                  latest?.message ?? request.message ?? '',
                                author: latest?.author ?? '',
                                date: latest?.date ?? new Date(now),
                              };
                            }),
                          ),
                        ),
                      )
                    : Effect.succeed(null),
                ),
              ),
            ),
          ),
      },
      pull: {
        execute: (request) =>
          workspacePath(request.workspaceId).pipe(
            Effect.flatMap((folderPath) => git.pull(folderPath)),
            Effect.map(({ success, error }) => ({ success, error })),
          ),
      },
      push: {
        execute: (request) =>
          workspacePath(request.workspaceId).pipe(
            Effect.flatMap((folderPath) => git.push(folderPath)),
            Effect.map(({ success, error }) => ({ success, error })),
          ),
      },
      sync: { execute: sync },
      setRemote: {
        execute: (request) =>
          workspacePath(request.workspaceId).pipe(
            Effect.flatMap((folderPath) =>
              git.setRemote(folderPath, request.url, 'origin'),
            ),
            Effect.map(({ success }) => ({ success })),
          ),
      },
      getCommits: {
        execute: (request) =>
          workspacePath(request.workspaceId).pipe(
            Effect.flatMap((folderPath) =>
              git.getCommits(folderPath, request.limit || 50),
            ),
            Effect.map((commits) => ({
              commits: commits.map(
                ({ hash, shortHash, message, author, date }) => ({
                  hash,
                  shortHash,
                  message,
                  author,
                  date,
                }),
              ),
            })),
          ),
      },
    };
    return service;
  }),
);
