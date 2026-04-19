/**
 * System IPC Adapter - Handles system-level IPC channels
 */

import { ipcMain } from 'electron';
import { SYSTEM_CHANNELS } from '@shared/constants/ipcChannels';
import type { IGetSystemFontsUseCase } from '../../../domain';
import { logger } from '../../../shared';
import { handleIpcRequest } from '@main/shared/utils';

export interface SystemIPCDeps {
  getSystemFonts: IGetSystemFontsUseCase;
}

export function registerSystemHandlers(deps: SystemIPCDeps): void {
  const { getSystemFonts } = deps;
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest(fn, { loggerPrefix: 'SystemIPC', defaultCode: 'INTERNAL_ERROR', context });

  ipcMain.handle(SYSTEM_CHANNELS.GET_FONTS, async () => {
    return handleRequest(
      async () => {
        const result = await getSystemFonts.execute();
        return result.fonts;
      },
      { channel: SYSTEM_CHANNELS.GET_FONTS },
    );
  });

  logger.info('[IPC] System handlers registered');
}

export function unregisterSystemHandlers(): void {
  Object.values(SYSTEM_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
