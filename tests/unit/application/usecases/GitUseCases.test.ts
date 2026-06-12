/**
 * GitUseCases Application Layer Tests
 *
 * Tests use case orchestration with mocked OUT ports.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGitUseCases } from '../../../../src/main/application/usecases/git';
import type { IWorkspaceRepository } from '../../../../src/main/domain/ports/out/IWorkspaceRepository';
import type { IGitClient, GitSyncResult } from '../../../../src/main/domain/ports/out/IGitClient';
import type { IFileStorage } from '../../../../src/main/domain/ports/out/IFileStorage';
import type { ISettingsRepository } from '../../../../src/main/domain/ports/out/ISettingsRepository';
import type { IGitUseCases } from '../../../../src/main/domain/ports/in/IGitUseCases';
import type { WorkspaceProps } from '../../../../src/main/domain/entities/Workspace';
import { createMockPathService } from './testDoubles';

// Mock factories
function createMockWorkspaceRepository(): IWorkspaceRepository {
  return {
    findById: vi.fn(),
    findAll: vi.fn(),
    findActive: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  } as unknown as IWorkspaceRepository;
}

function createMockGitClient(): IGitClient {
  return {
    getStatus: vi.fn(),
    init: vi.fn(),
    stage: vi.fn(),
    commit: vi.fn(),
    pull: vi.fn(),
    push: vi.fn(),
    sync: vi.fn(),
    setRemote: vi.fn(),
    getCommits: vi.fn(),
  } as unknown as IGitClient;
}

function createMockFileStorage(): IFileStorage {
  return {
    exists: vi.fn().mockResolvedValue(true),
    write: vi.fn().mockResolvedValue(undefined),
  } as unknown as IFileStorage;
}

function createMockSettingsRepository(): ISettingsRepository {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue({ key: 'k', value: 'v' }),
  } as unknown as ISettingsRepository;
}

function syncResult(overrides: Partial<GitSyncResult> = {}): GitSyncResult {
  return {
    success: true,
    committed: false,
    pulledCount: 0,
    pushedCount: 0,
    conflicts: [],
    ...overrides,
  };
}

function createWorkspaceProps(overrides: Partial<WorkspaceProps> = {}): WorkspaceProps {
  return {
    id: 'ws-1',
    name: 'Test Workspace',
    folderPath: '/test/workspace',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    lastAccessedAt: new Date('2024-01-02'),
    ...overrides,
  };
}

describe('GitUseCases', () => {
  let workspaceRepo: IWorkspaceRepository;
  let gitClient: IGitClient;
  let fileStorage: IFileStorage;
  let settingsRepository: ISettingsRepository;
  let useCases: IGitUseCases;

  beforeEach(() => {
    workspaceRepo = createMockWorkspaceRepository();
    gitClient = createMockGitClient();
    fileStorage = createMockFileStorage();
    settingsRepository = createMockSettingsRepository();
    useCases = createGitUseCases({
      workspaceRepository: workspaceRepo,
      gitClient,
      fileStorage,
      pathService: createMockPathService(),
      settingsRepository,
    });
  });

  describe('getStatus', () => {
    it('returns git status for workspace', async () => {
      const workspace = createWorkspaceProps();
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(gitClient.getStatus).mockResolvedValue({
        isRepo: true,
        hasUncommittedChanges: true,
        branch: 'main',
        hasRemote: true,
        remoteUrl: 'https://github.com/test/repo',
        ahead: 1,
        behind: 0,
        changes: [
          { path: 'file1.md', status: 'modified', staged: true },
          { path: 'file2.md', status: 'untracked', staged: false },
        ],
      });

      const result = await useCases.getStatus.execute({ workspaceId: 'ws-1' });

      expect(result.isRepo).toBe(true);
      expect(result.hasChanges).toBe(true);
      expect(result.branch).toBe('main');
      expect(result.staged).toContain('file1.md');
      expect(result.untracked).toContain('file2.md');
    });

    it('throws error when workspace not found', async () => {
      vi.mocked(workspaceRepo.findById).mockResolvedValue(null);

      await expect(useCases.getStatus.execute({ workspaceId: 'nonexistent' })).rejects.toThrow(
        'Workspace not found: nonexistent',
      );
    });
  });

  describe('init', () => {
    it('initializes git repository', async () => {
      const workspace = createWorkspaceProps();
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(gitClient.init).mockResolvedValue({ success: true });

      const result = await useCases.init.execute({ workspaceId: 'ws-1' });

      expect(result.success).toBe(true);
      expect(gitClient.init).toHaveBeenCalledWith('/test/workspace');
    });

    it('throws error when workspace not found', async () => {
      vi.mocked(workspaceRepo.findById).mockResolvedValue(null);

      await expect(useCases.init.execute({ workspaceId: 'nonexistent' })).rejects.toThrow(
        'Workspace not found: nonexistent',
      );
    });
  });

  describe('commit', () => {
    it('stages and commits changes', async () => {
      const workspace = createWorkspaceProps();
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(gitClient.stage).mockResolvedValue({ success: true });
      vi.mocked(gitClient.commit).mockResolvedValue({ success: true });
      vi.mocked(gitClient.getCommits).mockResolvedValue([
        {
          hash: 'abc123',
          shortHash: 'abc',
          message: 'Test commit',
          author: 'Test User',
          email: 'test@example.com',
          date: new Date('2024-01-01'),
        },
      ]);

      const result = await useCases.commit.execute({ workspaceId: 'ws-1', message: 'Test commit' });

      expect(result).not.toBeNull();
      expect(result?.message).toBe('Test commit');
      expect(gitClient.stage).toHaveBeenCalledWith('/test/workspace');
      expect(gitClient.commit).toHaveBeenCalledWith('/test/workspace', 'Test commit');
    });

    it('returns null when commit fails', async () => {
      const workspace = createWorkspaceProps();
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(gitClient.stage).mockResolvedValue({ success: true });
      vi.mocked(gitClient.commit).mockResolvedValue({ success: false });

      const result = await useCases.commit.execute({ workspaceId: 'ws-1' });

      expect(result).toBeNull();
    });

    it('uses default message when not provided', async () => {
      const workspace = createWorkspaceProps();
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(gitClient.stage).mockResolvedValue({ success: true });
      vi.mocked(gitClient.commit).mockResolvedValue({ success: true });
      vi.mocked(gitClient.getCommits).mockResolvedValue([
        { hash: 'abc123', shortHash: 'abc', message: 'Commit:', author: 'User', email: 'user@example.com', date: new Date() },
      ]);

      await useCases.commit.execute({ workspaceId: 'ws-1' });

      expect(gitClient.commit).toHaveBeenCalledWith(
        '/test/workspace',
        expect.stringContaining('Commit:'),
      );
    });
  });

  describe('pull', () => {
    it('pulls changes from remote', async () => {
      const workspace = createWorkspaceProps();
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(gitClient.pull).mockResolvedValue({ success: true });

      const result = await useCases.pull.execute({ workspaceId: 'ws-1' });

      expect(result.success).toBe(true);
      expect(gitClient.pull).toHaveBeenCalledWith('/test/workspace');
    });

    it('returns error on failure', async () => {
      const workspace = createWorkspaceProps();
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(gitClient.pull).mockResolvedValue({ success: false, error: 'Connection failed' });

      const result = await useCases.pull.execute({ workspaceId: 'ws-1' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
    });
  });

  describe('push', () => {
    it('pushes changes to remote', async () => {
      const workspace = createWorkspaceProps();
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(gitClient.push).mockResolvedValue({ success: true });

      const result = await useCases.push.execute({ workspaceId: 'ws-1' });

      expect(result.success).toBe(true);
      expect(gitClient.push).toHaveBeenCalledWith('/test/workspace');
    });
  });

  describe('sync', () => {
    it('syncs and reports real pulled/pushed counts', async () => {
      const workspace = createWorkspaceProps();
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(gitClient.sync).mockResolvedValue(
        syncResult({ committed: true, pulledCount: 2, pushedCount: 1 }),
      );

      const result = await useCases.sync.execute({ workspaceId: 'ws-1', message: 'Sync' });

      expect(result).toMatchObject({ success: true, committed: true, pulled: 2, pushed: 1 });
      expect(gitClient.sync).toHaveBeenCalledWith('/test/workspace', 'Sync');
    });

    it('passes undefined message through (client owns the default)', async () => {
      const workspace = createWorkspaceProps();
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(gitClient.sync).mockResolvedValue(syncResult());

      await useCases.sync.execute({ workspaceId: 'ws-1' });

      expect(gitClient.sync).toHaveBeenCalledWith('/test/workspace', undefined);
    });

    it('seeds .gitignore before staging when the workspace has none', async () => {
      const workspace = createWorkspaceProps();
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(fileStorage.exists).mockResolvedValue(false);
      vi.mocked(gitClient.sync).mockResolvedValue(syncResult());

      await useCases.sync.execute({ workspaceId: 'ws-1' });

      expect(fileStorage.write).toHaveBeenCalledWith(
        '/test/workspace/.gitignore',
        expect.stringContaining('.stone/'),
      );
    });

    it('never overwrites an existing .gitignore', async () => {
      const workspace = createWorkspaceProps();
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(fileStorage.exists).mockResolvedValue(true);
      vi.mocked(gitClient.sync).mockResolvedValue(syncResult());

      await useCases.sync.execute({ workspaceId: 'ws-1' });

      expect(fileStorage.write).not.toHaveBeenCalled();
    });

    it('persists lastSyncAt on success only', async () => {
      const workspace = createWorkspaceProps();
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(gitClient.sync).mockResolvedValue(syncResult());

      await useCases.sync.execute({ workspaceId: 'ws-1' });
      expect(settingsRepository.set).toHaveBeenCalledWith(
        'git.lastSyncAt.ws-1',
        expect.any(String),
      );

      vi.mocked(settingsRepository.set).mockClear();
      vi.mocked(gitClient.sync).mockResolvedValue(
        syncResult({ success: false, errorKind: 'network', error: 'no host' }),
      );
      await useCases.sync.execute({ workspaceId: 'ws-1' });
      expect(settingsRepository.set).not.toHaveBeenCalled();
    });

    it('propagates conflicts and errorKind', async () => {
      const workspace = createWorkspaceProps();
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(gitClient.sync).mockResolvedValue(
        syncResult({
          success: false,
          committed: true,
          conflicts: ['Journal/2026-06-13.md'],
          errorKind: 'conflict',
          error: 'could not apply abc123',
        }),
      );

      const result = await useCases.sync.execute({ workspaceId: 'ws-1' });

      expect(result.success).toBe(false);
      expect(result.errorKind).toBe('conflict');
      expect(result.conflicts).toEqual(['Journal/2026-06-13.md']);
    });

    it('joins concurrent syncs instead of stacking them (single-flight)', async () => {
      const workspace = createWorkspaceProps();
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      let release!: (value: GitSyncResult) => void;
      vi.mocked(gitClient.sync).mockReturnValue(
        new Promise<GitSyncResult>((resolve) => {
          release = resolve;
        }),
      );

      const first = useCases.sync.execute({ workspaceId: 'ws-1' });
      const second = useCases.sync.execute({ workspaceId: 'ws-1' });
      release(syncResult({ pushedCount: 1 }));

      const [a, b] = await Promise.all([first, second]);
      expect(gitClient.sync).toHaveBeenCalledTimes(1);
      expect(a).toEqual(b);
    });
  });

  describe('setRemote', () => {
    it('sets remote URL', async () => {
      const workspace = createWorkspaceProps();
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(gitClient.setRemote).mockResolvedValue({ success: true });

      const result = await useCases.setRemote.execute({
        workspaceId: 'ws-1',
        url: 'https://github.com/test/repo',
      });

      expect(result.success).toBe(true);
      expect(gitClient.setRemote).toHaveBeenCalledWith(
        '/test/workspace',
        'https://github.com/test/repo',
        'origin',
      );
    });
  });

  describe('getCommits', () => {
    it('returns commit history', async () => {
      const workspace = createWorkspaceProps();
      const commits = [
        { hash: 'abc123', shortHash: 'abc', message: 'First commit', author: 'User', email: 'user@example.com', date: new Date() },
        { hash: 'def456', shortHash: 'def', message: 'Second commit', author: 'User', email: 'user@example.com', date: new Date() },
      ];
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(gitClient.getCommits).mockResolvedValue(commits);

      const result = await useCases.getCommits.execute({ workspaceId: 'ws-1', limit: 10 });

      expect(result.commits).toHaveLength(2);
      expect(result.commits[0].message).toBe('First commit');
    });

    it('uses default limit when not provided', async () => {
      const workspace = createWorkspaceProps();
      vi.mocked(workspaceRepo.findById).mockResolvedValue(workspace);
      vi.mocked(gitClient.getCommits).mockResolvedValue([]);

      await useCases.getCommits.execute({ workspaceId: 'ws-1' });

      expect(gitClient.getCommits).toHaveBeenCalledWith('/test/workspace', 50);
    });
  });
});
