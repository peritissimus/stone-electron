/**
 * System IPC Adapter - Handles system-level IPC channels
 *
 * Return types are bound to shared wire schemas (src/shared/schemas/system.ts).
 * If the handler drifts from the renderer's expected shape, TypeScript fails
 * at compile time.
 */

import { ipcMain } from 'electron';
import { SYSTEM_CHANNELS } from '@shared/constants/ipcChannels';
import type { SystemGetFontsResponse } from '@shared/schemas';
import type { IGetSystemFontsUseCase } from '../../../domain';
import { logger } from '../../../shared';
import { handleIpcRequest } from '@main/shared/utils';

export interface SystemIPCDeps {
  getSystemFonts: IGetSystemFontsUseCase;
}

export function registerSystemHandlers(deps: SystemIPCDeps): void {
  const { getSystemFonts } = deps;

  ipcMain.handle(SYSTEM_CHANNELS.GET_FONTS, async () => {
    return handleIpcRequest<SystemGetFontsResponse>(
      async () => {
        return await getSystemFonts.execute();
      },
      {
        loggerPrefix: 'SystemIPC',
        defaultCode: 'INTERNAL_ERROR',
        context: { channel: SYSTEM_CHANNELS.GET_FONTS },
      },
    );
  });

  logger.info('[IPC] System handlers registered');
}

export function unregisterSystemHandlers(): void {
  Object.values(SYSTEM_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
