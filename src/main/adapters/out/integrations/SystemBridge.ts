/**
 * System Service Adapter - OS-level operations (fonts, dialogs, shell)
 */

import os from 'os';
import path from 'path';
import type {
  ISystemBridge,
  FilePickerOptions,
  FolderPickerOptions,
  MicrophoneAccessStatus,
} from '../../../domain';
import { logger } from '../../../shared';

// Conditionally import Electron modules
let dialog: any = null;
let shell: any = null;
let app: any = null;
let systemPreferences: any = null;

try {
  const electron = require('electron');
  dialog = electron.dialog;
  shell = electron.shell;
  app = electron.app;
  systemPreferences = electron.systemPreferences;
} catch {
  logger.warn('[SystemBridge] Running outside Electron context');
}

/**
 * System Service implementation
 */
export class SystemBridge implements ISystemBridge {
  getDefaultWorkspaceDir(configuredPath?: string): string {
    // Honor an explicit absolute path the user has configured.
    if (configuredPath && path.isAbsolute(configuredPath)) {
      return configuredPath;
    }

    // Otherwise fall back to ~/Documents/Stone (electron's documents path
    // when available, plain homedir join outside Electron / in tests).
    let documentsDir: string;
    try {
      documentsDir = app?.getPath ? app.getPath('documents') : path.join(os.homedir(), 'Documents');
    } catch {
      documentsDir = path.join(os.homedir(), 'Documents');
    }
    return path.join(documentsDir, 'Stone');
  }

  async getFonts(): Promise<string[]> {
    return await logger.withContext('out:SystemBridge.getFonts', async () => {
      try {
        const { getFonts } = await import('font-list');
        const fonts = await getFonts();
        return fonts.sort((a, b) => a.localeCompare(b));
      } catch (error) {
        logger.error('[SystemBridge] Failed to get fonts:', error);
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
    });
  }

  getMicrophoneAccessStatus(): MicrophoneAccessStatus {
    // getMediaAccessStatus exists on macOS and Windows; Linux has no TCC
    // equivalent — report 'unknown' and let getUserMedia just work.
    if (!systemPreferences?.getMediaAccessStatus) return 'unknown';
    try {
      return systemPreferences.getMediaAccessStatus('microphone') as MicrophoneAccessStatus;
    } catch {
      return 'unknown';
    }
  }

  async askForMicrophoneAccess(): Promise<boolean> {
    // askForMediaAccess is macOS-only; elsewhere fall back to the status.
    if (systemPreferences?.askForMediaAccess) {
      try {
        return await systemPreferences.askForMediaAccess('microphone');
      } catch {
        return false;
      }
    }
    const status = this.getMicrophoneAccessStatus();
    return status === 'granted' || status === 'unknown';
  }

  getScreenCaptureAccessStatus(): 'granted' | 'denied' | 'unsupported' {
    // 'screen' TCC is macOS-only; on Windows/Linux loopback audio needs no
    // such grant, so report 'unsupported' (the UI hides the row). There's no
    // clean programmatic prompt — the grant happens via System Settings or the
    // first getDisplayMedia call, so this is status-only.
    if (process.platform !== 'darwin' || !systemPreferences?.getMediaAccessStatus) {
      return 'unsupported';
    }
    try {
      return systemPreferences.getMediaAccessStatus('screen') === 'granted'
        ? 'granted'
        : 'denied';
    } catch {
      return 'unsupported';
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
      logger.warn('[SystemBridge] Shell not available');
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
