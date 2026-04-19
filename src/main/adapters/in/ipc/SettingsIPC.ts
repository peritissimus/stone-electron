/**
 * Settings IPC Adapter - Handles settings-related IPC channels
 */

import { ipcMain } from 'electron';
import { SETTINGS_CHANNELS } from '@shared/constants/ipcChannels';
import type {
  IGetSettingUseCase,
  ISetSettingUseCase,
  IGetAllSettingsUseCase,
} from '../../../domain';
import { handleIpcRequest } from '@main/shared/utils';
import { logger } from '../../../shared';

export interface SettingsIPCDeps {
  getSetting: IGetSettingUseCase;
  setSetting: ISetSettingUseCase;
  getAllSettings: IGetAllSettingsUseCase;
}

export function registerSettingsHandlers(deps: SettingsIPCDeps): void {
  const { getSetting, setSetting, getAllSettings } = deps;
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest(fn, { loggerPrefix: 'SettingsIPC', defaultCode: 'INTERNAL_ERROR', context });

  ipcMain.handle(SETTINGS_CHANNELS.GET, async (_event, params: { key: string }) => {
    return handleRequest(
      async () => getSetting.execute({ key: params.key }),
      { channel: SETTINGS_CHANNELS.GET, key: params.key },
    );
  });

  ipcMain.handle(SETTINGS_CHANNELS.SET, async (_event, params: { key: string; value: string }) => {
    return handleRequest(
      async () => {
        await setSetting.execute({ key: params.key, value: params.value });
        return { success: true };
      },
      { channel: SETTINGS_CHANNELS.SET, key: params.key },
    );
  });

  ipcMain.handle(SETTINGS_CHANNELS.GET_ALL, async () => {
    return handleRequest(
      async () => getAllSettings.execute(),
      { channel: SETTINGS_CHANNELS.GET_ALL },
    );
  });

  logger.info('[IPC] Settings handlers registered');
}

export function unregisterSettingsHandlers(): void {
  Object.values(SETTINGS_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
