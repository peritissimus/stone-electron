/**
 * Git Service Adapter - Git operations using simple-git
 */

import type {
  IGitClient,
  GitStatus,
  GitCommit,
  GitOperationResult,
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

  async sync(path: string, message?: string): Promise<GitOperationResult> {
    return await logger.withContext('out:GitClient.sync', async () => {
      try {
        const git = (await getSimpleGit())(path);

        // Stage all changes
        await git.add('.');

        // Check if there are changes to commit
        const status = await git.status();
        if (!status.isClean()) {
          await git.commit(message || `Sync: ${new Date().toISOString()}`);
        }

        // Pull then push
        await git.pull();
        await git.push();

        logger.info('[GitClient] Synced repository');
        return { success: true, message: 'Repository synced' };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[GitClient] Sync failed:', error);
        return { success: false, error: errorMessage };
      }
    });
  }
}
