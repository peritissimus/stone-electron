import { describe, expect, it, vi } from 'vitest';
import { FileSystemTemplateRepository } from '../../../../../src/main/adapters/out/persistence/FileSystemTemplateRepository';

const workspace = { id: 'ws-1', folderPath: '/workspace' };

function createRepository(overrides: Record<string, unknown> = {}) {
  const fileStorage = {
    exists: vi.fn().mockResolvedValue(true),
    listFiles: vi.fn().mockResolvedValue([]),
    read: vi.fn(),
    write: vi.fn().mockResolvedValue(undefined),
    createDirectory: vi.fn().mockResolvedValue(undefined),
    ...overrides.fileStorage as object,
  };
  const workspaceRepository = {
    findById: vi.fn().mockResolvedValue(workspace),
    ...overrides.workspaceRepository as object,
  };
  const markdownProcessor = {
    parseFrontmatter: vi.fn((raw: string) => ({ content: raw, metadata: {} })),
    ...overrides.markdownProcessor as object,
  };
  const pathService = {
    join: (...parts: string[]) => parts.join('/').replaceAll('//', '/'),
    basename: (filePath: string, ext?: string) => {
      const base = filePath.split('/').at(-1) ?? '';
      return ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base;
    },
    ...overrides.pathService as object,
  };

  return {
    repository: new FileSystemTemplateRepository({
      fileStorage: fileStorage as any,
      workspaceRepository: workspaceRepository as any,
      markdownProcessor: markdownProcessor as any,
      pathService: pathService as any,
    }),
    fileStorage,
    workspaceRepository,
    markdownProcessor,
  };
}

describe('FileSystemTemplateRepository', () => {
  it('lists markdown templates sorted by display name with frontmatter fallbacks', async () => {
    const { repository, fileStorage, markdownProcessor } = createRepository({
      fileStorage: {
        listFiles: vi.fn().mockResolvedValue([
          { name: 'z-template.md', path: '/workspace/.stone/templates/z-template.md', isDirectory: false },
          { name: 'notes.txt', path: '/workspace/.stone/templates/notes.txt', isDirectory: false },
          { name: 'folder', path: '/workspace/.stone/templates/folder', isDirectory: true },
          { name: 'a_template.md', path: '/workspace/.stone/templates/a_template.md', isDirectory: false },
        ]),
        read: vi
          .fn()
          .mockResolvedValueOnce('z body')
          .mockResolvedValueOnce('a body'),
      },
      markdownProcessor: {
        parseFrontmatter: vi
          .fn()
          .mockReturnValueOnce({ content: 'z body', metadata: { name: 'Zoo', description: 'Last' } })
          .mockReturnValueOnce({ content: 'a body', metadata: {} }),
      },
    });

    const templates = await repository.list('ws-1');

    expect(templates).toEqual([
      { id: 'a_template', name: 'A Template', description: null, body: 'a body' },
      { id: 'z-template', name: 'Zoo', description: 'Last', body: 'z body' },
    ]);
    expect(fileStorage.read).toHaveBeenCalledTimes(2);
    expect(markdownProcessor.parseFrontmatter).toHaveBeenCalledTimes(2);
  });

  it('returns null or an empty list when the workspace or template directory is absent', async () => {
    const missingWorkspace = createRepository({
      workspaceRepository: { findById: vi.fn().mockResolvedValue(null) },
    });
    const missingDir = createRepository({
      fileStorage: { exists: vi.fn().mockResolvedValue(false) },
    });

    await expect(missingWorkspace.repository.list('missing')).resolves.toEqual([]);
    await expect(missingWorkspace.repository.findById('missing', 'template')).resolves.toBeNull();
    await expect(missingDir.repository.list('ws-1')).resolves.toEqual([]);
    await expect(missingDir.repository.findById('ws-1', 'template')).resolves.toBeNull();
  });

  it('seeds default templates only when the template directory has no markdown files', async () => {
    const fresh = createRepository({
      fileStorage: {
        exists: vi.fn().mockResolvedValue(false),
        listFiles: vi.fn().mockResolvedValue([]),
      },
    });
    const existing = createRepository({
      fileStorage: {
        exists: vi.fn().mockResolvedValue(true),
        listFiles: vi.fn().mockResolvedValue([{ name: 'custom.md', isDirectory: false }]),
      },
    });

    await expect(
      fresh.repository.seedDefaultsIfEmpty('ws-1', [
        { id: 'one', body: 'One' },
        { id: 'two', body: 'Two' },
      ]),
    ).resolves.toBe(2);
    await expect(existing.repository.seedDefaultsIfEmpty('ws-1', [{ id: 'one', body: 'One' }])).resolves.toBe(0);

    expect(fresh.fileStorage.createDirectory).toHaveBeenCalledWith('/workspace/.stone/templates');
    expect(fresh.fileStorage.write).toHaveBeenCalledWith('/workspace/.stone/templates/one.md', 'One');
    expect(fresh.fileStorage.write).toHaveBeenCalledWith('/workspace/.stone/templates/two.md', 'Two');
    expect(existing.fileStorage.write).not.toHaveBeenCalled();
  });
});
