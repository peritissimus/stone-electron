/**
 * Git Service Adapter - Git operations using simple-git
 */

import type {
  IGitClient,
  GitStatus,
  GitCommit,
  GitOperationResult,
  GitSyncResult,
  GitErrorKind,
  GitFileChange,
} from '../../../domain';
import { logger } from '../../../shared';

// Dynamically import simple-git when needed
let simpleGit: any = null;

async function getSimpleGit() {
  if (!simpleGit) {
    const module = await import('simple-git');
    simpleGit = module.simpleGit;
  }
  return simpleGit;
}

/**
 * Open a repo handle with interactive prompts disabled. Without
 * GIT_TERMINAL_PROMPT=0, an HTTPS remote with missing credentials makes
 * git wait forever for a username on a TTY that doesn't exist — the sync
 * appears to hang. With it, the same situation fails fast with an auth
 * error we can classify.
 */
async function openRepo(path: string) {
  const factory = await getSimpleGit();
  return factory(path).env({
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    // Match terminal-prompt behavior for ssh: fail instead of asking.
    GIT_SSH_COMMAND: process.env.GIT_SSH_COMMAND ?? 'ssh -oBatchMode=yes',
  });
}

/** Map a raw git error message onto an actionable category. */
function classifyGitError(message: string): GitErrorKind {
  const m = message.toLowerCase();
  if (
    m.includes('authentication failed') ||
    m.includes('could not read username') ||
    m.includes('could not read password') ||
    m.includes('permission denied') ||
    m.includes('host key verification failed') ||
    m.includes('terminal prompts disabled')
  ) {
    return 'auth';
  }
  if (
    m.includes('could not resolve host') ||
    m.includes('unable to access') ||
    m.includes('connection timed out') ||
    m.includes('connection refused') ||
    m.includes('network is unreachable') ||
    m.includes('operation timed out')
  ) {
    return 'network';
  }
  if (m.includes('conflict') || m.includes('could not apply') || m.includes('needs merge')) {
    return 'conflict';
  }
  return 'unknown';
}

/**
 * Git Service implementation using simple-git
 */
export class GitClient implements IGitClient {
  async isRepository(path: string): Promise<boolean> {
    return await logger.withContext('out:GitClient.isRepository', async () => {
      try {
        const git = (await getSimpleGit())(path);
        return await git.checkIsRepo();
      } catch {
        return false;
      }
    });
  }

  async init(path: string): Promise<GitOperationResult> {
    return await logger.withContext('out:GitClient.init', async () => {
      try {
        const git = (await getSimpleGit())(path);
        await git.init();
        logger.info(`[GitClient] Initialized repository at ${path}`);
        return { success: true, message: 'Repository initialized' };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[GitClient] Init failed:', error);
        return { success: false, error: message };
      }
    });
  }

  async getStatus(path: string): Promise<GitStatus> {
    return await logger.withContext('out:GitClient.getStatus', async () => {
      try {
        const git = (await getSimpleGit())(path);
        const isRepo = await git.checkIsRepo();

      if (!isRepo) {
        return {
          isRepo: false,
          branch: null,
          ahead: 0,
          behind: 0,
          hasRemote: false,
          remoteUrl: null,
          changes: [],
          hasUncommittedChanges: false,
        };
      }

      const status = await git.status();
      const remotes = await git.getRemotes(true);
      const remote = remotes.find((r: any) => r.name === 'origin');

      const changes: GitFileChange[] = [
        ...status.modified.map((f: string) => ({
          path: f,
          status: 'modified' as const,
          staged: false,
        })),
        ...status.created.map((f: string) => ({
          path: f,
          status: 'added' as const,
          staged: false,
        })),
        ...status.deleted.map((f: string) => ({
          path: f,
          status: 'deleted' as const,
          staged: false,
        })),
        ...status.renamed.map((f: any) => ({
          path: f.to,
          status: 'renamed' as const,
          staged: false,
        })),
        ...status.not_added.map((f: string) => ({
          path: f,
          status: 'untracked' as const,
          staged: false,
        })),
        ...status.staged.map((f: string) => ({
          path: f,
          status: 'modified' as const,
          staged: true,
        })),
      ];

        return {
          isRepo: true,
          branch: status.current || null,
          ahead: status.ahead || 0,
          behind: status.behind || 0,
          hasRemote: !!remote,
          remoteUrl: remote?.refs?.fetch || null,
          changes,
          hasUncommittedChanges: !status.isClean(),
        };
      } catch (error) {
        logger.error('[GitClient] getStatus failed:', error);
        return {
          isRepo: false,
          branch: null,
          ahead: 0,
          behind: 0,
          hasRemote: false,
          remoteUrl: null,
          changes: [],
          hasUncommittedChanges: false,
        };
      }
    });
  }

  async stage(path: string, files?: string[]): Promise<GitOperationResult> {
    return await logger.withContext('out:GitClient.stage', async () => {
      try {
        const git = (await getSimpleGit())(path);
        if (files && files.length > 0) {
          await git.add(files);
        } else {
          await git.add('.');
        }
        return { success: true, message: 'Files staged' };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[GitClient] Stage failed:', error);
        return { success: false, error: message };
      }
    });
  }

  async commit(path: string, message: string): Promise<GitOperationResult> {
    return await logger.withContext('out:GitClient.commit', async () => {
      try {
        const git = (await getSimpleGit())(path);
        const result = await git.commit(message);
        logger.info(`[GitClient] Committed: ${result.commit}`);
        return { success: true, message: `Committed ${result.commit}` };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[GitClient] Commit failed:', error);
        return { success: false, error: message };
      }
    });
  }

  async pull(path: string): Promise<GitOperationResult> {
    return await logger.withContext('out:GitClient.pull', async () => {
      try {
        const git = (await getSimpleGit())(path);
        const result = await git.pull();
        logger.info('[GitClient] Pulled changes');
        return {
          success: true,
          message: `Pulled ${result.summary.changes} changes, ${result.summary.insertions} insertions, ${result.summary.deletions} deletions`,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[GitClient] Pull failed:', error);
        return { success: false, error: message };
      }
    });
  }

  async push(path: string): Promise<GitOperationResult> {
    return await logger.withContext('out:GitClient.push', async () => {
      try {
        const git = (await getSimpleGit())(path);
        await git.push();
        logger.info('[GitClient] Pushed changes');
        return { success: true, message: 'Pushed to remote' };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[GitClient] Push failed:', error);
        return { success: false, error: message };
      }
    });
  }

  async setRemote(path: string, url: string, name: string = 'origin'): Promise<GitOperationResult> {
    return await logger.withContext('out:GitClient.setRemote', async () => {
      try {
        const git = (await getSimpleGit())(path);
        const remotes = await git.getRemotes();

        if (remotes.find((r: any) => r.name === name)) {
          await git.remote(['set-url', name, url]);
        } else {
          await git.addRemote(name, url);
        }

        logger.info(`[GitClient] Set remote ${name} to ${url}`);
        return { success: true, message: `Remote ${name} set to ${url}` };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[GitClient] setRemote failed:', error);
        return { success: false, error: message };
      }
    });
  }

  async getCommits(path: string, limit: number = 50): Promise<GitCommit[]> {
    return await logger.withContext('out:GitClient.getCommits', async () => {
      try {
        const git = (await getSimpleGit())(path);
        const log = await git.log({ maxCount: limit });

        return log.all.map((entry: any) => ({
          hash: entry.hash,
          shortHash: entry.hash.substring(0, 7),
          message: entry.message,
          author: entry.author_name,
          email: entry.author_email,
          date: new Date(entry.date),
        }));
      } catch (error) {
        logger.error('[GitClient] getCommits failed:', error);
        return [];
      }
    });
  }

  async sync(path: string, message?: string): Promise<GitSyncResult> {
    return await logger.withContext('out:GitClient.sync', async () => {
      const fail = (error: unknown, fallbackKind?: GitErrorKind): GitSyncResult => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('[GitClient] Sync failed:', error);
        return {
          success: false,
          committed,
          commitMessage,
          pulledCount: 0,
          pushedCount: 0,
          conflicts: [],
          errorKind: fallbackKind ?? classifyGitError(errorMessage),
          error: errorMessage,
        };
      };

      let committed = false;
      let commitMessage: string | undefined;

      try {
        const git = await openRepo(path);

        // 1. Commit local changes (if any).
        const before = await git.status();
        if (!before.isClean()) {
          await git.add('.');
          const changeCount =
            before.modified.length +
            before.created.length +
            before.deleted.length +
            before.renamed.length +
            before.not_added.length;
          commitMessage = message ?? defaultCommitMessage(changeCount);
          await git.commit(commitMessage);
          committed = true;
        }

        // No remote → a local-only commit is a successful "sync".
        const remotes = await git.getRemotes();
        if (!remotes.some((r: { name: string }) => r.name === 'origin')) {
          return {
            success: true,
            committed,
            commitMessage,
            pulledCount: 0,
            pushedCount: 0,
            conflicts: [],
          };
        }

        // 2. Fetch so ahead/behind are real, then integrate.
        await git.fetch();
        const divergence = await git.status();
        const pulledCount = divergence.behind ?? 0;

        if (pulledCount > 0) {
          try {
            // Rebase keeps a single-user history linear — no
            // "Merge branch 'main'" noise from syncing two devices.
            await git.pull(['--rebase']);
          } catch (pullError) {
            // Rebase stopped on conflicts: collect the files, then abort
            // so the tree is left clean with the local commit intact.
            let conflicts: string[] = [];
            try {
              const conflictStatus = await git.status();
              conflicts = conflictStatus.conflicted ?? [];
            } catch {
              // status unavailable mid-rebase failure — report empty list.
            }
            try {
              await git.rebase(['--abort']);
            } catch {
              // nothing to abort (pull failed before rebasing).
            }
            const errorMessage =
              pullError instanceof Error ? pullError.message : String(pullError);
            const kind = classifyGitError(errorMessage);
            return {
              success: false,
              committed,
              commitMessage,
              pulledCount: 0,
              pushedCount: 0,
              conflicts,
              errorKind: conflicts.length > 0 ? 'conflict' : kind,
              error: errorMessage,
            };
          }
        }

        // 3. Push whatever we're ahead by.
        const afterPull = await git.status();
        const pushedCount = afterPull.ahead ?? 0;
        if (pushedCount > 0) {
          await git.push();
        }

        logger.info('[GitClient] Synced repository', { pulledCount, pushedCount, committed });
        return {
          success: true,
          committed,
          commitMessage,
          pulledCount,
          pushedCount,
          conflicts: [],
        };
      } catch (error) {
        return fail(error);
      }
    });
  }
}

/** "stone: 3 changes · 2026-06-13 09:30" — human-scannable in any git UI. */
function defaultCommitMessage(changeCount: number): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return `stone: ${changeCount} change${changeCount === 1 ? '' : 's'} · ${stamp}`;
}
