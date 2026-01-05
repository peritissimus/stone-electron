/**
 * GitService - Git operations for workspace sync
 *
 * Provides git functionality at the workspace level:
 * - Check repo status
 * - Commit changes
 * - Push/pull from remote
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'node:path';
import fs from 'node:fs/promises';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

export interface GitStatus {
  isRepo: boolean;
  branch: string | null;
  hasRemote: boolean;
  remoteUrl: string | null;
  ahead: number;
  behind: number;
  staged: number;
  unstaged: number;
  untracked: number;
  hasChanges: boolean;
}

export interface GitCommitResult {
  success: boolean;
  hash?: string;
  message?: string;
  error?: string;
}

export interface GitSyncResult {
  success: boolean;
  pulled?: number;
  pushed?: number;
  error?: string;
}

export class GitService {
  /**
   * Execute a git command in a specific directory
   */
  private async execGit(workspacePath: string, args: string): Promise<{ stdout: string; stderr: string }> {
    const cmd = `git -C "${workspacePath}" ${args}`;
    logger.debug(`[GitService] Executing: ${cmd}`);

    try {
      const result = await execAsync(cmd, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large repos
      });
      return result;
    } catch (error: any) {
      // Git commands often use stderr for non-error output
      if (error.stdout !== undefined) {
        return { stdout: error.stdout, stderr: error.stderr };
      }
      throw error;
    }
  }

  /**
   * Check if a directory is a git repository
   */
  async isGitRepo(workspacePath: string): Promise<boolean> {
    try {
      const gitDir = path.join(workspacePath, '.git');
      const stats = await fs.stat(gitDir);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Initialize a new git repository
   */
  async init(workspacePath: string): Promise<boolean> {
    try {
      await this.execGit(workspacePath, 'init');
      logger.info(`[GitService] Initialized repo at ${workspacePath}`);
      return true;
    } catch (error) {
      logger.error(`[GitService] Failed to init repo:`, error);
      return false;
    }
  }

  /**
   * Get comprehensive git status
   */
  async getStatus(workspacePath: string): Promise<GitStatus> {
    const isRepo = await this.isGitRepo(workspacePath);

    if (!isRepo) {
      return {
        isRepo: false,
        branch: null,
        hasRemote: false,
        remoteUrl: null,
        ahead: 0,
        behind: 0,
        staged: 0,
        unstaged: 0,
        untracked: 0,
        hasChanges: false,
      };
    }

    try {
      // Get current branch
      const { stdout: branchOut } = await this.execGit(workspacePath, 'rev-parse --abbrev-ref HEAD');
      const branch = branchOut.trim();

      // Get remote URL
      let remoteUrl: string | null = null;
      let hasRemote = false;
      try {
        const { stdout: remoteOut } = await this.execGit(workspacePath, 'remote get-url origin');
        remoteUrl = remoteOut.trim();
        hasRemote = !!remoteUrl;
      } catch {
        // No remote configured
      }

      // Get ahead/behind counts
      let ahead = 0;
      let behind = 0;
      if (hasRemote) {
        try {
          const { stdout: statusOut } = await this.execGit(workspacePath, 'rev-list --left-right --count HEAD...@{upstream}');
          const [aheadStr, behindStr] = statusOut.trim().split('\t');
          ahead = parseInt(aheadStr, 10) || 0;
          behind = parseInt(behindStr, 10) || 0;
        } catch {
          // No upstream configured
        }
      }

      // Get file status counts
      const { stdout: statusOut } = await this.execGit(workspacePath, 'status --porcelain');
      const lines = statusOut.trim().split('\n').filter(Boolean);

      let staged = 0;
      let unstaged = 0;
      let untracked = 0;

      for (const line of lines) {
        const indexStatus = line[0];
        const workTreeStatus = line[1];

        if (indexStatus === '?') {
          untracked++;
        } else {
          if (indexStatus !== ' ' && indexStatus !== '?') {
            staged++;
          }
          if (workTreeStatus !== ' ' && workTreeStatus !== '?') {
            unstaged++;
          }
        }
      }

      return {
        isRepo: true,
        branch,
        hasRemote,
        remoteUrl,
        ahead,
        behind,
        staged,
        unstaged,
        untracked,
        hasChanges: staged > 0 || unstaged > 0 || untracked > 0,
      };
    } catch (error) {
      logger.error(`[GitService] Failed to get status:`, error);
      return {
        isRepo: true,
        branch: null,
        hasRemote: false,
        remoteUrl: null,
        ahead: 0,
        behind: 0,
        staged: 0,
        unstaged: 0,
        untracked: 0,
        hasChanges: false,
      };
    }
  }

  /**
   * Stage all changes and commit
   */
  async commit(workspacePath: string, message?: string): Promise<GitCommitResult> {
    try {
      // Stage all changes
      await this.execGit(workspacePath, 'add -A');

      // Check if there's anything to commit
      const status = await this.getStatus(workspacePath);
      if (status.staged === 0) {
        return { success: true, message: 'Nothing to commit' };
      }

      // Create commit message
      const commitMessage = message || `Auto-sync: ${new Date().toLocaleString()}`;

      // Commit
      const { stdout } = await this.execGit(workspacePath, `commit -m "${commitMessage.replace(/"/g, '\\"')}"`);

      // Extract commit hash
      const hashMatch = stdout.match(/\[[\w-]+ ([a-f0-9]+)\]/);
      const hash = hashMatch ? hashMatch[1] : undefined;

      logger.info(`[GitService] Committed: ${hash}`);
      return { success: true, hash, message: commitMessage };
    } catch (error: any) {
      logger.error(`[GitService] Commit failed:`, error);
      return { success: false, error: error.message || 'Commit failed' };
    }
  }

  /**
   * Pull changes from remote
   */
  async pull(workspacePath: string): Promise<GitSyncResult> {
    try {
      const { stdout } = await this.execGit(workspacePath, 'pull --rebase');

      // Count pulled commits (rough estimate from output)
      const pulled = (stdout.match(/Updating|Fast-forward/g) || []).length;

      logger.info(`[GitService] Pulled changes`);
      return { success: true, pulled };
    } catch (error: any) {
      logger.error(`[GitService] Pull failed:`, error);
      return { success: false, error: error.message || 'Pull failed' };
    }
  }

  /**
   * Push changes to remote
   */
  async push(workspacePath: string): Promise<GitSyncResult> {
    try {
      const { stdout } = await this.execGit(workspacePath, 'push');

      logger.info(`[GitService] Pushed changes`);
      return { success: true, pushed: 1 };
    } catch (error: any) {
      logger.error(`[GitService] Push failed:`, error);
      return { success: false, error: error.message || 'Push failed' };
    }
  }

  /**
   * Full sync: commit, pull, push
   */
  async sync(workspacePath: string, commitMessage?: string): Promise<GitSyncResult> {
    try {
      const status = await this.getStatus(workspacePath);

      if (!status.isRepo) {
        return { success: false, error: 'Not a git repository' };
      }

      if (!status.hasRemote) {
        return { success: false, error: 'No remote configured' };
      }

      // Commit local changes first
      if (status.hasChanges) {
        const commitResult = await this.commit(workspacePath, commitMessage);
        if (!commitResult.success) {
          return { success: false, error: commitResult.error };
        }
      }

      // Pull with rebase
      const pullResult = await this.pull(workspacePath);
      if (!pullResult.success) {
        return { success: false, error: pullResult.error };
      }

      // Push
      const pushResult = await this.push(workspacePath);
      if (!pushResult.success) {
        return { success: false, error: pushResult.error };
      }

      logger.info(`[GitService] Sync completed for ${workspacePath}`);
      return {
        success: true,
        pulled: pullResult.pulled,
        pushed: pushResult.pushed
      };
    } catch (error: any) {
      logger.error(`[GitService] Sync failed:`, error);
      return { success: false, error: error.message || 'Sync failed' };
    }
  }

  /**
   * Set remote URL
   */
  async setRemote(workspacePath: string, url: string): Promise<boolean> {
    try {
      // Check if remote exists
      try {
        await this.execGit(workspacePath, 'remote get-url origin');
        // Remote exists, update it
        await this.execGit(workspacePath, `remote set-url origin "${url}"`);
      } catch {
        // Remote doesn't exist, add it
        await this.execGit(workspacePath, `remote add origin "${url}"`);
      }

      logger.info(`[GitService] Set remote to ${url}`);
      return true;
    } catch (error) {
      logger.error(`[GitService] Failed to set remote:`, error);
      return false;
    }
  }

  /**
   * Get recent commits
   */
  async getRecentCommits(workspacePath: string, limit: number = 10): Promise<Array<{
    hash: string;
    message: string;
    author: string;
    date: string;
  }>> {
    try {
      const { stdout } = await this.execGit(
        workspacePath,
        `log --pretty=format:"%h|%s|%an|%ar" -n ${limit}`
      );

      return stdout.trim().split('\n').filter(Boolean).map(line => {
        const [hash, message, author, date] = line.split('|');
        return { hash, message, author, date };
      });
    } catch {
      return [];
    }
  }
}

// Singleton instance
let instance: GitService | null = null;

export function getGitService(): GitService {
  if (!instance) {
    instance = new GitService();
  }
  return instance;
}
