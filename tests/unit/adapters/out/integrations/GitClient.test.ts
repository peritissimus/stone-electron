import { beforeEach, describe, expect, it, vi } from 'vitest';

const simpleGitMock = vi.hoisted(() => ({
  factory: vi.fn(),
}));

vi.mock('simple-git', () => ({
  simpleGit: simpleGitMock.factory,
}));

function createGit(overrides: Record<string, unknown> = {}) {
  const git = {
    env: vi.fn(function env(this: any) {
      return this;
    }),
    checkIsRepo: vi.fn().mockResolvedValue(true),
    init: vi.fn().mockResolvedValue(undefined),
    status: vi.fn().mockResolvedValue({
      current: 'main',
      ahead: 1,
      behind: 2,
      modified: ['changed.md'],
      created: ['new.md'],
      deleted: ['old.md'],
      renamed: [{ from: 'a.md', to: 'b.md' }],
      not_added: ['untracked.md'],
      staged: ['staged.md'],
      conflicted: [],
      isClean: () => false,
    }),
    getRemotes: vi.fn().mockResolvedValue([{ name: 'origin', refs: { fetch: 'git@example.com/repo.git' } }]),
    add: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue({ commit: 'abcdef123456' }),
    pull: vi.fn().mockResolvedValue({ summary: { changes: 1, insertions: 2, deletions: 3 } }),
    push: vi.fn().mockResolvedValue(undefined),
    remote: vi.fn().mockResolvedValue(undefined),
    addRemote: vi.fn().mockResolvedValue(undefined),
    log: vi.fn().mockResolvedValue({
      all: [
        {
          hash: 'abcdef123456',
          message: 'Initial',
          author_name: 'Ada',
          author_email: 'ada@example.com',
          date: '2026-01-01T00:00:00.000Z',
        },
      ],
    }),
    fetch: vi.fn().mockResolvedValue(undefined),
    rebase: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  simpleGitMock.factory.mockReturnValue(git);
  return git;
}

async function loadGitClient() {
  vi.resetModules();
  const { GitClient } = await import('../../../../../src/main/adapters/out/integrations/GitClient');
  return new GitClient();
}

describe('GitClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps repository status and command wrapper results', async () => {
    const git = createGit();
    const client = await loadGitClient();

    await expect(client.isRepository('/repo')).resolves.toBe(true);
    await expect(client.init('/repo')).resolves.toMatchObject({ success: true });
    await expect(client.stage('/repo', ['a.md'])).resolves.toMatchObject({ success: true });
    await expect(client.stage('/repo')).resolves.toMatchObject({ success: true });
    await expect(client.commit('/repo', 'msg')).resolves.toMatchObject({
      success: true,
      message: expect.stringContaining('abcdef123456'),
    });
    await expect(client.pull('/repo')).resolves.toMatchObject({
      success: true,
      message: 'Pulled 1 changes, 2 insertions, 3 deletions',
    });
    await expect(client.push('/repo')).resolves.toMatchObject({ success: true });

    const status = await client.getStatus('/repo');
    expect(status).toMatchObject({
      isRepo: true,
      branch: 'main',
      ahead: 1,
      behind: 2,
      hasRemote: true,
      remoteUrl: 'git@example.com/repo.git',
      hasUncommittedChanges: true,
    });
    expect(status.changes).toEqual(
      expect.arrayContaining([
        { path: 'changed.md', status: 'modified', staged: false },
        { path: 'staged.md', status: 'modified', staged: true },
      ]),
    );

    await expect(client.setRemote('/repo', 'git@example.com/new.git')).resolves.toMatchObject({
      success: true,
    });
    expect(git.remote).toHaveBeenCalledWith(['set-url', 'origin', 'git@example.com/new.git']);

    const commits = await client.getCommits('/repo', 5);
    expect(commits[0]).toMatchObject({
      hash: 'abcdef123456',
      shortHash: 'abcdef1',
      author: 'Ada',
    });
  });

  it('returns safe fallbacks for non-repositories and wrapper failures', async () => {
    createGit({
      checkIsRepo: vi.fn().mockResolvedValue(false),
      init: vi.fn().mockRejectedValue(new Error('no permission')),
      log: vi.fn().mockRejectedValue(new Error('bad log')),
    });
    const client = await loadGitClient();

    await expect(client.getStatus('/repo')).resolves.toMatchObject({
      isRepo: false,
      changes: [],
    });
    await expect(client.init('/repo')).resolves.toMatchObject({
      success: false,
      error: 'no permission',
    });
    await expect(client.getCommits('/repo')).resolves.toEqual([]);
  });

  it('syncs local changes without a remote', async () => {
    const git = createGit({
      getRemotes: vi.fn().mockResolvedValue([]),
      status: vi.fn().mockResolvedValue({
        modified: ['a.md'],
        created: [],
        deleted: [],
        renamed: [],
        not_added: [],
        ahead: 0,
        behind: 0,
        isClean: () => false,
      }),
    });
    const client = await loadGitClient();

    await expect(client.sync('/repo')).resolves.toMatchObject({
      success: true,
      committed: true,
      commitMessage: expect.stringMatching(/^stone: 1 change/),
      pulledCount: 0,
      pushedCount: 0,
    });
    expect(git.env).toHaveBeenCalledWith(expect.objectContaining({ GIT_TERMINAL_PROMPT: '0' }));
    expect(git.add).toHaveBeenCalledWith('.');
    expect(git.commit).toHaveBeenCalledWith(expect.stringMatching(/^stone: 1 change/));
  });

  it('classifies sync auth and conflict failures', async () => {
    createGit({
      status: vi.fn().mockRejectedValue(new Error('Authentication failed')),
    });
    const client = await loadGitClient();
    await expect(client.sync('/repo')).resolves.toMatchObject({
      success: false,
      errorKind: 'auth',
    });

    const conflictStatus = vi
      .fn()
      .mockResolvedValueOnce({
        modified: [],
        created: [],
        deleted: [],
        renamed: [],
        not_added: [],
        ahead: 0,
        behind: 0,
        isClean: () => true,
      })
      .mockResolvedValueOnce({ behind: 1, ahead: 0, conflicted: [] })
      .mockResolvedValueOnce({ conflicted: ['note.md'] });
    const conflictGit = createGit({
      status: conflictStatus,
      pull: vi.fn().mockRejectedValue(new Error('needs merge')),
    });
    const conflictClient = await loadGitClient();

    await expect(conflictClient.sync('/repo')).resolves.toMatchObject({
      success: false,
      errorKind: 'conflict',
      conflicts: ['note.md'],
    });
    expect(conflictGit.rebase).toHaveBeenCalledWith(['--abort']);
  });
});
