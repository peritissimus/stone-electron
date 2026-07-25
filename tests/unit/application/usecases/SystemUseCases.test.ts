/**
 * SystemUseCases Application Layer Tests
 *
 * Tests use case orchestration with mocked OUT ports.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { SystemUseCasesLive } from '../../../../src/main/application/usecases/system';
import {
  SystemBridgePort,
  SystemUseCasesPort,
} from '../../../../src/main/domain';
import { adapterLayer } from '../../../helpers/adapterLayer';
import type { ISystemBridge } from '../../../../src/main/domain/ports/out/ISystemBridge';
import type { ISystemUseCases } from '../../../../src/main/domain/ports/in/ISystemUseCases';

type PromiseSystem<T> = T extends (
  ...args: infer Args
) => Effect.Effect<infer Success, unknown, unknown>
  ? (...args: Args) => Promise<Success>
  : T extends object
    ? { [Key in keyof T]: PromiseSystem<T[Key]> }
    : T;

function promiseService(
  runtime: ManagedRuntime.ManagedRuntime<ISystemUseCases, never>,
): PromiseSystem<ISystemUseCases> {
  const run = <A, E>(
    use: (service: ISystemUseCases) => Effect.Effect<A, E>,
  ) =>
    runtime.runPromise(
      SystemUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );
  return {
    getFonts: { execute: () => run((service) => service.getFonts.execute()) },
    selectFolder: {
      execute: (request) =>
        run((service) => service.selectFolder.execute(request)),
    },
    validatePath: {
      execute: (request) =>
        run((service) => service.validatePath.execute(request)),
    },
    openInFolder: {
      execute: (request) =>
        run((service) => service.openInFolder.execute(request)),
    },
    openExternal: {
      execute: (request) =>
        run((service) => service.openExternal.execute(request)),
    },
    getMicAccessStatus: {
      execute: () =>
        run((service) => service.getMicAccessStatus.execute()),
    },
    requestMicAccess: {
      execute: () => run((service) => service.requestMicAccess.execute()),
    },
    getSystemAudioAccess: {
      execute: () =>
        run((service) => service.getSystemAudioAccess.execute()),
    },
    requestSystemAudioAccess: {
      execute: () =>
        run((service) => service.requestSystemAudioAccess.execute()),
    },
  };
}

// Mock factories
function createMockSystemBridge(): ISystemBridge {
  return {
    getFonts: vi.fn(),
    selectFolder: vi.fn(),
    validatePath: vi.fn(),
    showInFolder: vi.fn(),
    openExternal: vi.fn(),
    getMicrophoneAccessStatus: vi.fn(),
    askForMicrophoneAccess: vi.fn(),
  } as unknown as ISystemBridge;
}

describe('SystemUseCases', () => {
  let systemBridge: ISystemBridge;
  let useCases: PromiseSystem<ISystemUseCases>;

  beforeEach(() => {
    systemBridge = createMockSystemBridge();
    useCases = promiseService(
      ManagedRuntime.make(
        SystemUseCasesLive.pipe(
          Layer.provide(adapterLayer(SystemBridgePort, systemBridge)),
        ),
      ),
    );
  });

  describe('getFonts', () => {
    it('returns list of system fonts', async () => {
      const fonts = ['Arial', 'Helvetica', 'Times New Roman'];
      vi.mocked(systemBridge.getFonts).mockResolvedValue(fonts);

      const result = await useCases.getFonts.execute();

      expect(result.fonts).toEqual(fonts);
      expect(systemBridge.getFonts).toHaveBeenCalled();
    });

    it('returns empty array when no fonts', async () => {
      vi.mocked(systemBridge.getFonts).mockResolvedValue([]);

      const result = await useCases.getFonts.execute();

      expect(result.fonts).toEqual([]);
    });
  });

  describe('selectFolder', () => {
    it('returns selected folder path', async () => {
      vi.mocked(systemBridge.selectFolder).mockResolvedValue('/path/to/folder');

      const result = await useCases.selectFolder.execute();

      expect(result.folderPath).toBe('/path/to/folder');
      expect(systemBridge.selectFolder).toHaveBeenCalledWith(undefined);
    });

    it('passes options to system service', async () => {
      vi.mocked(systemBridge.selectFolder).mockResolvedValue('/selected');

      const options = { title: 'Select Folder', defaultPath: '/home' };
      await useCases.selectFolder.execute(options);

      expect(systemBridge.selectFolder).toHaveBeenCalledWith(options);
    });

    it('returns null when cancelled', async () => {
      vi.mocked(systemBridge.selectFolder).mockResolvedValue(null);

      const result = await useCases.selectFolder.execute();

      expect(result.folderPath).toBeNull();
    });
  });

  describe('validatePath', () => {
    it('returns true for valid path', async () => {
      vi.mocked(systemBridge.validatePath).mockResolvedValue(true);

      const result = await useCases.validatePath.execute({ path: '/valid/path' });

      expect(result.isValid).toBe(true);
      expect(systemBridge.validatePath).toHaveBeenCalledWith('/valid/path');
    });

    it('returns false for invalid path', async () => {
      vi.mocked(systemBridge.validatePath).mockResolvedValue(false);

      const result = await useCases.validatePath.execute({ path: '/invalid/path' });

      expect(result.isValid).toBe(false);
    });
  });

  describe('openInFolder', () => {
    it('calls showInFolder on system service', async () => {
      await useCases.openInFolder.execute({ path: '/path/to/file' });

      expect(systemBridge.showInFolder).toHaveBeenCalledWith('/path/to/file');
    });
  });

  describe('openExternal', () => {
    it('opens external URL', async () => {
      vi.mocked(systemBridge.openExternal).mockResolvedValue(undefined);

      await useCases.openExternal.execute({ url: 'https://example.com' });

      expect(systemBridge.openExternal).toHaveBeenCalledWith('https://example.com');
    });
  });

  describe('mic access', () => {
    it('reports the current status without prompting', async () => {
      vi.mocked(systemBridge.getMicrophoneAccessStatus).mockReturnValue('not-determined');

      const result = await useCases.getMicAccessStatus.execute();

      expect(result).toEqual({ status: 'not-determined' });
      expect(systemBridge.askForMicrophoneAccess).not.toHaveBeenCalled();
    });

    it('requests access and returns the fresh status', async () => {
      vi.mocked(systemBridge.askForMicrophoneAccess).mockResolvedValue(true);
      vi.mocked(systemBridge.getMicrophoneAccessStatus).mockReturnValue('granted');

      const result = await useCases.requestMicAccess.execute();

      expect(result).toEqual({ granted: true, status: 'granted' });
    });
  });
});
