/**
 * Git Operations Adapter
 *
 * Implements IGitOperations port using simple-git.
 */

import { simpleGit, SimpleGit } from 'simple-git';
import type { IGitOperations, GitStatus, GitCommit, GitSyncResult } from '../../../domain';

export class GitOperations implements IGitOperations {
  private getGit(workspacePath: string): SimpleGit {
    return simpleGit(workspacePath);
  }

  async isRepo(workspacePath: string): Promise<boolean> {
    try {
      const git = this.getGit(workspacePath);
      return await git.checkIsRepo();
    } catch {
      return false;
    }
  }

  async init(workspacePath: string): Promise<boolean> {
    try {
      const git = this.getGit(workspacePath);
      await git.init();
      return true;
    } catch {
      return false;
    }
  }

  async getStatus(workspacePath: string): Promise<GitStatus> {
    try {
      const git = this.getGit(workspacePath);
      const isRepo = await git.checkIsRepo();

      if (!isRepo) {
        return {
          isRepo: false,
          hasChanges: false,
          branch: null,
          remote: null,
          ahead: 0,
          behind: 0,
          staged: [],
          modified: [],
          untracked: [],
        };
      }

      const status = await git.status();
      const remotes = await git.getRemotes(true);
      const remote = remotes.find((r) => r.name === 'origin')?.refs?.fetch || null;

      return {
        isRepo: true,
        hasChanges: !status.isClean(),
        branch: status.current,
        remote,
        ahead: status.ahead,
        behind: status.behind,
        staged: status.staged,
        modified: status.modified,
        untracked: status.not_added,
      };
    } catch {
      return {
        isRepo: false,
        hasChanges: false,
        branch: null,
        remote: null,
        ahead: 0,
        behind: 0,
        staged: [],
        modified: [],
        untracked: [],
      };
    }
  }

  async commit(workspacePath: string, message?: string): Promise<GitCommit | null> {
    try {
      const git = this.getGit(workspacePath);

      // Stage all changes
      await git.add('.');

      // Commit
      const commitMessage = message || `Auto-commit at ${new Date().toISOString()}`;
      const result = await git.commit(commitMessage);

      if (!result.commit) return null;

      return {
        hash: result.commit,
        shortHash: result.commit.substring(0, 7),
        message: commitMessage,
        author: 'Stone',
        date: new Date(),
      };
    } catch {
      return null;
    }
  }

  async pull(workspacePath: string): Promise<{ success: boolean; error?: string }> {
    try {
      const git = this.getGit(workspacePath);
      await git.pull();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Pull failed',
      };
    }
  }

  async push(workspacePath: string): Promise<{ success: boolean; error?: string }> {
    try {
      const git = this.getGit(workspacePath);
      await git.push();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Push failed',
      };
    }
  }

  async sync(workspacePath: string, message?: string): Promise<GitSyncResult> {
    try {
      const git = this.getGit(workspacePath);

      // Pull first
      const pullResult = await this.pull(workspacePath);
      if (!pullResult.success) {
        return {
          success: false,
          pulled: 0,
          pushed: 0,
          conflicts: [],
          error: pullResult.error,
        };
      }

      // Commit changes
      await this.commit(workspacePath, message);

      // Push
      const pushResult = await this.push(workspacePath);

      return {
        success: pushResult.success,
        pulled: 0,
        pushed: pushResult.success ? 1 : 0,
        conflicts: [],
        error: pushResult.error,
      };
    } catch (error) {
      return {
        success: false,
        pulled: 0,
        pushed: 0,
        conflicts: [],
        error: error instanceof Error ? error.message : 'Sync failed',
      };
    }
  }

  async setRemote(workspacePath: string, url: string): Promise<boolean> {
    try {
      const git = this.getGit(workspacePath);
      const remotes = await git.getRemotes();

      if (remotes.some((r) => r.name === 'origin')) {
        await git.remote(['set-url', 'origin', url]);
      } else {
        await git.addRemote('origin', url);
      }

      return true;
    } catch {
      return false;
    }
  }

  async getRemote(workspacePath: string): Promise<string | null> {
    try {
      const git = this.getGit(workspacePath);
      const remotes = await git.getRemotes(true);
      return remotes.find((r) => r.name === 'origin')?.refs?.fetch || null;
    } catch {
      return null;
    }
  }

  async getRecentCommits(workspacePath: string, limit = 10): Promise<GitCommit[]> {
    try {
      const git = this.getGit(workspacePath);
      const log = await git.log({ maxCount: limit });

      return log.all.map((commit) => ({
        hash: commit.hash,
        shortHash: commit.hash.substring(0, 7),
        message: commit.message,
        author: commit.author_name,
        date: new Date(commit.date),
      }));
    } catch {
      return [];
    }
  }

  async discardChanges(workspacePath: string, filePath: string): Promise<boolean> {
    try {
      const git = this.getGit(workspacePath);
      await git.checkout(['--', filePath]);
      return true;
    } catch {
      return false;
    }
  }

  async getDiff(workspacePath: string, filePath?: string): Promise<string> {
    try {
      const git = this.getGit(workspacePath);
      if (filePath) {
        return await git.diff(['--', filePath]);
      }
      return await git.diff();
    } catch {
      return '';
    }
  }
}
