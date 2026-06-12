import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileSystemStorage } from '../../../../../src/main/adapters/out/storage/FileSystemStorage';

const chokidarMock = vi.hoisted(() => {
  const callbacks = new Map<string, (filePath: string) => void>();
  const watcher: { on: any; close: any } = {
    on: vi.fn((event: string, callback: (filePath: string) => void): typeof watcher => {
      callbacks.set(event, callback);
      return watcher;
    }),
    close: vi.fn(),
  };
  return {
    callbacks,
    watch: vi.fn(() => watcher),
    watcher,
  };
});

vi.mock('chokidar', () => ({
  watch: chokidarMock.watch,
}));

describe('FileSystemStorage', () => {
  let root: string;
  let storage: FileSystemStorage;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'stone-storage-'));
    storage = new FileSystemStorage();
    chokidarMock.callbacks.clear();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('reads, writes, appends bytes, renames, copies, lists, and deletes files', async () => {
    const original = path.join(root, 'nested', 'note.md');
    const renamed = path.join(root, 'renamed', 'note.md');
    const copied = path.join(root, 'copy.md');

    await storage.write(original, 'hello');
    await storage.writeBytes(original, new TextEncoder().encode(' world'), { append: true });

    expect(await storage.exists(original)).toBe(true);
    expect(await storage.read(original)).toBe('hello world');
    const bytes = await storage.readBytes(original);
    expect(bytes).not.toBeNull();
    expect(new TextDecoder().decode(bytes!)).toBe('hello world');
    expect(await storage.readBytes(path.join(root, 'missing.md'))).toBeNull();

    await storage.rename(original, renamed);
    await storage.copy(renamed, copied);

    const info = await storage.getFileInfo(copied);
    expect(info).toMatchObject({ path: copied, name: 'copy.md', isDirectory: false });
    expect(await storage.getFileInfo(path.join(root, 'missing.md'))).toBeNull();

    const rootEntries = await storage.listFiles(root);
    expect(rootEntries.map((entry) => entry.name).sort()).toEqual(['copy.md', 'nested', 'renamed']);
    expect(await storage.glob('**/*.md', root)).toEqual(['copy.md', 'renamed/note.md']);

    await storage.delete(copied);
    expect(await storage.exists(copied)).toBe(false);
    await storage.deleteDirectory(path.join(root, 'renamed'));
    expect(await storage.exists(renamed)).toBe(false);
  });

  it('wires chokidar events and returns a close function', () => {
    const seen: Array<[string, string]> = [];

    const stop = storage.watch(root, (event, filePath) => seen.push([event, filePath]));

    chokidarMock.callbacks.get('add')?.('/tmp/a.md');
    chokidarMock.callbacks.get('change')?.('/tmp/a.md');
    chokidarMock.callbacks.get('unlink')?.('/tmp/a.md');
    stop();

    expect(chokidarMock.watch).toHaveBeenCalledWith(root, expect.objectContaining({ ignoreInitial: true }));
    expect(seen).toEqual([
      ['add', '/tmp/a.md'],
      ['change', '/tmp/a.md'],
      ['unlink', '/tmp/a.md'],
    ]);
    expect(chokidarMock.watcher.close).toHaveBeenCalledWith();
  });
});
