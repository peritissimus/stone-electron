/**
 * SystemUseCases Application Layer Tests
 *
 * Tests use case orchestration with mocked OUT ports.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSystemUseCases } from '../../../../src/main/application/usecases/system';
import type { ISystemBridge } from '../../../../src/main/domain/ports/out/ISystemBridge';
import type { ISystemUseCases } from '../../../../src/main/domain/ports/in/ISystemUseCases';

// Mock factories
function createMockSystemBridge(): ISystemBridge {
  return {
    getFonts: vi.fn(),
    selectFolder: vi.fn(),
    validatePath: vi.fn(),
    showInFolder: vi.fn(),
    openExternal: vi.fn(),
  } as unknown as ISystemBridge;
}

describe('SystemUseCases', () => {
  let systemBridge: ISystemBridge;
  let useCases: ISystemUseCases;

  beforeEach(() => {
    systemBridge = createMockSystemBridge();
    useCases = createSystemUseCases({ systemBridge });
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
});
