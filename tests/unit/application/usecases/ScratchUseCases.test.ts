import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Cause, Effect, Exit, Layer, ManagedRuntime } from 'effect';
import { ScratchUseCasesLive } from '../../../../src/main/application/usecases/scratch';
import {
  FileStoragePort,
  PathServicePort,
  ScratchUseCasesPort,
  SystemBridgePort,
  type IScratchUseCases,
} from '../../../../src/main/domain';
import type { IFileStorage } from '../../../../src/main/domain/ports/out/IFileStorage';
import type { ISystemBridge } from '../../../../src/main/domain/ports/out/ISystemBridge';
import { adapterLayer } from '../../../helpers/adapterLayer';
import { createMockPathService } from './testDoubles';

type PromiseFacade<T> = T extends (
  ...args: infer Args
) => Effect.Effect<infer Success, unknown, unknown>
  ? (...args: Args) => Promise<Success>
  : T extends object
    ? { [Key in keyof T]: PromiseFacade<T[Key]> }
    : T;

describe('ScratchUseCases', () => {
  let fileStorage: IFileStorage;
  let systemBridge: ISystemBridge;
  let useCases: PromiseFacade<IScratchUseCases>;

  beforeEach(() => {
    fileStorage = {
      read: vi.fn(),
      write: vi.fn(),
      exists: vi.fn(),
      getFileInfo: vi.fn(),
    } as unknown as IFileStorage;
    systemBridge = { selectFile: vi.fn() } as unknown as ISystemBridge;
    const runtime = ManagedRuntime.make(
      ScratchUseCasesLive.pipe(
        Layer.provide(
          Layer.mergeAll(
            adapterLayer(FileStoragePort, fileStorage),
            adapterLayer(SystemBridgePort, systemBridge),
            adapterLayer(PathServicePort, createMockPathService()),
          ),
        ),
      ),
    );
    const run = <A, E>(
      use: (service: IScratchUseCases) => Effect.Effect<A, E>,
    ) =>
      runtime
        .runPromiseExit(
          ScratchUseCasesPort.pipe(
            Effect.flatMap((service) => use(service)),
          ),
        )
        .then((exit) => {
          if (Exit.isSuccess(exit)) return exit.value;
          throw Cause.squash(exit.cause);
        });
    useCases = {
      pickScratchFile: {
        execute: () => run((service) => service.pickScratchFile.execute()),
      },
      readScratchFile: {
        execute: (request) =>
          run((service) => service.readScratchFile.execute(request)),
      },
      writeScratchFile: {
        execute: (request) =>
          run((service) => service.writeScratchFile.execute(request)),
      },
    };
  });

  it('picks the first selected markdown file or returns null', async () => {
    vi.mocked(systemBridge.selectFile)
      .mockResolvedValueOnce(['/tmp/a.md', '/tmp/b.md'])
      .mockResolvedValueOnce(null);
    await expect(useCases.pickScratchFile.execute()).resolves.toEqual({
      path: '/tmp/a.md',
    });
    await expect(useCases.pickScratchFile.execute()).resolves.toEqual({
      path: null,
    });
    expect(systemBridge.selectFile).toHaveBeenCalledWith({
      title: 'Open Markdown File',
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    });
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
    await expect(
      useCases.readScratchFile.execute({ path: 'notes/readme.md' }),
    ).resolves.toEqual({
      path: '/notes/readme.md',
      name: 'readme.md',
      content: '# Readme',
    });
  });

  it('rejects unsupported, missing, and oversized scratch reads', async () => {
    await expect(
      useCases.readScratchFile.execute({ path: '/tmp/app.exe' }),
    ).rejects.toThrow('Unsupported file type for scratch editor: .exe');
    vi.mocked(fileStorage.getFileInfo)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        path: '/notes/huge.md',
        name: 'huge.md',
        size: 11 * 1024 * 1024,
        isDirectory: false,
        createdAt: new Date('2026-01-01T00:00:00'),
        modifiedAt: new Date('2026-01-02T00:00:00'),
      });
    await expect(
      useCases.readScratchFile.execute({ path: '/notes/missing.md' }),
    ).rejects.toThrow('File not found');
    await expect(
      useCases.readScratchFile.execute({ path: '/notes/huge.md' }),
    ).rejects.toThrow(/File too large for scratch editor/);
  });

  it('writes only to existing markdown files', async () => {
    vi.mocked(fileStorage.exists)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    await expect(
      useCases.writeScratchFile.execute({
        path: '/notes/readme.markdown',
        content: '# Updated',
      }),
    ).resolves.toEqual({ path: '/notes/readme.markdown' });
    expect(fileStorage.write).toHaveBeenCalledWith(
      '/notes/readme.markdown',
      '# Updated',
    );
    await expect(
      useCases.writeScratchFile.execute({
        path: '/notes/new.md',
        content: 'new',
      }),
    ).rejects.toThrow(
      'Refusing to create new file from scratch editor: /notes/new.md',
    );
  });
});
