/**
 * Git Operations Adapter
 *
 * Implements IGitOperations port wrapping the existing GitService.
 */

import type {
  IGitOperations,
  GitStatus,
  GitCommit,
  GitSyncResult,
} from '../../../domain/ports/out/IGitOperations';
import { GitService } from '@main/services/GitService';

export class GitOperations implements IGitOperations {
  private readonly service = new GitService();

  async isRepo(workspacePath: string): Promise<boolean> {
    return this.service.isGitRepo(workspacePath);
  }

  async init(workspacePath: string): Promise<boolean> {
    // GitService doesn't have initRepo - stub for now
    return false;
  }

  async getStatus(workspacePath: string): Promise<GitStatus> {
    const status = await this.service.getStatus(workspacePath);
    return {
      isRepo: status.isRepo,
      hasChanges: status.hasChanges,
      branch: status.branch,
      remote: null, // Not provided by service
      ahead: status.ahead,
      behind: status.behind,
      // GitService returns counts, not file lists - return empty arrays
      // To get actual file lists, would need to implement git status parsing
      staged: [],
      modified: [],
      untracked: [],
    };
  }

  async commit(workspacePath: string, message?: string): Promise<GitCommit | null> {
    const result = await this.service.commit(workspacePath, message);
    if (!result?.hash) return null;
    return {
      hash: result.hash,
      shortHash: result.hash.substring(0, 7),
      message: result.message ?? '',
      author: 'Unknown',
      date: new Date(),
    };
  }

  async pull(workspacePath: string): Promise<{ success: boolean; error?: string }> {
    return this.service.pull(workspacePath);
  }

  async push(workspacePath: string): Promise<{ success: boolean; error?: string }> {
    return this.service.push(workspacePath);
  }

  async sync(workspacePath: string, message?: string): Promise<GitSyncResult> {
    const result = await this.service.sync(workspacePath, message);
    return {
      success: result.success,
      pulled: result.pulled ?? 0,
      pushed: result.pushed ?? 0,
      conflicts: [],
      error: result.error,
    };
  }

  async setRemote(workspacePath: string, url: string): Promise<boolean> {
    return this.service.setRemote(workspacePath, url);
  }

  async getRemote(workspacePath: string): Promise<string | null> {
    // Not implemented in GitService - stub
    return null;
  }

  async getRecentCommits(workspacePath: string, limit = 10): Promise<GitCommit[]> {
    // Not implemented in GitService - stub
    return [];
  }

  async discardChanges(workspacePath: string, filePath: string): Promise<boolean> {
    // Not implemented in GitService - stub
    return false;
  }

  async getDiff(workspacePath: string, filePath?: string): Promise<string> {
    // Not implemented in GitService - stub
    return '';
  }
}
