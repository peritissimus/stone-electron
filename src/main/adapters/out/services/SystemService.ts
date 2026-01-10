/**
 * System Service Adapter - OS-level operations (fonts, dialogs, shell)
 */

import type { ISystemService, FilePickerOptions, FolderPickerOptions } from '../../../domain';
import { logger } from '../../../shared';

// Conditionally import Electron modules
let dialog: any = null;
let shell: any = null;

try {
  const electron = require('electron');
  dialog = electron.dialog;
  shell = electron.shell;
} catch {
  logger.warn('[SystemService] Running outside Electron context');
}

/**
 * System Service implementation
 */
export class SystemService implements ISystemService {
  async getFonts(): Promise<string[]> {
    try {
      const { getFonts } = await import('font-list');
      const fonts = await getFonts();
      return fonts.sort((a, b) => a.localeCompare(b));
    } catch (error) {
      logger.error('[SystemService] Failed to get fonts:', error);
      // Return fallback fonts
      return [
        'Arial',
        'Georgia',
        'Helvetica',
        'Monaco',
        'Times New Roman',
        'Courier New',
        'Verdana',
        'Tahoma',
      ];
    }
  }

  async selectFolder(options?: FolderPickerOptions): Promise<string | null> {
    if (!dialog) {
      throw new Error('Folder selection not available outside Electron');
    }

    const result = await dialog.showOpenDialog({
      title: options?.title || 'Select Folder',
      defaultPath: options?.defaultPath,
      buttonLabel: options?.buttonLabel || 'Select',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  }

  async selectFile(options?: FilePickerOptions): Promise<string | string[] | null> {
    if (!dialog) {
      throw new Error('File selection not available outside Electron');
    }

    const properties: Array<'openFile' | 'multiSelections'> = ['openFile'];
    if (options?.multiSelect) {
      properties.push('multiSelections');
    }

    const result = await dialog.showOpenDialog({
      title: options?.title || 'Select File',
      defaultPath: options?.defaultPath,
      filters: options?.filters,
      properties,
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return options?.multiSelect ? result.filePaths : result.filePaths[0];
  }

  async selectSaveLocation(options?: FilePickerOptions): Promise<string | null> {
    if (!dialog) {
      throw new Error('Save dialog not available outside Electron');
    }

    const result = await dialog.showSaveDialog({
      title: options?.title || 'Save File',
      defaultPath: options?.defaultPath,
      filters: options?.filters,
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    return result.filePath;
  }

  async validatePath(path: string): Promise<boolean> {
    try {
      const fs = await import('node:fs/promises');
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  showInFolder(path: string): void {
    if (!shell) {
      logger.warn('[SystemService] Shell not available');
      return;
    }

    shell.showItemInFolder(path);
  }

  async openExternal(url: string): Promise<void> {
    if (!shell) {
      throw new Error('Shell not available outside Electron');
    }

    await shell.openExternal(url);
  }
}
