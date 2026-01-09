/**
 * Settings IPC Adapter - Handles settings-related IPC channels
 */

import { ipcMain } from 'electron';
import { SETTINGS_CHANNELS } from '@shared/constants/ipcChannels';
import type { ISettingsUseCases } from '../../../domain';
import { logger } from '../../../shared';

export interface SettingsIPCDeps {
  settingsUseCases: ISettingsUseCases;
}

export function registerSettingsHandlers(deps: SettingsIPCDeps): void {
  const { settingsUseCases } = deps;

  ipcMain.handle(SETTINGS_CHANNELS.GET, async (_event, params: { key: string }) => {
    try {
      logger.info(`[IPC] settings:get key=${params.key}`);
      const result = await settingsUseCases.get(params.key);
      return { success: true, data: result };
    } catch (error) {
      logger.error('[IPC] settings:get error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle(SETTINGS_CHANNELS.SET, async (_event, params: { key: string; value: string }) => {
    try {
      logger.info(`[IPC] settings:set key=${params.key}`);
      await settingsUseCases.set(params.key, params.value);
      return { success: true };
    } catch (error) {
      logger.error('[IPC] settings:set error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle(SETTINGS_CHANNELS.GET_ALL, async () => {
    try {
      logger.info('[IPC] settings:getAll');
      const result = await settingsUseCases.getAll();
      return { success: true, data: result };
    } catch (error) {
      logger.error('[IPC] settings:getAll error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  logger.info('[IPC] Settings handlers registered');
}

export function unregisterSettingsHandlers(): void {
  Object.values(SETTINGS_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
