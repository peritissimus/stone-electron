/**
 * System IPC Adapter - Handles system-level IPC channels
 */

import { ipcMain } from 'electron';
import { SYSTEM_CHANNELS } from '@shared/constants/ipcChannels';
import { logger } from '../../../shared';
import { handleIpcRequest } from '@main/shared/utils';

export interface SystemIPCDeps {
  getSystemFonts: () => Promise<string[]>;
}

export function registerSystemHandlers(deps: SystemIPCDeps): void {
  const { getSystemFonts } = deps;

  ipcMain.handle(SYSTEM_CHANNELS.GET_FONTS, async () => {
    return handleIpcRequest(
      async () => {
        logger.info('[IPC] system:getFonts');
        const fonts = await getSystemFonts();
        return fonts;
      },
      { loggerPrefix: 'SystemIPC', defaultCode: 'INTERNAL_ERROR' },
    );
  });

  logger.info('[IPC] System handlers registered');
}

export function unregisterSystemHandlers(): void {
  Object.values(SYSTEM_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
