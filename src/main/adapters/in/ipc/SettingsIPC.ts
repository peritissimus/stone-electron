/**
 * Settings IPC Adapter - Handles settings-related IPC channels
 */

import { ipcMain } from 'electron';
import { SETTINGS_CHANNELS } from '@shared/constants/ipcChannels';
import type { ISettingsUseCases } from '../../../domain';
import { handleIpcRequest } from '@main/shared/utils';
import { logger } from '../../../shared';

export interface SettingsIPCDeps {
  settingsUseCases: ISettingsUseCases;
}

export function registerSettingsHandlers(deps: SettingsIPCDeps): void {
  const { settingsUseCases } = deps;
  const handleRequest = <T>(fn: () => Promise<T>) =>
    handleIpcRequest(fn, { loggerPrefix: 'SettingsIPC', defaultCode: 'INTERNAL_ERROR' });

  ipcMain.handle(SETTINGS_CHANNELS.GET, async (_event, params: { key: string }) => {
    return handleRequest(async () => {
      logger.info(`[IPC] settings:get key=${params.key}`);
      const result = await settingsUseCases.get(params.key);
      return result;
    });
  });

  ipcMain.handle(SETTINGS_CHANNELS.SET, async (_event, params: { key: string; value: string }) => {
    return handleRequest(async () => {
      logger.info(`[IPC] settings:set key=${params.key}`);
      await settingsUseCases.set(params.key, params.value);
      return { success: true };
    });
  });

  ipcMain.handle(SETTINGS_CHANNELS.GET_ALL, async () => {
    return handleRequest(async () => {
      logger.info('[IPC] settings:getAll');
      const result = await settingsUseCases.getAll();
      return result;
    });
  });

  logger.info('[IPC] Settings handlers registered');
}

export function unregisterSettingsHandlers(): void {
  Object.values(SETTINGS_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
