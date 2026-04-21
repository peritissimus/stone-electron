/**
 * Settings IPC Adapter - Handles settings-related IPC channels
 */

import { ipcMain } from 'electron';
import { SETTINGS_CHANNELS } from '@shared/constants/ipcChannels';
import type {
  IGetSettingUseCase,
  ISetSettingUseCase,
  IGetAllSettingsUseCase,
  IGetAppearanceSettingsUseCase,
  ISetThemeUseCase,
  ISetAccentColorUseCase,
  IUpdateFontSettingsUseCase,
  IResetFontSettingsUseCase,
} from '../../../domain';
import type {
  AppAccentColor,
  AppTheme,
  FontSettings,
} from '@shared/types/settings';
import { handleIpcRequest } from '@main/shared/utils';
import { logger } from '../../../shared';

export interface SettingsIPCDeps {
  getSetting: IGetSettingUseCase;
  setSetting: ISetSettingUseCase;
  getAllSettings: IGetAllSettingsUseCase;
  getAppearanceSettings: IGetAppearanceSettingsUseCase;
  setTheme: ISetThemeUseCase;
  setAccentColor: ISetAccentColorUseCase;
  updateFontSettings: IUpdateFontSettingsUseCase;
  resetFontSettings: IResetFontSettingsUseCase;
}

export function registerSettingsHandlers(deps: SettingsIPCDeps): void {
  const {
    getSetting,
    setSetting,
    getAllSettings,
    getAppearanceSettings,
    setTheme,
    setAccentColor,
    updateFontSettings,
    resetFontSettings,
  } = deps;
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

  ipcMain.handle(SETTINGS_CHANNELS.GET_APPEARANCE, async () => {
    return handleRequest(
      async () => getAppearanceSettings.execute(),
      { channel: SETTINGS_CHANNELS.GET_APPEARANCE },
    );
  });

  ipcMain.handle(SETTINGS_CHANNELS.SET_THEME, async (_event, params: { theme: AppTheme }) => {
    return handleRequest(
      async () => {
        await setTheme.execute({ theme: params.theme });
        return { success: true };
      },
      { channel: SETTINGS_CHANNELS.SET_THEME, theme: params.theme },
    );
  });

  ipcMain.handle(
    SETTINGS_CHANNELS.SET_ACCENT_COLOR,
    async (_event, params: { accentColor: AppAccentColor }) => {
      return handleRequest(
        async () => {
          await setAccentColor.execute({ accentColor: params.accentColor });
          return { success: true };
        },
        { channel: SETTINGS_CHANNELS.SET_ACCENT_COLOR, accentColor: params.accentColor },
      );
    },
  );

  ipcMain.handle(
    SETTINGS_CHANNELS.UPDATE_FONT_SETTINGS,
    async (_event, params: { fontSettings: Partial<FontSettings> }) => {
      return handleRequest(
        async () => {
          await updateFontSettings.execute({ fontSettings: params.fontSettings });
          return { success: true };
        },
        { channel: SETTINGS_CHANNELS.UPDATE_FONT_SETTINGS },
      );
    },
  );

  ipcMain.handle(SETTINGS_CHANNELS.RESET_FONT_SETTINGS, async () => {
    return handleRequest(
      async () => {
        await resetFontSettings.execute();
        return { success: true };
      },
      { channel: SETTINGS_CHANNELS.RESET_FONT_SETTINGS },
    );
  });

  logger.info('[IPC] Settings handlers registered');
}

export function unregisterSettingsHandlers(): void {
  Object.values(SETTINGS_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
