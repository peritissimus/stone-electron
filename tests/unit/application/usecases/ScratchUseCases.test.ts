import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createScratchUseCases } from '../../../../src/main/application/usecases/scratch';
import type { IScratchUseCases } from '../../../../src/main/domain/ports/in/IScratchUseCases';
import type { IFileStorage } from '../../../../src/main/domain/ports/out/IFileStorage';
import type { ISystemBridge } from '../../../../src/main/domain/ports/out/ISystemBridge';
import { createMockPathService } from './testDoubles';

function createMockFileStorage(): IFileStorage {
  return {
    read: vi.fn(),
    write: vi.fn(),
    exists: vi.fn(),
    getFileInfo: vi.fn(),
  } as unknown as IFileStorage;
}

function createMockSystemBridge(): ISystemBridge {
  return {
    selectFile: vi.fn(),
  } as unknown as ISystemBridge;
}

describe('ScratchUseCases', () => {
  let fileStorage: IFileStorage;
  let systemBridge: ISystemBridge;
  let useCases: IScratchUseCases;

  beforeEach(() => {
    fileStorage = createMockFileStorage();
    systemBridge = createMockSystemBridge();
    useCases = createScratchUseCases({
      fileStorage,
      systemBridge,
      pathService: createMockPathService(),
    });
  });

  it('picks the first selected markdown file', async () => {
    vi.mocked(systemBridge.selectFile).mockResolvedValue(['/tmp/a.md', '/tmp/b.md']);

    const result = await useCases.pickScratchFile.execute();

    expect(systemBridge.selectFile).toHaveBeenCalledWith({
      title: 'Open Markdown File',
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    });
    expect(result).toEqual({ path: '/tmp/a.md' });
  });

  it('returns null when the picker is cancelled', async () => {
    vi.mocked(systemBridge.selectFile).mockResolvedValue(null);

    await expect(useCases.pickScratchFile.execute()).resolves.toEqual({ path: null });
  });

  it('reads an existing markdown file and resolves relative paths', async () => {
    vi.mocked(fileStorage.getFileInfo).mockResolvedValue({
      path: '/notes/readme.md',
      name: 'readme.md',
      size: 24,
      isDirectory: false,
      createdAt: new Date('2026-01-01T00:00:00'),
      modifiedAt: new Date('2026-01-02T00:00:00'),
    });
    vi.mocked(fileStorage.read).mockResolvedValue('# Readme');

    const result = await useCases.readScratchFile.execute({ path: 'notes/readme.md' });

    expect(fileStorage.getFileInfo).toHaveBeenCalledWith('/notes/readme.md');
    expect(result).toEqual({
      path: '/notes/readme.md',
      name: 'readme.md',
      content: '# Readme',
    });
  });

  it('rejects unsupported scratch read paths', async () => {
    await expect(useCases.readScratchFile.execute({ path: '/tmp/app.exe' })).rejects.toThrow(
      'Unsupported file type for scratch editor: .exe',
    );
    expect(fileStorage.getFileInfo).not.toHaveBeenCalled();
  });

  it('refuses to read directories or very large files', async () => {
    vi.mocked(fileStorage.getFileInfo).mockResolvedValueOnce({
      path: '/notes/folder.md',
      name: 'folder.md',
      size: 0,
      isDirectory: true,
      createdAt: new Date('2026-01-01T00:00:00'),
      modifiedAt: new Date('2026-01-02T00:00:00'),
    });
    await expect(useCases.readScratchFile.execute({ path: '/notes/folder.md' })).rejects.toThrow(
      'File not found: /notes/folder.md',
    );

    vi.mocked(fileStorage.getFileInfo).mockResolvedValueOnce({
      path: '/notes/huge.md',
      name: 'huge.md',
      size: 11 * 1024 * 1024,
      isDirectory: false,
      createdAt: new Date('2026-01-01T00:00:00'),
      modifiedAt: new Date('2026-01-02T00:00:00'),
    });
    await expect(useCases.readScratchFile.execute({ path: '/notes/huge.md' })).rejects.toThrow(
      /File too large for scratch editor/,
    );
  });

  it('writes only to existing markdown files', async () => {
    vi.mocked(fileStorage.exists).mockResolvedValue(true);

    const result = await useCases.writeScratchFile.execute({
      path: '/notes/readme.markdown',
      content: '# Updated',
    });

    expect(fileStorage.write).toHaveBeenCalledWith('/notes/readme.markdown', '# Updated');
    expect(result).toEqual({ path: '/notes/readme.markdown' });
  });

  it('refuses to create new files from scratch mode', async () => {
    vi.mocked(fileStorage.exists).mockResolvedValue(false);

    await expect(
      useCases.writeScratchFile.execute({ path: '/notes/new.md', content: 'new' }),
    ).rejects.toThrow('Refusing to create new file from scratch editor: /notes/new.md');
    expect(fileStorage.write).not.toHaveBeenCalled();
  });
});
