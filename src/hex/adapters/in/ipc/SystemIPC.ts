/**
 * System IPC Adapter - Handles system-level IPC channels
 */

import { ipcMain } from 'electron';
import { logger } from '../../../shared/utils';

const CHANNELS = {
  GET_FONTS: 'system:getFonts',
} as const;

export interface SystemIPCDeps {
  getSystemFonts: () => Promise<string[]>;
}

export function registerSystemHandlers(deps: SystemIPCDeps): void {
  const { getSystemFonts } = deps;

  ipcMain.handle(CHANNELS.GET_FONTS, async () => {
    try {
      logger.info('[IPC] system:getFonts');
      const fonts = await getSystemFonts();
      return { success: true, data: fonts };
    } catch (error) {
      logger.error('[IPC] system:getFonts error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  logger.info('[IPC] System handlers registered');
}

export function unregisterSystemHandlers(): void {
  Object.values(CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
